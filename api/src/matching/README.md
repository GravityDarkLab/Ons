# Matching System

This directory contains the full matching pipeline: the engine that orchestrates scoring, the hard pre-filters, and the three algorithm implementations.

---

## Overview

```
matching/
├── engine.ts              ← Orchestrator — loads applicants, runs filters, calls prepare() + score()
├── filters.ts             ← Hard compatibility filters (orientation, etc.)
├── algorithms/
│   ├── baseline.ts        ← Rule-based weighted scoring
│   ├── cosine.ts          ← Cosine similarity over encoded feature vectors
│   └── embedding-cosine.ts← Cosine similarity over dense text embeddings
├── embeddings/
│   └── provider.ts        ← EmbeddingProvider interface + OpenAI-compatible factory
└── scorers/
    └── trait.scorer.ts    ← Shared trait overlap helpers used by baseline
```

---

## Pipeline

Every matching request — single candidate lookup or full pairwise pass — goes through the same three stages:

```
1. LOAD          Load all active applicants from MongoDB.

2. FILTER        Remove incompatible pairs before any scoring.
                 Hard pass/fail — not scored, not ranked low.
                 (A 0.0 score would still appear in results; a filtered pair does not.)

3. PREPARE       Optional async hook on the algorithm.
                 Used by embedding-cosine to batch-embed all applicants once
                 before pairwise scoring begins (O(N) API calls, not O(N²)).

4. SCORE         Call algorithm.score(a, b) for every compatible pair.
                 Returns a composite score in [0, 1] + a named breakdown.

5. RANK          Sort descending by score, slice to top N.
```

---

## Hard filters (`filters.ts`)

Filters run before the algorithm is invoked. If a pair doesn't pass every filter, it is excluded entirely — regardless of algorithm or score.

### Orientation compatibility

| Person A | Person B gender | Compatible? |
|---|---|---|
| Straight (Male) | Female | ✅ |
| Straight (Female) | Male | ✅ |
| Straight | Same gender | ❌ |
| Gay (Male) | Male | ✅ |
| Gay (Male) | Female | ❌ |
| Lesbian (Female) | Female | ✅ |
| Bisexual / Pansexual | Any | ✅ |
| Asexual | Any | ✅ |
| Unknown / missing | Any | ✅ (pass-through) |

Compatibility is **bidirectional** — both A→B and B→A must pass.

---

## Algorithms

All three algorithms implement the same `Algorithm` interface:

```typescript
interface Algorithm {
  name: string;
  prepare?(applicants: ApplicantDoc[], questionnaire: QuestionnaireDoc): Promise<void>;
  score(a: ApplicantDoc, b: ApplicantDoc, questionnaire: QuestionnaireDoc): MatchScore;
}
```

### 1. `baseline`

Simple weighted scoring across six hand-crafted dimensions.

| Dimension | Weight | How scored |
|---|---|---|
| Relationship type | 30% | Exact match = 1.0; "Open to Both" = 0.7; mismatch = 0 |
| Deal breakers | 20% | Keyword overlap between A's deal breakers and B's lifestyle |
| Religion compatibility | 15% | Exact match = 1.0; flexible = 0.5; mismatch = 0 |
| Physical affection importance | 15% | `1 - |a - b| / 10` (scale of 1–10) |
| Long distance openness | 10% | Both open = 1.0; one open = 0.5; both closed = 0 |
| Lifestyle overlap | 10% | Jaccard similarity over lifestyle keywords |

**Pros:** Fast, zero dependencies, fully explainable.  
**Cons:** Brittle rules, no semantic understanding — `"gym"` and `"fitness"` are unrelated.

---

### 2. `cosine`

Geometric cosine similarity over encoded feature vectors.

#### The math

```
cos(A, B) = (A · B) / (‖A‖ · ‖B‖)
```

Result is always in [0, 1] because all feature values are non-negative.  
**Why cosine over Euclidean?** Cosine is magnitude-invariant — a long and a short lifestyle description can still score 1.0 if they mention the same proportional mix of keywords. Euclidean distance penalises length unfairly.

#### Feature decomposition

| Component | Weight | Description |
|---|---|---|
| Numeric compatibility | 25% | `cosine(numeric_vec_A, numeric_vec_B)` |
| Lifestyle similarity | 20% | `cosine(lifestyle_bag_A, lifestyle_bag_B)` |
| Character cross-match | 35% | `(cosine(pref_A, vibe_B) + cosine(pref_B, vibe_A)) / 2` |
| Deal breaker penalty | 20% | `1 - (cosine(breaks_A, lifestyle_B) + cosine(breaks_B, lifestyle_A)) / 2` |

**Numeric vector** (no text, exact encoding):
```
[rel_long_term, rel_short_term, open_to_long_distance, affection/10, religion_open]
```

**Bag-of-words** vectors are built from a shared union vocabulary — each dimension is 1 if the word appears, 0 otherwise.

**Character cross-match** is bidirectional: it checks whether B's self-described vibe matches what A is looking for, *and* whether A's vibe matches what B wants. Both directions are averaged.

**Deal breaker penalty** inverts similarity — high similarity between A's deal breakers and B's lifestyle is *bad*. The component is `1 - similarity` so it contributes positively when lifestyles are *unlike* the deal breakers.

**Pros:** No external dependencies, better than baseline, meaningful score decomposition.  
**Cons:** Still bag-of-words for text — `"driven"` and `"ambitious"` are orthogonal vectors.

---

### 3. `embedding-cosine`

Same four-component structure as `cosine` but text fields are replaced with dense vector embeddings, enabling true semantic similarity.

| Component | Weight | How computed |
|---|---|---|
| Numeric compatibility | 25% | Same as `cosine` — no embeddings needed |
| Lifestyle similarity | 20% | `cosine(embed(lifestyle + vibe), embed(lifestyle + vibe))` |
| Character cross-match | 35% | `cosine(embed(preferred_traits), embed(vibe_words))` — bidirectional |
| Deal breaker penalty | 20% | `1 - cosine(embed(deal_breakers), embed(lifestyle))` — bidirectional |

#### Semantic comparison (why this matters)

| Pair | `cosine` (bag-of-words) | `embedding-cosine` |
|---|---|---|
| "driven" vs "ambitious" | 0.00 | ~0.85 |
| "funny" vs "humorous" | 0.00 | ~0.91 |
| "gym" vs "fitness" | 0.00 | ~0.87 |
| "spontaneous" vs "adventurous" | 0.00 | ~0.82 |

#### `prepare()` — why it exists

Calling the embedding API inside `score()` would mean one API call per pair per text field:

```
50 applicants × 49 pairs × 3 text fields = 7,350 API calls per run
```

Instead, `prepare()` runs once before scoring and batch-embeds all applicants:

```
50 applicants × 3 text fields = 3 batch requests (150 embeddings total)
```

Embeddings are also **persisted to the `embeddings` MongoDB collection at form submission time** (fire-and-forget). In steady state, `prepare()` loads everything from the DB — zero API calls.

**Stale detection:** if `EMBEDDING_MODEL` changes, existing vectors are in a different embedding space and cannot be compared. The service detects this by comparing the stored `model` field and re-embeds stale documents automatically.

---

## Embedding providers (`embeddings/provider.ts`)

The `EmbeddingProvider` interface abstracts over any OpenAI-compatible API:

```typescript
interface EmbeddingProvider {
  name: string;
  model: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

| Provider | `EMBEDDING_PROVIDER` | Requirements |
|---|---|---|
| OpenAI | `openai` | `OPENAI_API_KEY` |
| LM Studio | `local` | `EMBEDDING_BASE_URL=http://localhost:1234/v1` |
| Ollama | `local` | `EMBEDDING_BASE_URL=http://localhost:11434/v1` |
| llama.cpp | `local` | `EMBEDDING_BASE_URL=http://localhost:8080/v1` |

Recommended local models: `nomic-embed-text`, `mxbai-embed-large`, `all-minilm`.

> **Why not Claude / Anthropic?** Anthropic does not offer a public embeddings API. For local models with comparable quality, use LM Studio or Ollama with an instruction-tuned embedding model.

---

## Adding a new algorithm

1. Create `algorithms/my-algorithm.ts` implementing the `Algorithm` interface.
2. Register it in `engine.ts`:
   ```typescript
   const ALGORITHM_REGISTRY: Record<string, Algorithm> = {
     "baseline": baselineAlgorithm,
     "cosine": cosineAlgorithm,
     "embedding-cosine": embeddingCosineAlgorithm,
     "my-algorithm": myAlgorithm,  // ← add here
   };
   ```
3. Add it to the `algorithm` enum in `api/src/validators/admin.validator.ts` and `api/docs/openapi.yaml`.

The engine handles the rest — `prepare()` is called automatically if present.

---

## Score output

Every algorithm returns a `MatchScore`:

```typescript
interface MatchScore {
  score: number;                     // composite weighted score in [0, 1]
  breakdown: Record<string, number>; // named per-component scores
}
```

The `breakdown` keys vary by algorithm — see the component tables above. All values are rounded to two decimal places.

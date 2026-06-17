# Matching System

This directory contains the full matching pipeline: the engine that orchestrates scoring, hard pre-filters, the embedding-based scorer, and shared weights.

---

## Directory layout

```
matching/
├── engine.ts                  ← Orchestrator — loads applicants, runs filters, calls prepare() + score()
├── scorer.ts                  ← Embedding-cosine scorer (prepare + score)
├── scoring/
│   └── weights.ts             ← Single source of truth for all scoring weights
├── filters/
│   ├── orientation.filter.ts  ← Hard orientation-compatibility filter
│   └── age.filter.ts          ← Hard age-preference filter + soft modifier
└── embeddings/
    └── provider.ts            ← EmbeddingProvider interface + OpenAI-compatible factory
```

---

## Pipeline

Every matching request — single candidate lookup or full pairwise pass — goes through the same stages:

```
1. LOAD      Load all active applicants from MongoDB.

2. FILTER    Remove incompatible pairs before any scoring.
             Hard pass/fail — not scored, not ranked low.
             Two filters run in sequence:
               a) Orientation compatibility (see below)
               b) Age preferences (see below)

3. PREPARE   Batch-embeds all applicants once before pairwise scoring
             begins (O(N) API calls, not O(N²)).
             Embeddings are persisted; subsequent runs hit the DB cache.

4. SCORE     Call score(a, b) for every compatible pair.
             Returns a composite score in [0, 1] + a named breakdown.

5. RANK      Sort descending by score, slice to top N.
```

---

## Hard filters

Filters run before scoring. A pair that fails any filter is excluded entirely.

### Orientation compatibility (`filters/orientation.filter.ts`)

Both directions must pass:

| Person A | Person B gender | Compatible? |
|---|---|---|
| Straight (Male) | Female | ✅ |
| Straight | Same gender | ❌ |
| Gay (Male) | Male | ✅ |
| Gay (Male) | Female | ❌ |
| Lesbian (Female) | Female | ✅ |
| Bisexual / Pansexual | Any | ✅ |
| Asexual | Any | ✅ (other side's filter still applies) |
| Unknown / missing | Any | ✅ pass-through |

### Age preferences (`filters/age.filter.ts`)

Each applicant can express age constraints via three optional answers:

| Field | Type | Meaning |
|---|---|---|
| `max_age_gap` | `number \| null` | Maximum age difference (years). `null` = no preference. |
| `open_to_older` | `boolean \| null` | Allow partner older than self. Only shown/stored when `max_age_gap > 0`. |
| `open_to_younger` | `boolean \| null` | Allow partner younger than self. Same condition. |

**Hard exclusion rules** (either direction failing rejects the pair):

1. `open_to_older = false` and partner is older → reject.
2. `open_to_younger = false` and partner is younger → reject.
3. Gap > `2 × max_age_gap` → hard outer limit, reject.
4. `max_age_gap = null` → skip all checks for that applicant (no preference).
5. Missing `birth_date` on either side → skip filter for that pair.

**Age modifier** (soft multiplier, applied after weighted scoring):

```
gap = |age(A) - age(B)|

gap ≤ max_gap         → modifier = 1.0   (no penalty)
max_gap < gap ≤ 2×max_gap → modifier = cos((gap - max_gap) / max_gap × π/2)
gap > 2×max_gap        → should be filtered; returns 0.0 defensively

final_score = compatibility_score × min(A_modifier, B_modifier)
```

Bidirectional — the stricter (min) of both parties' modifiers is applied.

---

## Scorer (`scorer.ts`)

The single production scorer uses dense text embeddings for semantic comparison. There are no other algorithm variants.

### Weights

```typescript
// matching/scoring/weights.ts
export const WEIGHTS = {
  numeric:               0.22,   // structured numeric preferences
  lifestyle:             0.22,   // semantic lifestyle similarity
  character_cross_match: 0.35,   // bidirectional character match
  deal_breakers:         0.21,   // bidirectional deal-breaker penalty
} as const;
```

### Score components

| Component | Weight | How computed |
|---|---|---|
| Numeric compatibility | 0.22 | `cosine(numeric_vec_A, numeric_vec_B)` — structured fields |
| Lifestyle similarity | 0.22 | `cosine(embed(profile_A), embed(profile_B))` |
| Character cross-match | 0.35 | `(cosine(pref_A, profile_B) + cosine(pref_B, profile_A)) / 2` — bidirectional |
| Deal-breaker penalty | 0.21 | `1 − (cosine(breaks_A, profile_B) + cosine(breaks_B, profile_A)) / 2` |
| **× Age modifier** | ✦ | Multiplied onto the weighted sum — see above |

**Numeric vector** (no text, exact encoding):
```
[rel_long_term, rel_short_term, open_to_long_distance, affection/10, religion_open]
```

**Embedding text composition (v2):**

| Vector | Fields joined |
|---|---|
| `profile` | `lifestyle + " — " + vibe_words + " — " + work` |
| `preference` | `preferred_character_traits + " — " + preferred_physical_traits + " — " + dream_first_date` |
| `dealBreakers` | `deal_breakers` |

### Why semantic embeddings?

| Pair | Bag-of-words | Embedding |
|---|---|---|
| "driven" vs "ambitious" | 0.00 | ~0.85 |
| "funny" vs "humorous" | 0.00 | ~0.91 |
| "gym" vs "fitness" | 0.00 | ~0.87 |
| "spontaneous" vs "adventurous" | 0.00 | ~0.82 |

### `prepare()` — embedding batching

Running the embedding API inside `score()` would cost one call per pair:

```
50 applicants × 49 pairs × 3 text fields = 7,350 API calls per run
```

Instead, `prepare()` runs once and batch-embeds all applicants:

```
50 applicants × 3 text fields = 3 batch requests (150 embeddings total)
```

Embeddings are **persisted** to the `embeddings` MongoDB collection at form-submission time (fire-and-forget). In steady state `prepare()` loads from the DB — zero API calls.

**Stale detection:** embeddings are recomputed automatically when:
- `EMBEDDING_MODEL` changes (different vector space).
- `textVersion` in the stored document differs from `CURRENT_TEXT_VERSION` (text composition changed).

Current `textVersion = 2` (added `work` to profile, `dream_first_date` to preference in v1.1.0).

---

## Embedding providers (`embeddings/provider.ts`)

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

> **Why not Claude / Anthropic?** Anthropic does not offer a public embeddings API. For local models, use LM Studio or Ollama with an instruction-tuned embedding model.

---

## Score output

```typescript
interface MatchScore {
  score: number;                     // composite weighted score in [0, 1]
  breakdown: Record<string, number>; // named per-component scores + age_modifier
}
```

Breakdown keys: `numeric_compatibility`, `lifestyle_similarity`, `character_cross_match`, `character_a_wants_b`, `character_b_wants_a`, `deal_breaker_penalty`, `age_modifier`. All values are rounded to two decimal places.

---

## Extending the pipeline

**Add a new hard filter:**
1. Create `filters/my-filter.ts` exporting a `isCompatible(a, b): boolean` function.
2. Call it in `engine.ts` inside `applyFilters()`.

**Change scoring weights:**
- Edit `scoring/weights.ts`. The values must sum to 1.0.

**Change embedded text composition:**
- Update `buildTexts()` in `services/embedding.service.ts`.
- Bump `CURRENT_TEXT_VERSION` in the same file (triggers automatic re-embed for all applicants on next run).

**Add a second scorer:** the engine calls `prepare()` and `score()` directly from `scorer.ts`. To swap or A/B-test a different algorithm, change those imports in `engine.ts`.

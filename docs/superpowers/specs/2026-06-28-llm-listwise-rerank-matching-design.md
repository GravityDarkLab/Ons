# Matching score accuracy: why scores never exceed ~80%, and what to do about it — design

## Problem

Every match ever produced by [`api/src/matching/scorer.ts`](../../../api/src/matching/scorer.ts) has scored under 80%, regardless of how strong the underlying pair actually is. That's not a tuning problem — it's structural, and it's worth understanding precisely before picking a fix.

### Root cause

`scorer.ts` computes four `cosine(...)` terms (numeric preferences, lifestyle-embedding similarity, bidirectional character cross-match, deal-breaker penalty) and combines them with fixed weights ([`scoring/weights.ts`](../../../api/src/matching/scoring/weights.ts)):

```
numeric: 0.22, lifestyle: 0.22, character_cross_match: 0.35, deal_breakers: 0.21
```

Two independent, well-documented geometric effects push every one of those cosine terms toward a high *floor*, long before any human notion of "similarity" enters the picture:

1. **Embedding anisotropy.** Learned text embeddings cluster in a narrow cone of the vector space rather than spreading isotropically, so even *unrelated* texts produce a surprisingly high baseline cosine — commonly 0.6–0.75, not ~0.
   - Ethayarajh, K. (2019). *How Contextual are Contextualized Word Representations?* EMNLP.
   - Gao, J. et al. (2019). *Representation Degeneration Problem in Training Natural Language Generation Models.* ICLR.
   - Steck, H., Ekanadham, C., & Kallus, N. (2024). *Is Cosine-Similarity of Embeddings Really About Similarity?* [arXiv:2403.05440](https://arxiv.org/abs/2403.05440) — argues directly that raw cosine similarity from learned embeddings is not a calibrated similarity measure and shouldn't be used as one without correction.
2. **Non-negative-orthant bias.** [`scorers/numeric.scorer.ts`](../../../api/src/matching/scorers/numeric.scorer.ts)'s `buildNumericVector()` has all non-negative entries, confining it to one orthant — cosine between any two such vectors can never go negative, so it's biased upward by construction, independent of embeddings entirely.

The **deal-breaker term** compounds this the worst: `dealBreakerScore = 1 - cosine(dealBreakers, profile)`. Since baseline cosine between *unrelated* content already sits around 0.6–0.75 (effect #1), this term caps near 0.25–0.4 even for a genuinely perfect non-overlap — it's an inversion stacked on top of an already-inflated floor. At 21% weight, that alone caps the achievable total well under 100%.

Net effect: the weighted sum is built almost entirely from terms whose realistic ceiling is ~0.85, not 1.0 — consistent with "never seen a match over 80%." The matches aren't weak; the score has been measuring against the wrong zero point since this scorer was written.

## Approaches considered

### A — Empirical min-max calibration (rescale cosine, keep embeddings)

Per matching run, compute raw scores for every pair first, then min-max rescale each of the four components against the min/max actually observed in that pool, before applying weights. The best pair in the current pool approaches 100%; a genuinely weak pair approaches 0%.

- **Grounding:** directly addresses the anisotropy/calibration concern Steck et al. (2024) raise; standard score-normalization practice in IR and recommender systems.
- **Pros:** Cheap (pure vector math, no new API calls), surgical, keeps the existing architecture.
- **Cons:** Score becomes pool-relative — meaning shifts with the pool. Degenerates at very small N (min == max). Treats the *symptom* (the number shown) without improving the underlying *signal* (which candidates get ranked highly in the first place).

### B — Global anisotropy correction ("All-but-the-Top")

Mean-center embeddings (and optionally remove the top principal component) across the current applicant corpus before computing cosine, fixing the representation itself rather than rescaling the output.

- **Grounding:** Mu, J., & Viswanath, P. (2018). *All-but-the-Top: Simple and Effective Postprocessing for Word Representations.* ICLR.
- **Pros:** Fixes the root geometric cause; benefits every downstream use of the embeddings, not just the displayed score.
- **Cons:** More invasive — needs a corpus-wide centroid recomputed per run, plus a basic PCA/power-iteration step. Heavier to implement and validate than A for the same underlying problem.

### C — LLM-as-judge, pointwise (no embeddings)

Send both full profiles to an LLM and ask it to output a compatibility score directly, replacing vector geometry with reasoning.

- **Grounding:** LLM-as-judge methodology — Zheng, L. et al. (2023). *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena.* NeurIPS.
- **Pros:** Naturally incorporates context and nuance (complementary traits, not just similar ones); no embedding geometry to miscalibrate.
- **Cons — and this is the important finding:** LLMs asked for an *absolute* 0–100 score in isolation have their own well-documented calibration failure: they avoid extremes and cluster ratings in a narrow middle band — the same symptom this design is trying to escape, via a different mechanism.
  - Liu, Y. et al. (2023). *G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment.*
  - *Large Language Models are Inconsistent and Biased Evaluators.* [arXiv:2405.01724](https://arxiv.org/abs/2405.01724)
  - *Evaluating Scoring Bias in LLM-as-a-Judge.* [arXiv:2506.22316](https://arxiv.org/abs/2506.22316)
  - Also costs O(N²) LLM calls for a full matching pass — one call per pair.

### D — Cross-encoder reranking (general IR pattern)

Today's pipeline is a **bi-encoder**: embed A and B independently, then compare — fast, but lossy, because neither side ever sees the other's text. The standard IR fix is retrieve-then-rerank: cheap bi-encoder for a first pass, then a model that reads both texts *together* for the real score.

- **Grounding:** Reimers, N., & Gurevych, I. (2019). *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks* (names this exact trade-off). Nogueira, R., & Cho, K. (2019). *Passage Re-ranking with BERT* (establishes the retrieve-then-rerank pattern in IR).
- **Note:** there's no off-the-shelf cross-encoder for "romantic compatibility" (cross-encoders in IR are trained on query–passage relevance, not this task, and no such fine-tuning data exists here). Without one, the only thing that can jointly read both profiles is an LLM call — so D converges into C/F.

### E — Structured, no-ML, no-LLM scoring

Drop free-text-derived signals; score only on directly comparable structured data (categorical answers, weighted multi-select tag overlap) — fully deterministic, no learned vector space to miscalibrate.

- **Real-world precedent:** OkCupid's published match-percentage algorithm — users answer structured multiple-choice questions with self-assigned importance weights, and the percentage is a direct weighted-agreement calculation. No embeddings anywhere.
- **Pros:** Zero anisotropy problem by construction; fully interpretable; zero ongoing API cost.
- **Cons:** Today's richest signal lives in free text (`lifestyle`, `vibe_words`, `dream_first_date`, `deal_breakers`). Keyword-based comparison would miss synonymy entirely (e.g. "loves quiet nights in" vs. "homebody" — same meaning, zero token overlap). This is really a **questionnaire redesign**, not a scoring fix — out of scope for fixing the score that already exists.

### F — Hybrid: bi-encoder shortlist + LLM listwise rerank (chosen)

Keep the existing embedding pipeline exactly as-is for cheap, broad shortlisting (it's good at that — O(N) embedding calls across the whole pool). For each applicant's shortlist only, make **one LLM call covering the whole shortlist at once** (listwise, not pairwise) to produce the score and reasoning that's actually shown. This directly fixes approach C's calibration failure:

- **Listwise/pairwise framing is far more reliable for LLMs than isolated pointwise scoring**, because the model has comparison points instead of guessing against an abstract scale:
  - Sun, W. et al. (2023). *Is ChatGPT Good at Search? Investigating Large Language Models as Re-Ranking Agents.* EMNLP (**Outstanding Paper Award**) — "RankGPT."
  - Qin, Z. et al. (2023/2024). *Large Language Models are Effective Text Rankers with Pairwise Ranking Prompting.* [arXiv:2306.17563](https://arxiv.org/abs/2306.17563).
- **Explicit extreme-anchor rubrics close most of the remaining gap** — G-Eval's own follow-up work found that describing what the *extremes* of a scale mean is sufficient for LLMs to use the full range reliably, without heavier normalization machinery.
- **Cost shape is O(N), not O(N²):** one call per applicant, each call holding that applicant's whole shortlist — cheaper than naive pairwise LLM-judging (C) while being the more reliable framing.
- I searched directly for prior work on LLM-based compatibility scoring specifically for dating/matchmaking and found none — the *techniques* (listwise LLM reranking, anchored rubrics) are established in IR/eval literature, but applying this specific combination to romantic-compatibility scoring appears to be novel.

**Why not A or B instead:** both are legitimate, cheaper fixes for the *same* underlying geometric problem, but they only fix the number's calibration — they don't change what's fundamentally being measured (geometric overlap of independently-encoded texts). F replaces the measurement itself with something that can reason about complementary traits, context, and genuine deal-breakers the way a human matchmaker would, which is a strictly richer signal once the LLM's own calibration failure is accounted for.

## Chosen design

### Architecture

```
Stage 1 (unchanged) — bi-encoder shortlist
  engine.ts: applyFilters() → prepare() → score()  [scorer.ts, embeddings]
  Produces an embedding-ranked shortlist per applicant (existing top-N logic).
  This score becomes an internal signal only — never shown to users.

Stage 2 (new) — LLM listwise rerank
  New: api/src/services/match-rerank.service.ts
  One LLM call per applicant: target profile + its whole shortlist together.
  Structured output: per-candidate {score 0-100, reasoning}, anchored rubric.
  Re-sort the shortlist by this score; this is the number actually displayed.
```

### Stage 1 → Stage 2 handoff

`engine.ts`'s `getCandidates()` and `runFullMatchingPass()` currently sort by embedding score and slice to `topN` (default 10) directly. Under this design, they instead:

1. Score and sort by embedding cosine as today (unchanged).
2. Take a slightly wider shortlist than the final result size — `SHORTLIST_SIZE = max(topN, 15)` — so the LLM has enough real options to differentiate against (a shortlist of exactly `topN` would always return everything anyway, defeating the point of a relative rubric).
3. Pass that shortlist to `rerankCandidates()` in the new service.
4. Re-sort the result by the LLM's score, slice to `topN`.

### Prompt design (`match-rerank.service.ts`)

One call per applicant. Anchored rubric, grounding instruction, structured output — reusing the `responseSchema`/`temperature` pattern already built in [`ai.service.ts`](../../../api/src/services/ai.service.ts):

```
You are an expert matchmaker. Score how compatible each candidate below is
with the target person, grounded only in what's stated — do not invent
details. Use the full range; a shortlist usually spans several bands:

  90-100: rare, near-ideal overlap across values, lifestyle, and what each
          person is looking for
  70-89:  strong compatibility with minor differences
  50-69:  average — some genuine alignment, some real friction
  30-49:  significant mismatches in core preferences or lifestyle
  0-29:   fundamental incompatibility

Target: <profile>
Candidates:
  1. <id>: <profile>
  2. <id>: <profile>
  ...
```

Structured-output schema:

```ts
{
  type: "object",
  properties: {
    rankings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidateId: { type: "string" },
          score:       { type: "number" },
          reasoning:   { type: "string" },
        },
        required: ["candidateId", "score", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  required: ["rankings"],
  additionalProperties: false,
}
```

Temperature: low (~0.3) — this is a grounded judgment call, not creative writing, same reasoning as the `match-summary.service.ts` change earlier this session.

### Caching

`getCandidates()` (`GET /matching/candidates/:applicantId`) can be viewed repeatedly by an admin browsing the panel — re-calling the LLM on every page load would be wasteful. New collection `matching_reranks`, keyed by `(applicantId, shortlistHash, model)`:

- `shortlistHash` = hash of the shortlisted candidate IDs + their embedding-stage scores, so the cache invalidates automatically if the underlying pool or ranking shifts.
- Mirrors the existing staleness pattern in `embedding.service.ts` / the `match.summary` cache in `match-summary.service.ts` (keyed by model so a model change forces recomputation).

### Type/API changes

`RankedCandidate` ([`engine.ts`](../../../api/src/matching/engine.ts)) gains the LLM-derived fields; the existing `score`/`breakdown` are retained as the internal embedding-stage signal for debugging, but the **displayed** score is the new field:

```ts
export interface RankedCandidate {
  alias: string;
  applicantId: string;
  score: number;           // embedding-stage signal (internal/debug)
  breakdown: Record<string, number>;
  llmScore: number;        // the number shown to users — from Stage 2
  llmReasoning: string;    // short grounded explanation
}
```

Exact frontend wiring (`Matching.tsx` and friends) is left to the implementation plan rather than finalized here.

### Failure handling

Same philosophy as `match-summary.service.ts`/`icebreaker.service.ts`: `generateChatCompletion` never throws. If the rerank call fails or returns unparseable output, fall back to the embedding-stage score/order for that applicant's shortlist (no fabricated LLM reasoning shown) — never block the matching pipeline on this stage.

## Trade-offs (explicit)

- **Cost/latency:** today's scoring is free after the one-time embedding step; this adds one real LLM call per applicant per matching run (bounded by shortlist size, not pool size — O(N), not O(N²) — but not zero).
- **Non-determinism:** two runs over the same shortlist can produce slightly different scores/order. Bounded by low temperature + the anchored rubric, not eliminated.
- **Stage 1's known calibration issue isn't fully gone** — it no longer affects the *displayed* number (Stage 2 fixes that), but it can still bias *which candidates make the shortlist* in the first place (a recall concern, not a precision one). Approach A's cheap per-pool min-max rescaling could be layered onto Stage 1 later as a complementary improvement to shortlist quality, independent of this design — noted here as a future option, not part of this change.

## Testing approach

- Unit tests for the new rerank prompt/schema builder and the response-parsing/fallback logic (pure functions, no network), following the existing pattern in `match-summary.service.ts`'s tests.
- Unit tests for the `shortlistHash` cache-key derivation (changes when membership or scores change, stable otherwise).
- Engine-level tests verifying `getCandidates()`/`runFullMatchingPass()` fall back gracefully to embedding order when the rerank call fails.

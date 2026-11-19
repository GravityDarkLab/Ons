# Matching

A single, deterministic pipeline: **filter → score**. No network, no model, no cache. The same two answer
sets always produce the same score, and every part of it can be explained.

What this can and cannot do: a questionnaire does not predict attraction between two specific people
(Joel, Eastwick & Finkel, 2017). It can rule out real incompatibilities and rank the remaining pairs by
shared values, lifestyle and how they relate. The product copy should not claim more than that.

```
engine.ts            orchestrator: load applicants → skip active contacts → filter → score → top N
filters/             hard, binary pass/fail — an excluded pair gets no result, not a low score
scorer.ts            the only scorer: five weighted dimensions × age modifier
scoring/weights.ts   the weights (sum to 1.0)
proposals.ts         unique couple proposals (canonical pair, symmetric score) from a full pass
```

Questions, their option order and which answers are shareable live in
[`../questionnaire/questions.ts`](../questionnaire/questions.ts). The scorer compares ordered answers by
their position in that list, so **option order is part of the scoring**.

## Hard filters

Both directions are checked. A missing answer skips that check.

| Filter | Excludes a pair when |
|---|---|
| `orientation.filter.ts` | either person's orientation does not include the other's gender |
| `age.filter.ts` | the gap is more than 2× either person's `age_gap`, or the partner is on the wrong side of their `age_direction` |
| `religion.filter.ts` | either holds `religion_match = deal_breaker` and they do not share the same named religion |
| `location.filter.ts` | they are in different cities and either is not open to long distance |
| `children.filter.ts` | one answered `want` and the other `dont_want` |
| `habits.filter.ts` | either holds `partner_smoking` / `partner_alcohol` = `deal_breaker` and the other does it at all |

Religion details: `other` and `prefer_not_to_say` never count as "the same religion". A deal breaker only
applies when the holder's own religion is a named one, so nobody is left with zero candidates.

## Score

`final = (Σ weight × dimension) × ageModifier`, rounded to two decimals. Every component is symmetric and in
[0, 1]. A missing, wrongly typed or unknown answer contributes a neutral 0.5 for that item, so legacy
records and bad data lower confidence instead of breaking the run.

`ordinalSim(x, y) = 1 − |index(x) − index(y)| ÷ (options − 1)`. A 1–5 agreement item scales to `(x − 1) ÷ 4`.

| Dimension | Weight | How it is computed |
|---|---|---|
| `values` | 0.25 | mean of three: shared `top_values` ÷ 3; `ordinalSim(religion_practice)`; religion fit |
| `lifestyle` | 0.25 | mean of eight: `ordinalSim` of `social_energy`, `sleep_rhythm`, `activity_level`, `planning_style`, `money_style`, `opposite_gender_friends`; smoking fit; alcohol fit |
| `connection` | 0.30 | 0.4 × attachment + 0.2 × conflict + 0.2 × `ordinalSim(physical_affection)` + 0.2 × `ordinalSim(contact_frequency)` |
| `personality` | 0.10 | mean similarity of the four agreement items |
| `goals` | 0.10 | mean of relationship-goal fit and children fit |

- **Religion fit** (each direction, then averaged): `fine` → 1; `rather_share` / `deal_breaker` → 1 with the
  same named religion, else 0.
- **Habit fit** (each direction, then averaged): partner preference `fine` → 1; otherwise 1 / 0.5 / 0 for the
  other person's never / sometimes / regularly.
- **Attachment**: `1 − max(anxA × avoB, anxB × avoA)`. Pair-level only — the anxious-with-avoidant
  combination is penalised; nobody is scored down against everyone for their own answers.
- **Conflict** and **children** fit are small symmetric tables in `scorer.ts`.
- **Relationship-goal fit** is the cosine of each answer's `[long-term, short-term]` affinity.
- **Age modifier**: 1 within the preferred gap, cosine decay to 0 at twice the gap.

The breakdown stored on a match has the keys `values`, `lifestyle`, `connection`, `personality`, `goals`
and `age_modifier`. Applicants are only shown `values`, `lifestyle` and `goals`
(`APPLICANT_BREAKDOWN_KEYS` in `services/match-state.service.ts`): the other two are computed from private
answers and could be worked backwards.

## Thresholds

Rule-based scores sit lower and closer together than the LLM-rerank scores this replaced. On the seeded dev
pool (100 applicants) the median proposal scores 0.57 and the best 0.83.

| Constant | Value | Meaning |
|---|---|---|
| `PORTAL_MIN_SCORE` | 0.5 | below this a proposal is never shown, and does not promote `applied → matched` |
| `DEFAULT_SCORE_THRESHOLD` | 0.6 | a new applicant's own slider setting (range 0.5–1.0) |

## Where the numbers come from

The weights, the conflict table and the thresholds are reasoned starting points, **not fitted to outcome
data**. Match outcomes (`success` / `failed`) are stored and can be used to tune them. The attachment and
personality items are written for Ons and modelled on ECR-S (Wei et al., 2007) and BFI-10 (Rammstedt & John,
2007); they are not those validated scales.

## Changing things

- **A question or option**: edit `questionnaire/questions.ts`, add the strings to all four locale files
  (a test fails until you do), bump the questionnaire version and reseed.
- **A weight**: `scoring/weights.ts` — they must sum to 1.0.
- **A new dimension or filter**: add it to `scorer.ts` or `filters/`, wire a filter into `applyFilters` in
  `engine.ts`, and add the breakdown label to the locale files.

## OpenAI

Matching never calls OpenAI. It is still used for match summaries and ice-breakers, which receive only the
answers marked `shared` in the question definitions; the optional free-text note goes to the ice-breaker
prompt only, which runs after a contact request has already revealed the Instagram handle.

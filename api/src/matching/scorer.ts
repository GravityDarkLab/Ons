/**
 * Ons Matching Scorer — Embedding-based Cosine Similarity
 * =========================================================
 *
 * Scores a pair of applicants using dense text embeddings + cosine similarity.
 * Semantic embeddings mean "driven" and "ambitious" score high because they
 * occupy nearby positions in vector space, unlike bag-of-words approaches.
 *
 * ## Scoring components
 *
 *   1. NUMERIC (22%)
 *      cosine(A.numeric_vec, B.numeric_vec)
 *      Structural preferences encoded as a fixed vector:
 *      relationship type, long-distance willingness, affection level, religion openness.
 *
 *   2. LIFESTYLE SIMILARITY (22%)
 *      cosine(embed(A.lifestyle + work), embed(B.lifestyle + work))
 *      Semantic similarity of how they live and what they do.
 *
 *   3. CHARACTER CROSS-MATCH (35%, 17.5% per direction)
 *      cosine(embed(A.preferred_char + preferred_phys + dream_first_date), embed(B.lifestyle + vibe + work))
 *      "Does B's self-described vibe match what A is looking for?" — bidirectional.
 *
 *   4. DEAL BREAKER PENALTY (21%)
 *      1 - cosine(embed(A.deal_breakers), embed(B.lifestyle + work))  (averaged both ways)
 *      High similarity = B's lifestyle matches A's deal breakers = bad.
 *
 *   5. AGE MODIFIER (multiplier, not a weight)
 *      Applied after the weighted sum. 1.0 within preferred gap, cosine decay
 *      up to 2× gap, then hard-filtered before reaching here.
 *
 * ## Performance
 *
 * prepare() must be called once before scoring begins. It batch-embeds all
 * applicants in O(N) API calls so score() can run synchronously from cache.
 * Without prepare(): N² × 4 text fields = thousands of API calls.
 * With prepare(): N × 4 text fields (3 batched requests per field set).
 */

import type { ApplicantDoc } from "../models/applicant.model.js";
import type { QuestionnaireDoc } from "../models/questionnaire.model.js";
import type { MatchScore } from "./engine.js";
import { getEmbeddingProvider } from "./embeddings/provider.js";
import { getOrComputeEmbeddings } from "../services/embedding.service.js";
import { buildNumericVector, cosine, round } from "./scorers/numeric.scorer.js";
import { WEIGHTS } from "./scoring/weights.js";
import { ageModifier } from "./filters/age.filter.js";

// ─── Per-applicant embedding cache ───────────────────────────────────────────
//
// Populated by prepare() before scoring begins.
// Keyed by applicant ObjectId hex string.

interface CachedEmbeddings {
  profile: number[];      // lifestyle + vibe_words + work
  preference: number[];   // preferred_character + preferred_physical + dream_first_date
  dealBreakers: number[]; // deal_breakers
}

const cache = new Map<string, CachedEmbeddings>();

// ─── Prepare step ─────────────────────────────────────────────────────────────

/**
 * Called once by the engine before any pairwise scoring.
 *
 * Loads pre-computed embeddings from the DB (written at form submission time).
 * Only calls the embedding API for applicants whose embeddings are missing or
 * stale (model or text-version changed). In steady state: zero API calls.
 */
export async function prepare(
  applicants: ApplicantDoc[],
  _questionnaire: QuestionnaireDoc
): Promise<void> {
  cache.clear();

  const provider = getEmbeddingProvider();
  console.log(
    `[scorer] Loading embeddings for ${applicants.length} applicants ` +
    `(provider: ${provider.name}, model: ${provider.model})...`
  );

  const stored = await getOrComputeEmbeddings(applicants);

  for (const applicant of applicants) {
    const emb = stored.get(applicant._id.toHexString());
    if (emb) {
      cache.set(applicant._id.toHexString(), {
        profile:      emb.profile,
        preference:   emb.preference,
        dealBreakers: emb.dealBreakers,
      });
    }
  }

  console.log(`[scorer] Ready — ${cache.size}/${applicants.length} embeddings loaded.`);
}

// ─── Score ────────────────────────────────────────────────────────────────────

/**
 * Scores applicant pair (a, b). prepare() must have been called first.
 */
export function score(
  a: ApplicantDoc,
  b: ApplicantDoc,
  _questionnaire: QuestionnaireDoc
): MatchScore {
  const embA = cache.get(a._id.toHexString());
  const embB = cache.get(b._id.toHexString());

  if (!embA || !embB) {
    throw new Error(
      "[scorer] Embeddings not found in cache. " +
      "The engine must call prepare() before score()."
    );
  }

  // 1. Numeric compatibility — structural preferences as a fixed vector
  const numericScore = cosine(
    buildNumericVector(a.answers),
    buildNumericVector(b.answers)
  );

  // 2. Lifestyle semantic similarity (includes work field)
  const lifestyleScore = cosine(embA.profile, embB.profile);

  // 3. Character cross-match (bidirectional)
  //    A wants B: does B's vibe match what A explicitly said they want?
  //    B wants A: does A's vibe match what B explicitly said they want?
  const crossAtoB = cosine(embA.preference, embB.profile);
  const crossBtoA = cosine(embB.preference, embA.profile);
  const characterScore = (crossAtoB + crossBtoA) / 2;

  // 4. Deal breaker semantic penalty
  //    High similarity between A's deal breakers and B's lifestyle = bad.
  const penaltyAtoB = cosine(embA.dealBreakers, embB.profile);
  const penaltyBtoA = cosine(embB.dealBreakers, embA.profile);
  const dealBreakerScore = 1 - (penaltyAtoB + penaltyBtoA) / 2;

  // Weighted compatibility score (sums to 1.0)
  const compatibilityScore =
    WEIGHTS.numeric               * numericScore    +
    WEIGHTS.lifestyle             * lifestyleScore  +
    WEIGHTS.character_cross_match * characterScore  +
    WEIGHTS.deal_breakers         * dealBreakerScore;

  // 5. Age modifier — multiplied onto the compatibility score
  const ageMod = ageModifier(a, b);
  const finalScore = compatibilityScore * ageMod;

  const breakdown: Record<string, number> = {
    numeric_compatibility: round(numericScore),
    lifestyle_similarity:  round(lifestyleScore),
    character_cross_match: round(characterScore),
    character_a_wants_b:   round(crossAtoB),
    character_b_wants_a:   round(crossBtoA),
    deal_breaker_penalty:  round(dealBreakerScore),
    age_modifier:          round(ageMod),
  };

  return { score: round(finalScore), breakdown };
}

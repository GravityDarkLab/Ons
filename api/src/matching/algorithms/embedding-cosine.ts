/**
 * Embedding-based Cosine Similarity Algorithm
 * =============================================
 *
 * Upgrade over the `cosine` algorithm: replaces bag-of-words text matching
 * with dense vector embeddings, so "driven" and "ambitious" score high
 * because they're semantically close in embedding space — not just lexically.
 *
 * ## How it differs from `cosine`
 *
 *   cosine (bag-of-words)         embedding-cosine
 *   ─────────────────────         ────────────────
 *   "driven" vs "ambitious" → 0   → ~0.85 (semantically close)
 *   "funny" vs "humorous"   → 0   → ~0.91
 *   "gym" vs "fitness"      → 0   → ~0.87
 *   keyword overlap only          true semantic similarity
 *
 * ## Scoring components (same structure as `cosine`, better text)
 *
 *   1. NUMERIC (25%)
 *      cosine(A.numeric_vec, B.numeric_vec)
 *      Same as `cosine` algorithm — structural preferences as a fixed vector.
 *      No embeddings here; this is exact numeric compatibility.
 *
 *   2. LIFESTYLE SIMILARITY (20%)
 *      cosine(embed(A.lifestyle), embed(B.lifestyle))
 *      Semantic similarity of how they live.
 *
 *   3. CHARACTER CROSS-MATCH (35%, 17.5% per direction)
 *      cosine(embed(A.preferred_character_traits), embed(B.vibe_words))
 *      cosine(embed(B.preferred_character_traits), embed(A.vibe_words))
 *      "Does B's self-described vibe match what A is looking for?"
 *      Bidirectional — scored both ways and averaged.
 *
 *   4. DEAL BREAKER PENALTY (20%)
 *      1 - cosine(embed(A.deal_breakers), embed(B.lifestyle))  (averaged both ways)
 *      High similarity = B's lifestyle matches A's deal breakers = bad.
 *
 * ## Prepare step (critical for performance)
 *
 * Embeddings are expensive (API call per text). The engine calls `prepare()`
 * once before any scoring begins. This step batch-embeds all applicants'
 * text fields in O(N) API calls, caching the results by applicant ID.
 *
 * Without caching: 50 applicants × 49 pairs × 4 text fields = 9800 API calls.
 * With prepare():  50 applicants × 4 text fields = 200 embeddings (3 batches).
 *
 * ## Text fields embedded
 *
 *   profile_text      = lifestyle + " " + vibe_words
 *   preference_text   = preferred_character_traits + " " + preferred_physical_traits
 *   deal_breakers_text = deal_breakers
 */

import type { ApplicantDoc } from "../../models/applicant.model.js";
import type { QuestionnaireDoc } from "../../models/questionnaire.model.js";
import type { Algorithm, MatchScore } from "../engine.js";
import { getEmbeddingProvider } from "../embeddings/provider.js";
import { getOrComputeEmbeddings } from "../../services/embedding.service.js";

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  numeric: 0.25,
  lifestyle: 0.20,
  character_cross_match: 0.35, // 0.175 per direction
  deal_breakers: 0.20,
} as const;

// ─── Relationship type encoding (identical to cosine.ts) ─────────────────────

const REL_TYPE_ENCODING: Record<string, [number, number]> = {
  "Long Term":    [1.0, 0.0],
  "Short Term":   [0.0, 1.0],
  "Open to Both": [0.7, 0.7],
  "Casual":       [0.1, 0.9],
  "Not Sure":     [0.4, 0.4],
};

// ─── Per-applicant embedding cache ───────────────────────────────────────────
//
// Populated by prepare() before scoring begins.
// Keyed by applicant ObjectId hex string.

interface CachedEmbeddings {
  profile: number[];      // lifestyle + vibe_words
  preference: number[];   // preferred_character + preferred_physical
  dealBreakers: number[]; // deal_breakers
}

const cache = new Map<string, CachedEmbeddings>();

// ─── Answer accessors ─────────────────────────────────────────────────────────

function str(answers: Record<string, unknown>, key: string): string {
  const v = answers[key];
  return typeof v === "string" ? v.trim() : "";
}

function bool(answers: Record<string, unknown>, key: string): boolean | null {
  const v = answers[key];
  return typeof v === "boolean" ? v : null;
}

function num(answers: Record<string, unknown>, key: string): number | null {
  const v = answers[key];
  return typeof v === "number" ? v : null;
}

// ─── Numeric vector (no embeddings — exact compatibility) ─────────────────────

function buildNumericVector(answers: Record<string, unknown>): number[] {
  const relType = str(answers, "relationship_type");
  const [relLong, relShort] = REL_TYPE_ENCODING[relType] ?? [0.4, 0.4];
  const longDist = bool(answers, "open_to_long_distance") === true ? 1.0 : 0.0;
  const affection = (num(answers, "physical_affection_importance") ?? 5) / 10;
  const religionOpen = bool(answers, "religion_deal_breaker") === false ? 1.0 : 0.0;
  return [relLong, relShort, longDist, affection, religionOpen];
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

export const embeddingCosineAlgorithm: Algorithm = {
  name: "embedding-cosine",

  /**
   * Called once by the engine before any pairwise scoring.
   *
   * Loads pre-computed embeddings from the DB (written at form submission time).
   * Only calls the embedding API for applicants whose embeddings are missing
   * or stale (model changed). In steady state this makes zero API calls.
   */
  async prepare(
    applicants: ApplicantDoc[],
    _questionnaire: QuestionnaireDoc
  ): Promise<void> {
    cache.clear();

    const provider = getEmbeddingProvider();
    console.log(
      `[embedding-cosine] Loading embeddings for ${applicants.length} applicants ` +
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

    console.log(`[embedding-cosine] Ready — ${cache.size}/${applicants.length} embeddings loaded.`);
  },

  score(
    a: ApplicantDoc,
    b: ApplicantDoc,
    _questionnaire: QuestionnaireDoc
  ): MatchScore {
    const embA = cache.get(a._id.toHexString());
    const embB = cache.get(b._id.toHexString());

    if (!embA || !embB) {
      throw new Error(
        "[embedding-cosine] Embeddings not found in cache. " +
        "The engine must call prepare() before score()."
      );
    }

    // 1. Numeric compatibility (no embeddings — exact structural match)
    const numericScore = cosine(
      buildNumericVector(a.answers),
      buildNumericVector(b.answers)
    );

    // 2. Lifestyle semantic similarity
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

    const breakdown: Record<string, number> = {
      numeric_compatibility: round(numericScore),
      lifestyle_similarity:  round(lifestyleScore),
      character_cross_match: round(characterScore),
      character_a_wants_b:   round(crossAtoB),
      character_b_wants_a:   round(crossBtoA),
      deal_breaker_penalty:  round(dealBreakerScore),
    };

    const score =
      WEIGHTS.numeric               * numericScore  +
      WEIGHTS.lifestyle             * lifestyleScore +
      WEIGHTS.character_cross_match * characterScore +
      WEIGHTS.deal_breakers         * dealBreakerScore;

    return { score: round(score), breakdown };
  },
};

/**
 * Cosine Similarity Matching Algorithm
 * =====================================
 *
 * ## Why cosine similarity?
 *
 * The baseline algorithm uses hand-coded thresholds and rules
 * (e.g. "exact match = 1.0, partial = 0.7"). This works but is brittle —
 * every new rule is a human judgement call, and dimensions are scored
 * independently with no interaction between them.
 *
 * Cosine similarity treats each applicant as a point in a high-dimensional
 * space and measures the *angle* between two points. A small angle means the
 * two people are pointing in the same direction — structurally compatible.
 *
 * ## The math
 *
 *   cos(A, B) = (A · B) / (‖A‖ · ‖B‖)
 *
 * Where:
 *   A · B  = dot product (sum of element-wise products)
 *   ‖A‖    = L2 norm of A (sqrt of sum of squares)
 *
 * Result is in [0, 1] because all our feature values are non-negative.
 *
 * **Why cosine over Euclidean distance?**
 * Cosine is magnitude-invariant. A person who wrote a long lifestyle
 * description and one who wrote a short one can still score 1.0 if they
 * mention the same proportional mix of keywords. Euclidean distance would
 * penalise the length difference unfairly.
 *
 * ## Feature decomposition
 *
 * Each applicant is described by two vectors:
 *
 *   profile_vector    — who the person IS
 *   preference_vector — who the person WANTS
 *
 * Compatibility between A and B is broken into four components:
 *
 *   1. NUMERIC (25%)
 *      cosine(A.numeric_profile, B.numeric_profile)
 *      Encodes relationship type, long-distance, affection importance,
 *      and religion openness as a single numeric vector.
 *      Answers: "are they looking for structurally the same thing?"
 *
 *   2. LIFESTYLE (20%)
 *      cosine(bag_of_words(A.lifestyle), bag_of_words(B.lifestyle))
 *      Answers: "do they live in a compatible way?"
 *
 *   3. CHARACTER CROSS-MATCH (35%, split 17.5% each direction)
 *      cosine(bag_of_words(A.preferred_character_traits), bag_of_words(B.vibe_words))
 *      cosine(bag_of_words(B.preferred_character_traits), bag_of_words(A.vibe_words))
 *      Answers: "does B's self-description match what A explicitly said they want?"
 *      This is asymmetric and bidirectional — scored in both directions.
 *
 *   4. DEAL BREAKER PENALTY (20%)
 *      1 - Jaccard(A.deal_breakers, B.lifestyle)  (bidirectional average)
 *      Answers: "does B's lifestyle contain things A listed as deal breakers?"
 *      Still uses Jaccard keyword overlap — compatible with future NLP upgrade.
 *
 * ## Known limitation — keyword matching
 *
 * Text fields use bag-of-words (binary term frequency). "driven" and "ambitious"
 * score 0 even though they're synonyms. To fix this without changing the algorithm
 * structure, replace `textCosine()` with an embedding-based cosine:
 *
 *   // Instead of bag-of-words:
 *   const vecA = await getEmbedding(textA);  // float[1536] from OpenAI/Claude
 *   const vecB = await getEmbedding(textB);
 *   return cosine(vecA, vecB);
 *
 * The rest of the algorithm is identical — only the text component changes.
 * See the `ai` algorithm (if implemented) for the embedding-based version.
 *
 * ## Weights
 *
 *   numeric              0.25
 *   lifestyle            0.20
 *   character_cross_match 0.35  (0.175 A→B + 0.175 B→A)
 *   deal_breakers        0.20
 *   ─────────────────────────
 *   total                1.00
 */

import type { ApplicantDoc } from "../../models/applicant.model.js";
import type { QuestionnaireDoc } from "../../models/questionnaire.model.js";
import type { Algorithm, MatchScore } from "../engine.js";
import { scoreTraitOverlap } from "../scorers/trait.scorer.js";

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  numeric: 0.25,
  lifestyle: 0.20,
  character_cross_match: 0.35, // applied as 0.175 per direction
  deal_breakers: 0.20,
} as const;

// ─── Relationship type encoding ───────────────────────────────────────────────
//
// Each type is encoded as a 2D sub-vector [long_term_affinity, short_term_affinity].
// "Open to Both" gets partial credit on both axes (0.7) to allow it to match
// with either extreme without fully saturating either dimension.

const REL_TYPE_ENCODING: Record<string, [number, number]> = {
  //                              [long_term, short_term]
  "Long Term":    [1.0, 0.0],
  "Short Term":   [0.0, 1.0],
  "Open to Both": [0.7, 0.7],
  "Casual":       [0.1, 0.9],
  "Not Sure":     [0.4, 0.4],
};

// ─── Answer accessors ─────────────────────────────────────────────────────────

function str(answers: Record<string, unknown>, key: string): string {
  const v = answers[key];
  return typeof v === "string" ? v : "";
}

function bool(answers: Record<string, unknown>, key: string): boolean | null {
  const v = answers[key];
  return typeof v === "boolean" ? v : null;
}

function num(answers: Record<string, unknown>, key: string): number | null {
  const v = answers[key];
  return typeof v === "number" ? v : null;
}

// ─── Numeric vector ───────────────────────────────────────────────────────────
//
// Dimensions:
//   [0] rel_long_term      — how strongly the person wants a long-term relationship
//   [1] rel_short_term     — how strongly the person wants a short-term relationship
//   [2] open_to_long_dist  — 1 = yes, 0 = no
//   [3] affection_level    — physical_affection_importance normalised to [0, 1]
//   [4] religion_openness  — 1 = flexible, 0 = religion is a deal breaker

function buildNumericVector(answers: Record<string, unknown>): number[] {
  const relType = str(answers, "relationship_type");
  const [relLong, relShort] = REL_TYPE_ENCODING[relType] ?? [0.4, 0.4];

  const longDist = bool(answers, "open_to_long_distance") === true ? 1.0 : 0.0;
  const affection = (num(answers, "physical_affection_importance") ?? 5) / 10;

  // religion_deal_breaker: false = open = 1.0, true = inflexible = 0.0
  const religionOpen = bool(answers, "religion_deal_breaker") === false ? 1.0 : 0.0;

  return [relLong, relShort, longDist, affection, religionOpen];
}

// ─── Bag-of-words cosine ──────────────────────────────────────────────────────
//
// Builds a shared vocabulary from both strings (their union), then represents
// each as a binary vector and computes cosine similarity.
//
// Binary (0/1) rather than raw term frequency because most fields are short
// free-text answers where repetition doesn't carry extra signal.

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function textCosine(textA: string, textB: string): number {
  if (!textA || !textB) return 0;

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Union vocabulary — the shared dimensional space for this pair
  const vocab = Array.from(new Set([...tokensA, ...tokensB]));

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  // Binary term vectors
  const vecA = vocab.map((t) => (setA.has(t) ? 1 : 0));
  const vecB = vocab.map((t) => (setB.has(t) ? 1 : 0));

  return cosine(vecA, vecB);
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

export const cosineAlgorithm: Algorithm = {
  name: "cosine",

  score(
    a: ApplicantDoc,
    b: ApplicantDoc,
    _questionnaire: QuestionnaireDoc
  ): MatchScore {
    const aa = a.answers;
    const ba = b.answers;

    // 1. Numeric compatibility
    // Compares structural preferences (relationship type, long distance, etc.)
    const numericScore = cosine(
      buildNumericVector(aa),
      buildNumericVector(ba)
    );

    // 2. Lifestyle similarity
    // "Non-smoker, gym, coffee" vs "Non-smoker, hiking, coffee" → shares 2/4 tokens
    const lifestyleScore = textCosine(
      str(aa, "lifestyle"),
      str(ba, "lifestyle")
    );

    // 3. Character cross-match (bidirectional)
    // Does B's self-described vibe match what A is explicitly looking for?
    // And vice versa. Scored in both directions and averaged.
    const crossAtoB = textCosine(
      str(aa, "preferred_character_traits"), // what A wants
      str(ba, "vibe_words")                 // who B is
    );
    const crossBtoA = textCosine(
      str(ba, "preferred_character_traits"), // what B wants
      str(aa, "vibe_words")                 // who A is
    );
    const characterScore = (crossAtoB + crossBtoA) / 2;

    // 4. Deal breaker penalty
    // High overlap between A's deal breakers and B's lifestyle = bad.
    // Kept as Jaccard (not cosine) because deal breakers are inherently
    // asymmetric — they describe what to avoid, not what to seek.
    const dealBreakerOverlapAB = scoreTraitOverlap(
      str(aa, "deal_breakers"),
      str(ba, "lifestyle")
    );
    const dealBreakerOverlapBA = scoreTraitOverlap(
      str(ba, "deal_breakers"),
      str(aa, "lifestyle")
    );
    const dealBreakerScore = 1 - (dealBreakerOverlapAB + dealBreakerOverlapBA) / 2;

    const breakdown: Record<string, number> = {
      numeric_compatibility:  round(numericScore),
      lifestyle_similarity:   round(lifestyleScore),
      character_cross_match:  round(characterScore),
      character_a_wants_b:    round(crossAtoB),
      character_b_wants_a:    round(crossBtoA),
      deal_breaker_penalty:   round(dealBreakerScore),
    };

    const score =
      WEIGHTS.numeric              * numericScore +
      WEIGHTS.lifestyle            * lifestyleScore +
      WEIGHTS.character_cross_match * characterScore +
      WEIGHTS.deal_breakers        * dealBreakerScore;

    return { score: round(score), breakdown };
  },
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

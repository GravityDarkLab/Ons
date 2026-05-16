import type { ApplicantDoc } from "../../models/applicant.model.js";
import type { QuestionnaireDoc } from "../../models/questionnaire.model.js";
import type { Algorithm, MatchScore } from "../engine.js";
import { scoreTraitOverlap, scorePreferenceMatch } from "../scorers/trait.scorer.js";

/**
 * Dimension weights — must sum to 1.0.
 */
const WEIGHTS = {
  relationship_type: 0.30,
  deal_breakers: 0.20,
  religion_compatibility: 0.15,
  affection_importance: 0.15,
  long_distance: 0.10,
  lifestyle: 0.10,
} as const;

function getStr(answers: Record<string, unknown>, key: string): string {
  const val = answers[key];
  return typeof val === "string" ? val : "";
}

function getBool(answers: Record<string, unknown>, key: string): boolean | null {
  const val = answers[key];
  return typeof val === "boolean" ? val : null;
}

function getNum(answers: Record<string, unknown>, key: string): number | null {
  const val = answers[key];
  return typeof val === "number" ? val : null;
}

/**
 * Scores relationship_type compatibility.
 * Exact match = 1.0; "Open to Both" on either side = 0.7; mismatch = 0.
 */
function scoreRelationshipType(
  answersA: Record<string, unknown>,
  answersB: Record<string, unknown>
): number {
  const typeA = getStr(answersA, "relationship_type");
  const typeB = getStr(answersB, "relationship_type");

  if (!typeA || !typeB) return 0;
  if (typeA === typeB) return 1.0;
  if (typeA === "Open to Both" || typeB === "Open to Both") return 0.7;
  return 0.0;
}

/**
 * Scores religion compatibility.
 * Exact match = 1.0; if either has religion_deal_breaker = false, mismatch is 0.5.
 * Otherwise mismatch = 0.
 */
function scoreReligionCompatibility(
  answersA: Record<string, unknown>,
  answersB: Record<string, unknown>
): number {
  const religionA = getStr(answersA, "religion").toLowerCase();
  const religionB = getStr(answersB, "religion").toLowerCase();

  if (religionA === religionB) return 1.0;

  const dealBreakerA = getBool(answersA, "religion_deal_breaker");
  const dealBreakerB = getBool(answersB, "religion_deal_breaker");

  if (dealBreakerA === false || dealBreakerB === false) return 0.5;
  if (dealBreakerA === true || dealBreakerB === true) return 0.0;

  return 0.3; // Unknown — small penalty
}

/**
 * Long distance compatibility.
 * Both willing = 1.0; one willing = 0.5; neither = 0.
 */
function scoreLongDistance(
  answersA: Record<string, unknown>,
  answersB: Record<string, unknown>
): number {
  const a = getBool(answersA, "open_to_long_distance");
  const b = getBool(answersB, "open_to_long_distance");

  if (a === true && b === true) return 1.0;
  if (a === true || b === true) return 0.5;
  return 0.0;
}

/**
 * Deal breaker cross-check.
 * Checks if either person's deal breakers overlap with the other's lifestyle/traits.
 * Score = 1 - (overlap penalty).
 */
function scoreDealBreakers(
  answersA: Record<string, unknown>,
  answersB: Record<string, unknown>
): number {
  const dealBreakersA = getStr(answersA, "deal_breakers");
  const lifestyleB = getStr(answersB, "lifestyle");
  const dealBreakersB = getStr(answersB, "deal_breakers");
  const lifestyleA = getStr(answersA, "lifestyle");

  const overlapAB = scoreTraitOverlap(dealBreakersA, lifestyleB);
  const overlapBA = scoreTraitOverlap(dealBreakersB, lifestyleA);

  // High overlap = bad (their deal breakers are present in the other's lifestyle)
  const avgOverlap = (overlapAB + overlapBA) / 2;
  return 1.0 - avgOverlap;
}

/**
 * Lifestyle compatibility via keyword overlap.
 */
function scoreLifestyle(
  answersA: Record<string, unknown>,
  answersB: Record<string, unknown>
): number {
  const lifestyleA = getStr(answersA, "lifestyle");
  const lifestyleB = getStr(answersB, "lifestyle");
  return scoreTraitOverlap(lifestyleA, lifestyleB);
}

/**
 * Physical affection importance proximity.
 * Score = 1 - |a - b| / 9 (max distance is 9 for scale 1-10).
 */
function scoreAffectionImportance(
  answersA: Record<string, unknown>,
  answersB: Record<string, unknown>
): number {
  const a = getNum(answersA, "physical_affection_importance");
  const b = getNum(answersB, "physical_affection_importance");

  if (a === null || b === null) return 0.5; // neutral if missing
  return 1.0 - Math.abs(a - b) / 9;
}

/**
 * Baseline algorithm: weighted multi-dimensional compatibility score.
 */
export const baselineAlgorithm: Algorithm = {
  name: "baseline",

  score(
    a: ApplicantDoc,
    b: ApplicantDoc,
    _questionnaire: QuestionnaireDoc
  ): MatchScore {
    const answersA = a.answers;
    const answersB = b.answers;

    const breakdown: Record<string, number> = {
      relationship_type: scoreRelationshipType(answersA, answersB),
      deal_breakers: scoreDealBreakers(answersA, answersB),
      religion_compatibility: scoreReligionCompatibility(answersA, answersB),
      affection_importance: scoreAffectionImportance(answersA, answersB),
      long_distance: scoreLongDistance(answersA, answersB),
      lifestyle: scoreLifestyle(answersA, answersB),
    };

    const score =
      breakdown.relationship_type * WEIGHTS.relationship_type +
      breakdown.deal_breakers * WEIGHTS.deal_breakers +
      breakdown.religion_compatibility * WEIGHTS.religion_compatibility +
      breakdown.affection_importance * WEIGHTS.affection_importance +
      breakdown.long_distance * WEIGHTS.long_distance +
      breakdown.lifestyle * WEIGHTS.lifestyle;

    return {
      score: Math.round(score * 100) / 100,
      breakdown,
    };
  },
};

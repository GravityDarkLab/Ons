/**
 * Age preference filter and scoring modifier.
 *
 * Filter: isAgeCompatible() — hard binary check, called before scoring.
 *   - Directional check: age_direction ("either" | "older" | "younger"),
 *     independent of age_gap — enforced even with no gap limit
 *   - Hard outer limit: gap > 2 × age_gap → reject
 *   - age_gap = "any" (or missing/unknown) → no gap limit, only direction applies
 *   - Missing birth_date → skip filter for that pair
 *
 * Modifier: ageModifier() — multiplied onto the final compatibility score.
 *   - Within age_gap: modifier = 1.0 (no penalty)
 *   - Between max_gap and 2× max_gap: cosine decay toward 0
 *   - Beyond 2× max_gap: should be filtered out before reaching here
 *   - Bidirectional: min(A's modifier, B's modifier)
 */

import type { ApplicantDoc } from "../../models/applicant.model.js";
import { ageFromBirthDate } from "../../utils/age.js";

interface AgePrefs {
  /** Preferred maximum gap in years; null = no limit. */
  maxGap: number | null;
  openToOlder: boolean;
  openToYounger: boolean;
}

/** Reads the two v2 age answers. Anything missing or unrecognised means "no preference". */
function agePrefs(answers: Record<string, unknown>): AgePrefs {
  const gap = Number(answers["age_gap"]);
  const direction = answers["age_direction"];
  return {
    maxGap: Number.isFinite(gap) && gap > 0 ? gap : null,
    openToOlder: direction !== "younger",
    openToYounger: direction !== "older",
  };
}

/**
 * Returns true if the pair satisfies both applicants' age preferences.
 * A return of false means the pair should be discarded before scoring.
 */
export function isAgeCompatible(a: ApplicantDoc, b: ApplicantDoc): boolean {
  const ageA = ageFromBirthDate(a.answers["birth_date"]);
  const ageB = ageFromBirthDate(b.answers["birth_date"]);

  // Missing birth_date on either side → skip filter
  if (ageA === null || ageB === null) return true;

  const gap = Math.abs(ageA - ageB);

  return (
    _passesConstraints(a.answers, ageA, ageB, gap) &&
    _passesConstraints(b.answers, ageB, ageA, gap)
  );
}

function _passesConstraints(
  answers: Record<string, unknown>,
  ownAge: number,
  partnerAge: number,
  gap: number
): boolean {
  const { maxGap, openToOlder, openToYounger } = agePrefs(answers);

  // Direction applies regardless of the gap limit — the two questions are
  // independent, so "no limit" must not void an explicit "older only".
  if (partnerAge > ownAge && !openToOlder) return false;
  if (partnerAge < ownAge && !openToYounger) return false;

  // null = no gap preference → no outer limit to enforce
  if (maxGap === null) return true;

  // Hard outer limit: gap > 2× max_gap → reject
  if (gap > 2 * maxGap) return false;

  return true;
}

/**
 * Returns a multiplier in [0, 1] representing how well the age gap fits
 * both applicants' preferences. Applied after the weighted compatibility score:
 *   final_score = compatibility_score × ageModifier(a, b)
 *
 * Takes the stricter (min) of both directions.
 */
export function ageModifier(a: ApplicantDoc, b: ApplicantDoc): number {
  const ageA = ageFromBirthDate(a.answers["birth_date"]);
  const ageB = ageFromBirthDate(b.answers["birth_date"]);

  // Missing birth_date → no modification
  if (ageA === null || ageB === null) return 1.0;

  const gap = Math.abs(ageA - ageB);

  return Math.min(
    _computeModifier(agePrefs(a.answers).maxGap, gap),
    _computeModifier(agePrefs(b.answers).maxGap, gap)
  );
}

function _computeModifier(maxGap: number | null, gap: number): number {
  if (maxGap === null) return 1.0;
  if (gap <= maxGap) return 1.0;
  if (gap <= 2 * maxGap) {
    const t = (gap - maxGap) / maxGap;
    return Math.cos((t * Math.PI) / 2);
  }
  // Beyond hard outer limit — should have been filtered; return 0 defensively
  return 0.0;
}

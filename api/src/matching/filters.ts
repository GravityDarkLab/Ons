/**
 * Hard compatibility filters applied before any scoring.
 *
 * These are binary pass/fail — not scored — because a score of 0.0 would
 * still rank an incompatible pair above "no result", which is wrong.
 * Filtering them out entirely is the correct behaviour.
 */

import type { ApplicantDoc } from "../models/applicant.model.js";

function str(answers: Record<string, unknown>, key: string): string {
  const v = answers[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Returns true if `a` and `b` are orientation-compatible.
 *
 * Rules:
 *   Straight  → only opposite binary gender (Male ↔ Female)
 *   Gay       → only Male partners
 *   Lesbian   → only Female partners
 *   Bisexual / Pansexual / Other / Prefer not to say → no gender filter
 *   Asexual   → no gender filter (romantic compatibility still possible)
 *
 * Both directions must pass — if either person would not want the other,
 * they are not compatible.
 */
export function isOrientationCompatible(
  a: ApplicantDoc,
  b: ApplicantDoc
): boolean {
  const orientationA = str(a.answers, "sexual_orientation");
  const orientationB = str(b.answers, "sexual_orientation");
  const genderA = str(a.answers, "gender_identity");
  const genderB = str(b.answers, "gender_identity");

  return (
    _wantsGender(orientationA, genderA, genderB) &&
    _wantsGender(orientationB, genderB, genderA)
  );
}

/**
 * Returns true if someone with `orientation` and `ownGender` would want
 * a partner of `partnerGender`.
 */
function _wantsGender(
  orientation: string,
  ownGender: string,
  partnerGender: string
): boolean {
  switch (orientation) {
    case "Straight":
      // Only opposite binary gender; non-binary/unknown → pass through
      if (ownGender === "Male")   return partnerGender === "Female";
      if (ownGender === "Female") return partnerGender === "Male";
      return true;

    case "Gay":
      // Men seeking men; for non-binary or unknown own-gender → pass through
      if (ownGender === "Male")   return partnerGender === "Male";
      if (ownGender === "Female") return false; // Female + Gay is unusual data — exclude
      return true;

    case "Lesbian":
      if (ownGender === "Female") return partnerGender === "Female";
      if (ownGender === "Male")   return false;
      return true;

    // No gender restriction
    case "Bisexual":
    case "Pansexual":
    case "Asexual":
    case "Prefer not to say":
    case "Other":
    case "":
      return true;

    default:
      return true;
  }
}

/**
 * Applies all hard filters and returns only the candidates compatible with `target`.
 */
export function filterCandidates(
  target: ApplicantDoc,
  candidates: ApplicantDoc[]
): ApplicantDoc[] {
  return candidates.filter((c) => isOrientationCompatible(target, c));
}

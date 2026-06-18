import type { ApplicantDoc } from "../../models/applicant.model.js";

function normalizeLocation(answers: Record<string, unknown>): string {
  const v = answers["location"];
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

/**
 * Returns false if either applicant is not open to long distance
 * and the two applicants are in different locations.
 *
 * Location comparison is case-insensitive exact match on the stored string.
 * Missing or blank location skips the check (pass through).
 */
export function isLongDistanceCompatible(a: ApplicantDoc, b: ApplicantDoc): boolean {
  const aAnswers = a.answers as Record<string, unknown>;
  const bAnswers = b.answers as Record<string, unknown>;

  const aLoc = normalizeLocation(aAnswers);
  const bLoc = normalizeLocation(bAnswers);

  if (!aLoc || !bLoc) return true;

  const sameCity = aLoc === bLoc;
  if (sameCity) return true;

  // Different cities: veto if either person cannot do long distance
  if (aAnswers["open_to_long_distance"] === false) return false;
  if (bAnswers["open_to_long_distance"] === false) return false;

  return true;
}

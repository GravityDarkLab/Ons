import type { ApplicantDoc } from "../../models/applicant.model.js";
import { normalizeAnswer } from "./answer.util.js";

/**
 * Maps a stored location string to a stable comparison key. The city option
 * list is free to relabel an entry (e.g. the country name attached to a city)
 * without breaking same-city matching for applicants who already submitted
 * under the old label — both sides of a rename map to the same key here.
 */
const LOCATION_ALIASES: Record<string, string> = {
  "jerusalem, israel": "jerusalem",
  "jerusalem, palestine": "jerusalem",
  "tel aviv, israel": "tel aviv",
  "tel aviv, palestine": "tel aviv",
  "haifa, israel": "haifa",
  "haifa, palestine": "haifa",
};

function canonicalLocation(normalized: string): string {
  return LOCATION_ALIASES[normalized] ?? normalized;
}

/**
 * Returns false if either applicant is not open to long distance
 * and the two applicants are in different locations.
 *
 * Location comparison is case-insensitive exact match on the stored string
 * (after alias canonicalization — see LOCATION_ALIASES). Missing or blank
 * location skips the check (pass through).
 */
export function isLongDistanceCompatible(a: ApplicantDoc, b: ApplicantDoc): boolean {
  const aAnswers = a.answers as Record<string, unknown>;
  const bAnswers = b.answers as Record<string, unknown>;

  const aLoc = canonicalLocation(normalizeAnswer(aAnswers, "location"));
  const bLoc = canonicalLocation(normalizeAnswer(bAnswers, "location"));

  if (!aLoc || !bLoc) return true;

  const sameCity = aLoc === bLoc;
  if (sameCity) return true;

  // Different cities: veto if either person cannot do long distance
  if (aAnswers["open_to_long_distance"] === false) return false;
  if (bAnswers["open_to_long_distance"] === false) return false;

  return true;
}

import type { ApplicantDoc } from "../../models/applicant.model.js";

/**
 * Returns false when one person wants children and the other does not.
 * Every other combination — including a missing answer — passes; the softer
 * mismatches are handled in the goals score.
 */
export function isChildrenCompatible(a: ApplicantDoc, b: ApplicantDoc): boolean {
  const pair = [a.answers["wants_children"], b.answers["wants_children"]];
  return !(pair.includes("want") && pair.includes("dont_want"));
}

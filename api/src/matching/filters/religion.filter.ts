import type { ApplicantDoc } from "../../models/applicant.model.js";
import { NAMED_RELIGIONS } from "../../questionnaire/questions.js";

/**
 * Returns false when a deal-breaker holder would be paired with someone who
 * is not confirmably of the same religion. Both directions are checked.
 *
 * - "Same religion" requires both to have picked the same *named* religion.
 *   `other` and `prefer_not_to_say` never count as the same, so a named
 *   deal-breaker holder is never paired with them.
 * - A deal breaker only applies when the holder's own religion is named.
 *   Someone who chose `other` / `prefer_not_to_say` cannot be matched on it,
 *   so enforcing theirs would leave them with zero candidates.
 * - A missing religion answer on either side skips the check.
 */
export function isReligionCompatible(a: ApplicantDoc, b: ApplicantDoc): boolean {
  const aReligion = a.answers["religion"];
  const bReligion = b.answers["religion"];

  if (!aReligion || !bReligion) return true;
  if (aReligion === bReligion && NAMED_RELIGIONS.has(aReligion as string)) return true;

  return !holdsDealBreaker(a) && !holdsDealBreaker(b);
}

function holdsDealBreaker(applicant: ApplicantDoc): boolean {
  return (
    applicant.answers["religion_match"] === "deal_breaker" &&
    NAMED_RELIGIONS.has(applicant.answers["religion"] as string)
  );
}

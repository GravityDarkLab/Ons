import type { ApplicantDoc } from "../../models/applicant.model.js";
import { normalizeAnswer } from "./answer.util.js";

/**
 * Returns false if either applicant has marked religion as a deal breaker
 * and the two applicants have different religions. Both directions are checked.
 *
 * Missing or blank religion strings skip the check (pass through).
 */
export function isReligionCompatible(a: ApplicantDoc, b: ApplicantDoc): boolean {
  const aAnswers = a.answers as Record<string, unknown>;
  const bAnswers = b.answers as Record<string, unknown>;

  const aReligion = normalizeAnswer(aAnswers, "religion");
  const bReligion = normalizeAnswer(bAnswers, "religion");

  if (!aReligion || !bReligion) return true;

  const religionsMatch = aReligion === bReligion;
  if (religionsMatch) return true;

  if (aAnswers["religion_deal_breaker"] === true) return false;
  if (bAnswers["religion_deal_breaker"] === true) return false;

  return true;
}

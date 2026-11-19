import type { ApplicantDoc } from "../../models/applicant.model.js";

const HABITS = [
  ["smoking", "partner_smoking"],
  ["alcohol", "partner_alcohol"],
] as const;

/**
 * Returns false when either person marked a habit as a deal breaker and the
 * other does it at all (sometimes or regularly). "I'd rather not" is not a
 * filter — it lowers the lifestyle score instead. A missing habit answer passes.
 */
export function isHabitsCompatible(a: ApplicantDoc, b: ApplicantDoc): boolean {
  return rejects(a, b) === false && rejects(b, a) === false;
}

function rejects(holder: ApplicantDoc, other: ApplicantDoc): boolean {
  return HABITS.some(([habit, preference]) => {
    const does = other.answers[habit];
    return holder.answers[preference] === "deal_breaker" && (does === "sometimes" || does === "regularly");
  });
}

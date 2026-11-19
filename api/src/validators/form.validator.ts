import { z } from "zod";
import { ageFromBirthDate, BIRTH_DATE_PATTERN } from "../utils/age.js";
import { QUESTIONS } from "../questionnaire/questions.js";
import type { Question } from "../models/questionnaire.model.js";

/** Fields with hand-written rules below; everything else is generated from the definitions. */
const HAND_WRITTEN = new Set([
  "first_name", "last_name", "instagram_handle", "location", "birth_date", "note_to_match", "disclaimer_agreed",
]);

function enumOf(q: Question) {
  return z.enum(q.options!.map((o) => o.value) as [string, ...string[]]);
}

/** Zod rule for one tap question, derived from its definition. */
function ruleFor(q: Question): z.ZodType {
  switch (q.type) {
    case "select":
      return enumOf(q);
    case "multiselect":
      return z
        .array(enumOf(q))
        .length(q.maxSelect!, `${q.id} needs exactly ${q.maxSelect} choices`)
        .refine((v) => new Set(v).size === v.length, `${q.id} choices must be distinct`);
    case "range":
      return z.number().int().min(q.min!).max(q.max!);
    case "boolean":
      return z.boolean();
    default:
      throw new Error(`[form.validator] No generated rule for question type "${q.type}" (${q.id})`);
  }
}

const generatedAnswers = Object.fromEntries(
  QUESTIONS.filter((q) => !HAND_WRITTEN.has(q.id)).map((q) => [q.id, ruleFor(q)])
);

/**
 * Base Zod schema for form submission.
 * Tap-question rules are generated from questionnaire/questions.ts; identity,
 * location, birth date, the optional note and consent are written by hand.
 */
export const formSubmissionSchema = z.object({
  questionnaireVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "questionnaireVersion must be semver (e.g. 1.0.0)"),

  // Honeypot: legitimate clients always send this field empty; bots that
  // scrape and fill all fields will populate it, triggering a silent reject.
  _verify: z.string().optional(),

  answers: z
    .object({
      // Identity (sensitive)
      first_name: z
        .string()
        .trim()
        .min(1, "first_name is required")
        .max(50)
        .regex(/^[\p{L}\p{M}'\- ]+$/u, "first_name contains invalid characters"),
      last_name: z
        .string()
        .trim()
        .min(1, "last_name is required")
        .max(50)
        .regex(/^[\p{L}\p{M}'\- ]+$/u, "last_name contains invalid characters"),
      instagram_handle: z
        .string()
        .min(1, "instagram_handle is required")
        .max(31) // Instagram usernames are ≤30 chars, plus optional leading @
        .regex(/^@?[\w.]+$/, "Invalid Instagram handle format"),

      // Personal info
      location: z.string().min(1).max(200),
      birth_date: z
        .string()
        .regex(BIRTH_DATE_PATTERN, "birth_date must be YYYY-MM-DD")
        .refine((d) => {
          const age = ageFromBirthDate(d);
          return age !== null && age >= 18 && age <= 120;
        }, "Must be a valid date of someone at least 18 years old"),

      ...generatedAnswers,

      // Optional free text — ice-breaker prompt only, never scored or shown to a match
      note_to_match: z.string().trim().max(280).optional(),

      // Legal
      disclaimer_agreed: z.literal(true, {
        error: "You must agree to the disclaimer",
      }),
    })
    .loose(), // allow extra fields — they'll be filtered against questionnaire
});

export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>;

import { z } from "zod";

/**
 * Base Zod schema for form submission.
 * Dynamic cross-validation against questionnaire question IDs is handled
 * in form.service.ts after fetching the active questionnaire.
 */
export const formSubmissionSchema = z.object({
  questionnaireVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "questionnaireVersion must be semver (e.g. 1.0.0)"),

  answers: z
    .object({
      // Identity (sensitive)
      instagram_handle: z
        .string()
        .min(1, "instagram_handle is required")
        .regex(/^@?[\w.]+$/, "Invalid Instagram handle format"),

      // Personal info
      location: z.string().min(1),
      age: z.number().int().min(18, "Must be at least 18 years old"),
      height_cm: z.number().int().min(100).max(250).optional(),
      work: z.string().min(1),
      gender_identity: z.string().min(1),
      sexual_orientation: z.string().min(1),
      religion: z.string().min(1),

      // Personality / vibe
      vibe_words: z.string().min(1),
      lifestyle: z.string().min(1),

      // Relationship preferences
      relationship_type: z.enum([
        "Long Term",
        "Short Term",
        "Open to Both",
        "Casual",
        "Not Sure",
      ]),
      open_to_long_distance: z.boolean(),
      preferred_physical_traits: z.string().min(1),
      preferred_character_traits: z.string().min(1),
      deal_breakers: z.string().min(1),
      okay_with_opposite_gender_friends: z.boolean(),
      religion_deal_breaker: z.boolean(),

      // Scores
      physical_affection_importance: z
        .number()
        .int()
        .min(1, "Must be at least 1")
        .max(10, "Must be at most 10"),

      // Open-ended
      dream_first_date: z.string().min(1),

      // Legal
      disclaimer_agreed: z.literal(true, {
        errorMap: () => ({ message: "You must agree to the disclaimer" }),
      }),
    })
    .passthrough(), // allow extra fields — they'll be filtered against questionnaire
});

export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>;

import { z } from "zod";
import { DEFAULT_SCORE_THRESHOLD, PORTAL_MIN_SCORE } from "../services/match-state.service.js";
import { formSubmissionSchema } from "./form.validator.js";

export const profileLoginSchema = z.object({
  magicToken: z.string().length(64, "magicToken must be exactly 64 characters"),
  password:   z.string().optional(),
});

export type ProfileLoginInput = z.infer<typeof profileLoginSchema>;

export const setPasswordSchema = z.object({
  magicToken:  z.string().length(64, "magicToken must be exactly 64 characters"),
  newPassword: z.string().min(8, "password must be at least 8 characters"),
});

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword:     z.string().min(8, "newPassword must be at least 8 characters"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const matchQuerySchema = z.object({
  threshold: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseFloat(v ?? String(DEFAULT_SCORE_THRESHOLD));
      return Math.min(1.0, Math.max(PORTAL_MIN_SCORE, isNaN(n) ? DEFAULT_SCORE_THRESHOLD : n));
    }),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v ?? "10", 10);
      return Math.min(50, Math.max(1, isNaN(n) ? 10 : n));
    }),
});

export type MatchQueryInput = z.infer<typeof matchQuerySchema>;

export const respondSchema = z.object({
  accept: z.boolean(),
});

export type RespondInput = z.infer<typeof respondSchema>;

export const outcomeFeedbackTags = ["too_far", "different_values", "no_spark", "something_else"] as const;

export const outcomeSchema = z.object({
  outcome: z.enum(["success", "failed"]),
  outcomeFeedback: z
    .object({
      tags: z.array(z.enum(outcomeFeedbackTags)).max(outcomeFeedbackTags.length),
      note: z.string().max(500).optional(),
    })
    .optional(),
  continuation: z.enum(["continue", "break"]).optional(),
});

export type OutcomeInput = z.infer<typeof outcomeSchema>;

export const nudgeAckSchema = z.object({
  openUp: z.boolean(),
});

export type NudgeAckInput = z.infer<typeof nudgeAckSchema>;

/**
 * Self-service answer updates — same field rules as the original submission,
 * minus the fields an applicant must not change themselves:
 * - instagram_handle lives encrypted in the identities collection and can
 *   only be changed by an admin
 * - disclaimer_agreed is a one-time consent given at submission
 * - birth_date and gender_identity are identity facts that drive matching —
 *   changing them requires contacting an admin
 * `.strict()` rejects all of them (and any unknown key) instead of silently
 * dropping.
 */
const SELF_LOCKED_KEYS = new Set([
  "instagram_handle", "first_name", "last_name", "disclaimer_agreed", "birth_date", "gender_identity",
]);

// Filtered at runtime rather than with .omit(): most answer rules are generated
// from the question definitions, so their keys are not statically known.
const editableAnswers = Object.fromEntries(
  Object.entries(formSubmissionSchema.shape.answers.shape).filter(([key]) => !SELF_LOCKED_KEYS.has(key))
);

export const updateAnswersSchema = z.object({
  answers: z.object(editableAnswers).strict(),
});

export type UpdateAnswersInput = z.infer<typeof updateAnswersSchema>;

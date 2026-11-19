import { z } from "zod";
import { SHARED_QUESTION_IDS } from "../questionnaire/questions.js";

export const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? "1", 10))),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "20", 10)))),
});

export const applicantFilterSchema = paginationSchema.extend({
  status: z
    .enum(["applied", "matched", "dating", "inactive"])
    .optional(),
  scheduledDeletion: z.enum(["true", "false"]).optional(),
});

export const matchingRunSchema = z.object({
  algorithm: z.literal("rules-v1").default("rules-v1"),
});

export type MatchingRunInput = z.infer<typeof matchingRunSchema>;

export const createQuestionnaireSchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "version must be semver (e.g. 2.0.0)"),
  name: z.string().min(1),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        order: z.number().int().min(1),
        questions: z
          .array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1),
              type: z.enum(["text", "number", "date", "select", "multiselect", "range", "boolean", "textarea"]),
              sensitive: z.boolean(),
              required: z.boolean(),
              order: z.number().int().min(1),
              options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).optional(),
              min: z.number().optional(),
              max: z.number().optional(),
              placeholder: z.string().optional(),
              maxSelect: z.number().int().min(1).optional(),
              shared: z.boolean().optional(),
            })
          )
          .min(1),
      })
    )
    .min(1),
}).superRefine((questionnaire, ctx) => {
  // Disclosure is enforced from the code definitions (toMatchView,
  // buildProfileSnippet), not from stored questionnaires. A questionnaire
  // claiming a different sharing policy would be silently overridden, so it
  // is rejected instead: an admin can never believe an answer is private
  // while it is in fact shown to matches or sent to OpenAI.
  questionnaire.sections.forEach((section, s) =>
    section.questions.forEach((question, q) => {
      const expected = SHARED_QUESTION_IDS.has(question.id);
      if ((question.shared ?? false) !== expected) {
        ctx.addIssue({
          code: "custom",
          path: ["sections", s, "questions", q, "shared"],
          message: expected
            ? `"${question.id}" is shared with matches and OpenAI by the code definitions — it must have shared: true`
            : `"${question.id}" is not shared by the code definitions — sharing is defined in api/src/questionnaire/questions.ts`,
        });
      }
    })
  );
});

export type CreateQuestionnaireInput = z.infer<typeof createQuestionnaireSchema>;

import { z } from "zod";

export const profileLoginSchema = z.object({
  magicToken: z.string().length(64, "magicToken must be exactly 64 characters"),
  password:   z.string().min(1, "password is required"),
});

export type ProfileLoginInput = z.infer<typeof profileLoginSchema>;

export const matchQuerySchema = z.object({
  threshold: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseFloat(v ?? "0.8");
      return Math.min(1.0, Math.max(0.6, isNaN(n) ? 0.8 : n));
    }),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v ?? "10", 10);
      return Math.min(10, Math.max(1, isNaN(n) ? 10 : n));
    }),
});

export const respondSchema = z.object({
  accept: z.boolean(),
});

export const outcomeSchema = z.object({
  outcome: z.enum(["success", "failed"]),
});

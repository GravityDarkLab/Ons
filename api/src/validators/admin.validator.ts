import { z } from "zod";

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
    .enum(["active", "inactive", "matched", "withdrawn"])
    .optional(),
});

export const matchingRunSchema = z.object({
  algorithm: z.enum(["baseline"]).default("baseline"),
});

import { z } from "zod";

export const patchMatchSchema = z.object({
  status: z.enum(["proposed", "in_progress", "dating", "success", "failed", "declined", "expired"]).optional(),
  notes:  z.string().max(1000).optional(),
});

export type PatchMatchInput = z.infer<typeof patchMatchSchema>;

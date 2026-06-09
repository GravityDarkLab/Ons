import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { getMatches, patchMatch, removeMatch } from "../controllers/match.controller.js";

const patchMatchSchema = z.object({
  status: z.enum(["proposed", "in_progress", "dating", "success", "failed", "declined", "expired"]).optional(),
  notes:  z.string().max(1000).optional(),
});

const matchRoutes = new Hono();

// All match routes require admin auth
matchRoutes.use("*", requireAdmin);

matchRoutes.get("/", getMatches);

matchRoutes.patch(
  "/:id",
  zValidator("json", patchMatchSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error:   "Validation failed",
          details: z.flattenError(result.error).fieldErrors,
        },
        422,
      );
    }
  }),
  patchMatch,
);

matchRoutes.delete("/:id", removeMatch);

export { matchRoutes };

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { matchingRunSchema } from "../validators/admin.validator.js";
import {
  getMatchCandidates,
  runMatching,
  getMatchingLastRun,
} from "../controllers/matching.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { adminRateLimiter } from "../middleware/rateLimit.middleware.js";

const matchingRoutes = new Hono();

matchingRoutes.use("*", adminRateLimiter);

// Admin-only: candidates expose compatibility data (aliases, scores,
// breakdowns) and can trigger paid embedding calls — never public
matchingRoutes.get("/candidates/:applicantId", requireAdmin, getMatchCandidates);

// Admin-only: persisted summary of the most recent matching pass
matchingRoutes.get("/last-run", requireAdmin, getMatchingLastRun);

// Admin-only: trigger a full matching pass
matchingRoutes.post(
  "/run",
  requireAdmin,
  zValidator("json", matchingRunSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: z.flattenError(result.error).fieldErrors,
        },
        422
      );
    }
  }),
  runMatching
);

export { matchingRoutes };

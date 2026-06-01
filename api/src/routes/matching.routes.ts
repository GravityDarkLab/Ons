import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { matchingRunSchema } from "../validators/admin.validator.js";
import {
  getMatchCandidates,
  runMatching,
} from "../controllers/matching.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const matchingRoutes = new Hono();

// Get candidates for a specific applicant — public (alias-based, no PII)
matchingRoutes.get("/candidates/:applicantId", getMatchCandidates);

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

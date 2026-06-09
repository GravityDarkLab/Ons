import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  profileLoginSchema,
  matchQuerySchema,
  respondSchema,
  outcomeSchema,
} from "../validators/profile.validator.js";
import {
  login,
  me,
  matches,
  contact,
  respond,
  outcome,
  deactivate,
} from "../controllers/profile.controller.js";
import { requireApplicant } from "../middleware/applicant.auth.middleware.js";
import {
  profileLoginRateLimiter,
  profileRateLimiter,
} from "../middleware/rateLimit.middleware.js";

function validationErr(result: { error: z.ZodError }, c: any) {
  return c.json(
    {
      success: false,
      error:   "Validation failed",
      details: z.flattenError(result.error).fieldErrors,
    },
    422
  );
}

export const profileRoutes = new Hono();

// ── Public ─────────────────────────────────────────────────────────────────────

profileRoutes.post(
  "/login",
  profileLoginRateLimiter,
  zValidator("json", profileLoginSchema, (r, c) => {
    if (!r.success) return validationErr(r as any, c);
  }),
  login
);

// ── Protected ──────────────────────────────────────────────────────────────────

profileRoutes.use("*", profileRateLimiter);

profileRoutes.get("/me", requireApplicant, me);

profileRoutes.get(
  "/matches",
  requireApplicant,
  zValidator("query", matchQuerySchema, (r, c) => {
    if (!r.success) return validationErr(r as any, c);
  }),
  matches
);

profileRoutes.post("/matches/:id/contact", requireApplicant, contact);

profileRoutes.post(
  "/matches/:id/respond",
  requireApplicant,
  zValidator("json", respondSchema, (r, c) => {
    if (!r.success) return validationErr(r as any, c);
  }),
  respond
);

profileRoutes.post(
  "/matches/:id/outcome",
  requireApplicant,
  zValidator("json", outcomeSchema, (r, c) => {
    if (!r.success) return validationErr(r as any, c);
  }),
  outcome
);

profileRoutes.post("/deactivate", requireApplicant, deactivate);

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { adminLoginSchema, createQuestionnaireSchema } from "../validators/admin.validator.js";
import {
  login,
  logout,
  me,
  getApplicants,
  getApplicant,
  getApplicantIdentityHandler,
  deleteApplicant,
  getAuditLogs,
  createQuestionnaireHandler,
} from "../controllers/admin.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { adminRateLimiter } from "../middleware/rateLimit.middleware.js";

const adminRoutes = new Hono();

// ── Session endpoints (no rate limiting) ──────────────────────────────────────
// /me is called on every page load to probe the cookie — rate limiting it
// causes 429s during normal browsing and creates a redirect loop on the login
// page (401 → redirect → mount → /me → 401 → ...).
// /logout is a one-shot clear; neither is a brute-force surface.
adminRoutes.post("/logout", logout);
adminRoutes.get("/me", requireAdmin, me);

// ── Rate-limited routes ───────────────────────────────────────────────────────
// Applied after /me and /logout so those paths are not matched by use("*").
adminRoutes.use("*", adminRateLimiter);

// Login (public, rate limited — brute-force protection)
adminRoutes.post(
  "/login",
  zValidator("json", adminLoginSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        422
      );
    }
  }),
  login
);

// Protected admin routes
adminRoutes.get("/applicants", requireAdmin, getApplicants);
adminRoutes.get("/applicants/:id", requireAdmin, getApplicant);
adminRoutes.get(
  "/applicants/:id/identity",
  requireAdmin,
  getApplicantIdentityHandler
);
adminRoutes.delete("/applicants/:id", requireAdmin, deleteApplicant);
adminRoutes.get("/audit-logs", requireAdmin, getAuditLogs);
adminRoutes.post(
  "/questionnaires",
  requireAdmin,
  zValidator("json", createQuestionnaireSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        422
      );
    }
  }),
  createQuestionnaireHandler
);

export { adminRoutes };

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { adminLoginSchema, applicantFilterSchema, createQuestionnaireSchema } from "../validators/admin.validator.js";
import { validationHook } from "../validators/validation-hook.js";
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
import { requireAdmin, requireRole } from "../middleware/auth.middleware.js";
import { adminLoginRateLimiter, adminRateLimiter } from "../middleware/rateLimit.middleware.js";

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

// Login — strict rate limit (brute-force protection: 10/min)
adminRoutes.post(
  "/login",
  adminLoginRateLimiter,
  zValidator("json", adminLoginSchema, validationHook),
  login
);

// Protected admin routes
adminRoutes.get(
  "/applicants",
  requireAdmin,
  zValidator("query", applicantFilterSchema, validationHook),
  getApplicants
);
adminRoutes.get("/applicants/:id", requireAdmin, getApplicant);
adminRoutes.get(
  "/applicants/:id/identity",
  requireAdmin,
  requireRole("super_admin"),
  getApplicantIdentityHandler
);
adminRoutes.delete("/applicants/:id", requireAdmin, deleteApplicant);
adminRoutes.get("/audit-logs", requireAdmin, getAuditLogs);
adminRoutes.post(
  "/questionnaires",
  requireAdmin,
  zValidator("json", createQuestionnaireSchema, validationHook),
  createQuestionnaireHandler
);

export { adminRoutes };

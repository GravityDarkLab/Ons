import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { adminLoginSchema, createQuestionnaireSchema } from "../validators/admin.validator.js";
import {
  login,
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

// Apply rate limiter to all admin routes
adminRoutes.use("*", adminRateLimiter);

// Public admin route — login
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

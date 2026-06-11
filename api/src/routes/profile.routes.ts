import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../validators/validation-hook.js";
import {
  profileLoginSchema,
  setPasswordSchema,
  changePasswordSchema,
  matchQuerySchema,
  respondSchema,
  outcomeSchema,
} from "../validators/profile.validator.js";
import {
  login,
  setPassword,
  changePassword,
  suggestPassword,
  me,
  matches,
  contact,
  respond,
  withdraw,
  outcome,
  deactivate,
  cancelDeletion,
  deleteNow,
} from "../controllers/profile.controller.js";
import { requireApplicant } from "../middleware/applicant.auth.middleware.js";
import {
  profileLoginRateLimiter,
  profileRateLimiter,
} from "../middleware/rateLimit.middleware.js";

export const profileRoutes = new Hono();

// ── Public ─────────────────────────────────────────────────────────────────────

profileRoutes.post(
  "/login",
  profileLoginRateLimiter,
  zValidator("json", profileLoginSchema, validationHook),
  login
);

profileRoutes.post(
  "/set-password",
  profileLoginRateLimiter,
  zValidator("json", setPasswordSchema, validationHook),
  setPassword
);

profileRoutes.get("/suggest-password", suggestPassword);

// ── Protected ──────────────────────────────────────────────────────────────────

profileRoutes.use("*", profileRateLimiter);

profileRoutes.get("/me", requireApplicant, me);

profileRoutes.get(
  "/matches",
  requireApplicant,
  zValidator("query", matchQuerySchema, validationHook),
  matches
);

profileRoutes.post("/matches/:id/contact", requireApplicant, contact);

profileRoutes.post(
  "/matches/:id/respond",
  requireApplicant,
  zValidator("json", respondSchema, validationHook),
  respond
);

profileRoutes.post("/matches/:id/withdraw", requireApplicant, withdraw);

profileRoutes.post(
  "/matches/:id/outcome",
  requireApplicant,
  zValidator("json", outcomeSchema, validationHook),
  outcome
);

profileRoutes.post(
  "/change-password",
  requireApplicant,
  zValidator("json", changePasswordSchema, validationHook),
  changePassword
);

profileRoutes.post("/deactivate", requireApplicant, deactivate);

profileRoutes.post("/cancel-deletion", requireApplicant, cancelDeletion);

profileRoutes.post("/delete-now", requireApplicant, deleteNow);

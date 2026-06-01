import { Context } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { ObjectId } from "mongodb";
import {
  adminLogin,
  listApplicants,
  getApplicantById,
  getApplicantIdentity,
  deactivateApplicant,
  listAuditLogs,
  createQuestionnaire,
} from "../services/admin.service.js";
import { writeAuditLog, extractAuditContext } from "../middleware/audit.middleware.js";
import { COOKIE_NAME, COOKIE_MAX_AGE } from "../middleware/auth.middleware.js";
import { env } from "../config/env.js";
import type { ApplicantStatus } from "../models/applicant.model.js";
import type { AdminRole } from "../models/admin.model.js";
import type { CreateQuestionnaireInput } from "../validators/admin.validator.js";

/**
 * POST /api/v1/admin/login
 */
export async function login(c: Context): Promise<Response> {
  const { username, password } = c.req.valid("json" as never) as {
    username: string;
    password: string;
  };

  const token = await adminLogin(username, password);

  if (!token) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "Lax",
    path: "/api/v1",
    maxAge: COOKIE_MAX_AGE,
  });

  const auditCtx = extractAuditContext(username, c);
  await writeAuditLog(auditCtx, "ADMIN_LOGIN", { metadata: { username } });

  return c.json({ success: true });
}

/**
 * POST /api/v1/admin/logout
 */
export async function logout(c: Context): Promise<Response> {
  deleteCookie(c, COOKIE_NAME, { path: "/api/v1" });
  return c.json({ success: true });
}

/**
 * GET /api/v1/admin/me
 * Returns the current admin's identity from the verified JWT claims.
 * Used by the frontend to check session validity on page load.
 */
export async function me(c: Context): Promise<Response> {
  return c.json({
    success: true,
    data: {
      adminId:   c.get("adminId")   as string,
      adminRole: c.get("adminRole") as AdminRole,
    },
  });
}

/**
 * GET /api/v1/admin/applicants
 */
export async function getApplicants(c: Context): Promise<Response> {
  const query = c.req.query();
  const page   = Math.max(1, parseInt(query.page  ?? "1",  10));
  const limit  = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));
  const status = query.status as ApplicantStatus | undefined;
  const search = query.search?.trim() || undefined;

  const adminId = c.get("adminId") as string;
  const auditCtx = extractAuditContext(adminId, c);

  await writeAuditLog(auditCtx, "LIST_APPLICANTS", {
    metadata: { page, limit, status },
  });

  try {
    const result = await listApplicants(page, limit, status, search);
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list applicants";
    return c.json({ success: false, error: message }, 500);
  }
}

/**
 * GET /api/v1/admin/applicants/:id
 */
export async function getApplicant(c: Context): Promise<Response> {
  const id = c.req.param("id") ?? "";
  const adminId = c.get("adminId") as string;

  const auditCtx = extractAuditContext(adminId, c);

  try {
    const applicant = await getApplicantById(id);

    if (!applicant) {
      return c.json({ success: false, error: "Applicant not found" }, 404);
    }

    await writeAuditLog(auditCtx, "VIEW_APPLICANT", {
      targetAlias: applicant.alias,
      targetApplicantId: new ObjectId(id),
    });

    return c.json({ success: true, data: applicant });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get applicant";
    return c.json({ success: false, error: message }, 500);
  }
}

/**
 * GET /api/v1/admin/applicants/:id/identity
 * Returns the decrypted Instagram handle. Audit logged.
 */
export async function getApplicantIdentityHandler(c: Context): Promise<Response> {
  const id = c.req.param("id") ?? "";
  const adminId = c.get("adminId") as string;

  const auditCtx = extractAuditContext(adminId, c);

  try {
    const identity = await getApplicantIdentity(id);

    if (!identity) {
      return c.json({ success: false, error: "Identity not found" }, 404);
    }

    // Audit log AFTER successful decryption
    await writeAuditLog(auditCtx, "RESOLVE_IDENTITY", {
      targetAlias: identity.alias,
      targetApplicantId: new ObjectId(id),
    });

    return c.json({
      success: true,
      data: {
        alias: identity.alias,
        instagramHandle: identity.instagramHandle,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve identity";
    return c.json({ success: false, error: message }, 500);
  }
}

/**
 * DELETE /api/v1/admin/applicants/:id
 * Soft-deletes by setting status to "withdrawn".
 */
export async function deleteApplicant(c: Context): Promise<Response> {
  const id = c.req.param("id") ?? "";
  const adminId = c.get("adminId") as string;

  const auditCtx = extractAuditContext(adminId, c);

  try {
    const applicant = await getApplicantById(id);
    if (!applicant) {
      return c.json({ success: false, error: "Applicant not found" }, 404);
    }

    const success = await deactivateApplicant(id);

    if (!success) {
      return c.json({ success: false, error: "Applicant not found" }, 404);
    }

    await writeAuditLog(auditCtx, "DEACTIVATE_APPLICANT", {
      targetAlias: applicant.alias,
      targetApplicantId: new ObjectId(id),
    });

    return c.json({ success: true, message: "Applicant withdrawn" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to deactivate applicant";
    return c.json({ success: false, error: message }, 500);
  }
}

/**
 * POST /api/v1/admin/questionnaires
 * Creates a new questionnaire and deactivates all existing ones.
 */
export async function createQuestionnaireHandler(c: Context): Promise<Response> {
  const body = c.req.valid("json" as never) as CreateQuestionnaireInput;
  const adminId = c.get("adminId") as string;

  try {
    const result = await createQuestionnaire(body);

    const auditCtx = extractAuditContext(adminId, c);
    await writeAuditLog(auditCtx, "CREATE_QUESTIONNAIRE", {
      metadata: {
        version: result.version,
        deactivatedCount: result.deactivatedCount,
      },
    });

    return c.json(
      {
        success: true,
        id: result.id,
        version: result.version,
        deactivatedCount: result.deactivatedCount,
        message: `Questionnaire v${result.version} created. ${result.deactivatedCount} previous version(s) deactivated.`,
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create questionnaire";
    return c.json({ success: false, error: message }, 400);
  }
}

/**
 * GET /api/v1/admin/audit-logs
 */
export async function getAuditLogs(c: Context): Promise<Response> {
  const query = c.req.query();
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50", 10)));

  try {
    const result = await listAuditLogs(page, limit);
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list audit logs";
    return c.json({ success: false, error: message }, 500);
  }
}

import { Context } from "hono";
import { ObjectId } from "mongodb";
import {
  adminLogin,
  listApplicants,
  getApplicantById,
  getApplicantIdentity,
  deactivateApplicant,
  listAuditLogs,
} from "../services/admin.service.js";
import { writeAuditLog, extractAuditContext } from "../middleware/audit.middleware.js";
import type { ApplicantStatus } from "../models/applicant.model.js";

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

  // Audit login
  const auditCtx = extractAuditContext(username, c.req.raw);
  await writeAuditLog(auditCtx, "ADMIN_LOGIN", {
    metadata: { username },
  });

  return c.json({ success: true, token });
}

/**
 * GET /api/v1/admin/applicants
 */
export async function getApplicants(c: Context): Promise<Response> {
  const query = c.req.query();
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));
  const status = query.status as ApplicantStatus | undefined;

  const adminId = c.get("adminId") as string;
  const auditCtx = extractAuditContext(adminId, c.req.raw);

  await writeAuditLog(auditCtx, "LIST_APPLICANTS", {
    metadata: { page, limit, status },
  });

  try {
    const result = await listApplicants(page, limit, status);
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

  const auditCtx = extractAuditContext(adminId, c.req.raw);

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

  const auditCtx = extractAuditContext(adminId, c.req.raw);

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

  const auditCtx = extractAuditContext(adminId, c.req.raw);

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

import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { getAuditLogsCollection } from "../db/collections.js";
import type { AuditAction } from "../models/auditLog.model.js";

export interface AuditContext {
  adminId: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Writes an audit log entry. Fire-and-forget — does not throw on failure
 * (we log the error instead so the main response is not affected).
 */
export async function writeAuditLog(
  ctx: AuditContext,
  action: AuditAction,
  opts?: {
    targetAlias?: string;
    targetApplicantId?: ObjectId;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const db = await getDb();
    const auditLogs = getAuditLogsCollection(db);

    await auditLogs.insertOne({
      _id: new ObjectId(),
      adminId: ctx.adminId,
      action,
      targetAlias: opts?.targetAlias,
      targetApplicantId: opts?.targetApplicantId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      metadata: opts?.metadata,
    });
  } catch (err) {
    // Audit log failure should never block the response
    console.error("[AUDIT] Failed to write audit log:", err);
  }
}

/**
 * Extracts audit context from a Hono request context.
 */
export function extractAuditContext(
  adminId: string,
  req: Request
): AuditContext {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const userAgent = req.headers.get("user-agent") ?? "unknown";

  return { adminId, ipAddress, userAgent };
}

import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import {
  getApplicantsCollection,
  getAuditLogsCollection,
} from "../db/collections.js";
import type { ApplicantDoc, ApplicantStatus } from "../models/applicant.model.js";
import type { AuditLogDoc } from "../models/auditLog.model.js";
import { resolveIdentityById } from "../privacy/identity.service.js";
import { env } from "../config/env.js";
import { signAdminToken } from "../middleware/auth.middleware.js";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Validates admin credentials and returns a signed JWT.
 * Returns null if credentials are invalid.
 */
export async function adminLogin(
  username: string,
  password: string
): Promise<string | null> {
  if (username !== env.adminUsername || password !== env.adminPassword) {
    return null;
  }
  return signAdminToken(username);
}

/**
 * Returns a paginated list of applicants, optionally filtered by status.
 */
export async function listApplicants(
  page: number,
  limit: number,
  status?: ApplicantStatus
): Promise<PaginatedResult<Omit<ApplicantDoc, "_id"> & { id: string }>> {
  const db = await getDb();
  const col = getApplicantsCollection(db);

  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  const data = docs.map(({ _id, ...rest }) => ({
    id: _id.toHexString(),
    ...rest,
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Returns a single applicant by ID (no sensitive data).
 */
export async function getApplicantById(
  id: string
): Promise<(Omit<ApplicantDoc, "_id"> & { id: string }) | null> {
  const db = await getDb();
  const col = getApplicantsCollection(db);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return null;
  }

  const doc = await col.findOne({ _id: objectId });
  if (!doc) return null;

  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest };
}

/**
 * Resolves and returns the decrypted Instagram handle for an applicant.
 * This is an admin-only action; callers MUST write an audit log.
 */
export async function getApplicantIdentity(
  id: string
): Promise<{ alias: string; instagramHandle: string } | null> {
  const db = await getDb();
  const col = getApplicantsCollection(db);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return null;
  }

  const applicant = await col.findOne({ _id: objectId });
  if (!applicant) return null;

  const instagramHandle = await resolveIdentityById(objectId);
  if (!instagramHandle) return null;

  return { alias: applicant.alias, instagramHandle };
}

/**
 * Sets an applicant's status to "withdrawn" (soft delete).
 */
export async function deactivateApplicant(id: string): Promise<boolean> {
  const db = await getDb();
  const col = getApplicantsCollection(db);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return false;
  }

  const result = await col.updateOne(
    { _id: objectId },
    { $set: { status: "withdrawn", updatedAt: new Date() } }
  );

  return result.matchedCount > 0;
}

export interface AuditLogView {
  id: string;
  adminId: string;
  action: AuditLogDoc["action"];
  targetAlias?: string;
  targetApplicantId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Returns a paginated list of audit logs, newest first.
 */
export async function listAuditLogs(
  page: number,
  limit: number
): Promise<PaginatedResult<AuditLogView>> {
  const db = await getDb();
  const col = getAuditLogsCollection(db);

  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    col.find({}).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments({}),
  ]);

  const data: AuditLogView[] = docs.map((doc) => ({
    id: doc._id.toHexString(),
    adminId: doc.adminId,
    action: doc.action,
    targetAlias: doc.targetAlias,
    targetApplicantId: doc.targetApplicantId?.toHexString(),
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    timestamp: doc.timestamp,
    metadata: doc.metadata,
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

import { ObjectId } from "mongodb";
import { AppError } from "../errors.js";
import { getDb } from "../db/connection.js";
import { getApplicantsCollection, getMatchesCollection } from "../db/collections.js";
import type { ApplicantDoc } from "../models/applicant.model.js";
import type { MatchDoc } from "../models/match.model.js";
import {
  toMatchView,
  assertMatchTransition,
  expireConflictingMatches,
  transitionApplicantStatus,
  type ApplicantMatchView,
} from "./match.service.js";
import { resolveIdentityById } from "../privacy/identity.service.js";
import { hashMagicToken } from "../privacy/magic-token.js";
import { writeAuditLog } from "../middleware/audit.middleware.js";
import { generateIceBreakers } from "./icebreaker.service.js";

/** Grace period before personal data of inactive accounts is purged. */
const DELETION_GRACE_MS = 180 * 24 * 60 * 60 * 1000;

// ── Auth ──────────────────────────────────────────────────────────────────────

export type LoginAttemptResult =
  | { status: "ok"; applicant: ApplicantDoc }
  | { status: "first_login" }
  | null; // wrong token or wrong password

export async function loginWithMagicToken(
  magicToken: string,
  password?: string
): Promise<LoginAttemptResult> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);

  const doc = await col.findOne({ magicToken: hashMagicToken(magicToken) });
  if (!doc) return null;

  if (doc.passwordHash === null) return { status: "first_login" };

  if (!password) return null;
  const ok = await Bun.password.verify(password, doc.passwordHash);
  return ok ? { status: "ok", applicant: doc } : null;
}

export async function setPassword(
  magicToken: string,
  newPassword: string
): Promise<ApplicantDoc | null> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);

  const doc = await col.findOne({ magicToken: hashMagicToken(magicToken) });
  if (!doc) return null;

  if (doc.passwordHash !== null) {
    throw new AppError("Password already set. Use change-password to update it.", 409);
  }

  const passwordHash = await Bun.password.hash(newPassword);
  const now = new Date();
  await col.updateOne({ _id: doc._id }, { $set: { passwordHash, updatedAt: now } });
  return { ...doc, passwordHash };
}

export async function changePassword(
  applicantId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);

  const doc = await col.findOne({ _id: new ObjectId(applicantId) });
  if (!doc) throw new AppError("Not found", 404);

  if (!doc.passwordHash) {
    throw new AppError("No password set. Use set-password for first-time setup.", 400);
  }

  const ok = await Bun.password.verify(currentPassword, doc.passwordHash);
  if (!ok) throw new AppError("Current password is incorrect", 401);

  const passwordHash = await Bun.password.hash(newPassword);
  const now = new Date();
  await col.updateOne({ _id: doc._id }, { $set: { passwordHash, updatedAt: now } });
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface ApplicantProfileView {
  applicantId: string;
  alias: string;
  status: ApplicantDoc["status"];
  scoreThreshold: number;
  createdAt: Date;
}

export async function getMyProfile(applicantId: string): Promise<ApplicantProfileView | null> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);

  const doc = await col.findOne({ _id: new ObjectId(applicantId) });
  if (!doc) return null;

  return {
    applicantId: doc._id.toHexString(),
    alias:          doc.alias,
    status:         doc.status,
    scoreThreshold: doc.scoreThreshold ?? 0.8,
    createdAt:      doc.createdAt,
  };
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function getMyMatches(
  applicantId: string,
  threshold: number,
  limit: number
): Promise<ApplicantMatchView[]> {
  const db       = await getDb();
  const appCol   = getApplicantsCollection(db);
  const matchCol = getMatchesCollection(db);

  const oid = new ObjectId(applicantId);

  const applicant = await appCol.findOne({ _id: oid });
  if (!applicant) return [];

  const visibleStatuses =
    applicant.status === "dating"
      ? (["dating"] as const)
      : (["proposed", "in_progress", "dating"] as const);

  const docs: MatchDoc[] = await matchCol
    .find({
      $or: [{ applicantAId: oid }, { applicantBId: oid }],
      status: { $in: [...visibleStatuses] },
      score:  { $gte: threshold },
    })
    .sort({ score: -1 })
    .limit(limit)
    .toArray();

  return docs.map((d) => toMatchView(d, oid));
}

// ── Contact flow ──────────────────────────────────────────────────────────────

export interface ContactResult {
  targetInstagram: string;
  iceBreakers: string[];
  dateIdeas: string[];
}

export async function requestContact(
  applicantId: string,
  matchId: string,
  audit: { ipAddress: string; userAgent: string } = { ipAddress: "unknown", userAgent: "unknown" },
): Promise<ContactResult> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);
  const appCol   = getApplicantsCollection(db);

  const actorId = new ObjectId(applicantId);

  let matchOid: ObjectId;
  try { matchOid = new ObjectId(matchId); } catch {
    throw new AppError("Match not found", 404);
  }

  // Load match to authorise the actor before the atomic write
  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) throw new AppError("Match not found", 404);

  assertMatchTransition(match, "contact", actorId);

  const targetId = match.applicantAId.equals(actorId)
    ? match.applicantBId
    : match.applicantAId;

  // Fetch icebreakers before the atomic claim (no side-effects yet)
  const [actorDoc, targetDoc] = await Promise.all([
    appCol.findOne({ _id: actorId }),
    appCol.findOne({ _id: targetId }),
  ]);

  const { questions, dateIdeas } = actorDoc && targetDoc
    ? await generateIceBreakers(actorDoc, targetDoc)
    : { questions: [], dateIdeas: [] };

  // Pre-flight identity check before any mutation — prevents stuck state if identity is missing
  const targetInstagram = await resolveIdentityById(targetId);
  if (!targetInstagram) {
    throw new AppError("Target identity not found", 404);
  }

  const now = new Date();

  // Atomically claim the transition — filter on status:"proposed" prevents double-contact
  // from concurrent requests both passing assertMatchTransition above
  const claimed = await matchCol.findOneAndUpdate(
    { _id: matchOid, status: "proposed" },
    {
      $set: {
        status:             "in_progress",
        initiatorId:        actorId,
        iceBreakers:        questions,
        dateIdeas,
        contactRequestedAt: now,
        updatedAt:          now,
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw new AppError("Match is no longer available for contact — it may have been claimed concurrently", 409);
  }

  // Write audit log after winning the race (identity was pre-fetched without side-effects)
  await writeAuditLog(
    { adminId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
    "APPLICANT_REVEAL_IDENTITY",
    {
      targetApplicantId: targetId,
      metadata: {
        actorType: "applicant",
        matchId,
        targetAlias: match.applicantAId.equals(actorId)
          ? match.applicantBAlias
          : match.applicantAAlias,
      },
    }
  );

  return { targetInstagram, iceBreakers: questions, dateIdeas };
}

export async function respondToContact(
  applicantId: string,
  matchId: string,
  accept: boolean
): Promise<void> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);

  const actorId = new ObjectId(applicantId);

  let matchOid: ObjectId;
  try { matchOid = new ObjectId(matchId); } catch {
    throw new AppError("Match not found", 404);
  }

  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) throw new AppError("Match not found", 404);

  assertMatchTransition(match, "respond", actorId);

  const now = new Date();

  // Atomic claim — the status filter prevents concurrent accept/decline from
  // both applying after passing assertMatchTransition on the same snapshot
  const claimed = await matchCol.findOneAndUpdate(
    { _id: matchOid, status: "in_progress" },
    {
      $set: {
        status:             accept ? "dating" : "declined",
        contactRespondedAt: now,
        updatedAt:          now,
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw new AppError("Match was already responded to", 409);
  }

  if (accept) {
    const ids = [match.applicantAId, match.applicantBId];
    await transitionApplicantStatus(ids, "dating");
    await expireConflictingMatches(ids);
  }
}

export async function reportOutcome(
  applicantId: string,
  matchId: string,
  outcome: "success" | "failed"
): Promise<void> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);

  const actorId = new ObjectId(applicantId);

  let matchOid: ObjectId;
  try { matchOid = new ObjectId(matchId); } catch {
    throw new AppError("Match not found", 404);
  }

  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) throw new AppError("Match not found", 404);

  assertMatchTransition(match, "outcome", actorId);

  const now = new Date();
  const ids  = [match.applicantAId, match.applicantBId];

  // Atomic claim — only one partner's outcome report wins; a concurrent
  // conflicting report gets 409 instead of silently overwriting state
  const claimed = await matchCol.findOneAndUpdate(
    { _id: matchOid, status: { $in: ["dating", "in_progress"] } },
    { $set: { status: outcome === "success" ? "success" : "failed", updatedAt: now } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw new AppError("Outcome was already reported for this match", 409);
  }

  if (outcome === "success") {
    const deletionScheduledAt = new Date(now.getTime() + DELETION_GRACE_MS);
    await transitionApplicantStatus(ids, "inactive", { deletionScheduledAt });
  } else {
    await transitionApplicantStatus(ids, "applied");
  }
}

export async function deactivateMyAccount(applicantId: string): Promise<void> {
  const oid                = new ObjectId(applicantId);
  const deletionScheduledAt = new Date(Date.now() + DELETION_GRACE_MS);
  await transitionApplicantStatus([oid], "inactive", { deletionScheduledAt });
  await expireConflictingMatches([oid]);
}

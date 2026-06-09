import { ObjectId } from "mongodb";
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
    throw Object.assign(
      new Error("Password already set. Use change-password to update it."),
      { statusCode: 409 }
    );
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
  if (!doc) throw Object.assign(new Error("Not found"), { statusCode: 404 });

  if (!doc.passwordHash) {
    throw Object.assign(
      new Error("No password set. Use set-password for first-time setup."),
      { statusCode: 400 }
    );
  }

  const ok = await Bun.password.verify(currentPassword, doc.passwordHash);
  if (!ok) throw Object.assign(new Error("Current password is incorrect"), { statusCode: 401 });

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
  matchId: string
): Promise<ContactResult> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);
  const appCol   = getApplicantsCollection(db);

  const actorId = new ObjectId(applicantId);

  let matchOid: ObjectId;
  try { matchOid = new ObjectId(matchId); } catch {
    throw Object.assign(new Error("Match not found"), { statusCode: 404 });
  }

  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) throw Object.assign(new Error("Match not found"), { statusCode: 404 });

  assertMatchTransition(match, "contact", actorId); // throws on invalid state/ownership

  const targetId = match.applicantAId.equals(actorId)
    ? match.applicantBId
    : match.applicantAId;

  const targetInstagram = await resolveIdentityById(targetId);
  if (!targetInstagram) {
    throw Object.assign(new Error("Target identity not found"), { statusCode: 404 });
  }

  // Audit the identity reveal
  await writeAuditLog(
    { adminId: applicantId, ipAddress: "internal", userAgent: "applicant-portal" },
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

  // Fetch both applicant docs for icebreaker generation
  const [actorDoc, targetDoc] = await Promise.all([
    appCol.findOne({ _id: actorId }),
    appCol.findOne({ _id: targetId }),
  ]);

  const { questions, dateIdeas } = actorDoc && targetDoc
    ? await generateIceBreakers(actorDoc, targetDoc)
    : { questions: [], dateIdeas: [] };

  const now = new Date();
  await matchCol.updateOne(
    { _id: matchOid },
    {
      $set: {
        status:             "in_progress",
        initiatorId:        actorId,
        iceBreakers:        questions,
        dateIdeas,
        contactRequestedAt: now,
        updatedAt:          now,
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
    throw Object.assign(new Error("Match not found"), { statusCode: 404 });
  }

  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) throw Object.assign(new Error("Match not found"), { statusCode: 404 });

  assertMatchTransition(match, "respond", actorId);

  const now = new Date();

  if (accept) {
    await matchCol.updateOne(
      { _id: matchOid },
      { $set: { status: "dating", contactRespondedAt: now, updatedAt: now } }
    );
    const ids = [match.applicantAId, match.applicantBId];
    await transitionApplicantStatus(ids, "dating");
    await expireConflictingMatches(ids);
  } else {
    await matchCol.updateOne(
      { _id: matchOid },
      { $set: { status: "declined", contactRespondedAt: now, updatedAt: now } }
    );
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
    throw Object.assign(new Error("Match not found"), { statusCode: 404 });
  }

  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) throw Object.assign(new Error("Match not found"), { statusCode: 404 });

  assertMatchTransition(match, "outcome", actorId);

  const now = new Date();
  const ids  = [match.applicantAId, match.applicantBId];

  if (outcome === "success") {
    await matchCol.updateOne({ _id: matchOid }, { $set: { status: "success", updatedAt: now } });
    const deletionScheduledAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    await transitionApplicantStatus(ids, "inactive", { deletionScheduledAt });
  } else {
    await matchCol.updateOne({ _id: matchOid }, { $set: { status: "failed", updatedAt: now } });
    await transitionApplicantStatus(ids, "applied");
  }
}

export async function deactivateMyAccount(applicantId: string): Promise<void> {
  const oid                = new ObjectId(applicantId);
  const deletionScheduledAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  await transitionApplicantStatus([oid], "inactive", { deletionScheduledAt });
  await expireConflictingMatches([oid]);
}

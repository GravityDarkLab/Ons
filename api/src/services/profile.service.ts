import { ObjectId } from "mongodb";
import { AppError } from "../errors.js";
import { getDb } from "../db/connection.js";
import {
  getApplicantsCollection,
  getMatchesCollection,
  getIdentitiesCollection,
  getEmbeddingsCollection,
} from "../db/collections.js";
import type { ApplicantDoc } from "../models/applicant.model.js";
import type { MatchDoc } from "../models/match.model.js";
import {
  toMatchView,
  assertMatchTransition,
  expireConflictingMatches,
  transitionApplicantStatus,
  DELETION_GRACE_MS,
  type ApplicantMatchView,
} from "./match.service.js";
import {
  resolveIdentityById,
  revealIdentityById,
  identityExistsById,
} from "../privacy/identity.service.js";
import { hashMagicToken } from "../privacy/magic-token.js";
import { writeAuditLog } from "../middleware/audit.middleware.js";
import { generateIceBreakers } from "./icebreaker.service.js";
import { embedApplicant } from "./embedding.service.js";

// ── Auth ──────────────────────────────────────────────────────────────────────

export type LoginAttemptResult =
  | { status: "ok"; applicant: ApplicantDoc }
  | { status: "first_login" }
  | { status: "password_required" }
  | null; // unknown magic token, or wrong password

export async function loginWithMagicToken(
  magicToken: string,
  password?: string,
  currentApplicantId?: string | null
): Promise<LoginAttemptResult> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);

  const doc = await col.findOne({ magicToken: hashMagicToken(magicToken) });
  if (!doc) return null;

  // Already signed in as this applicant — refresh the session instead of
  // re-prompting for a password (e.g. revisiting the magic link).
  if (currentApplicantId && doc._id.equals(currentApplicantId)) {
    return { status: "ok", applicant: doc };
  }

  if (doc.passwordHash === null) return { status: "first_login" };

  if (!password) return { status: "password_required" };
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
  deletionScheduledAt: Date | null;
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
    deletionScheduledAt: doc.deletionScheduledAt ?? null,
  };
}

// ── Answers (self-service questionnaire edits) ───────────────────────────────

// Never sent to the applicant editor and never overwritten by it:
// instagram_handle is defense in depth (identities live in a separate,
// encrypted collection), disclaimer_agreed is a one-time consent.
const NON_EDITABLE_ANSWER_KEYS = new Set(["instagram_handle", "disclaimer_agreed"]);

export async function getMyAnswers(
  applicantId: string
): Promise<Record<string, unknown> | null> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);

  const doc = await col.findOne(
    { _id: new ObjectId(applicantId) },
    { projection: { answers: 1 } }
  );
  if (!doc) return null;

  return Object.fromEntries(
    Object.entries(doc.answers ?? {}).filter(([key]) => !NON_EDITABLE_ANSWER_KEYS.has(key))
  );
}

export async function updateMyAnswers(
  applicantId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);
  const oid = new ObjectId(applicantId);

  const doc = await col.findOne({ _id: oid }, { projection: { answers: 1, alias: 1 } });
  if (!doc) throw new AppError("Not found", 404);

  // Merge over the stored answers so non-editable keys survive untouched.
  // The validator already rejects them in `updates`; filtering again here
  // keeps the invariant even if a future caller skips validation.
  const merged: Record<string, unknown> = { ...(doc.answers ?? {}) };
  for (const [key, value] of Object.entries(updates)) {
    if (NON_EDITABLE_ANSWER_KEYS.has(key)) continue;
    merged[key] = value;
  }
  // height_cm is the only optional field — absence in a full-form update means cleared
  if (!("height_cm" in updates)) delete merged["height_cm"];

  await col.updateOne({ _id: oid }, { $set: { answers: merged, updatedAt: new Date() } });

  // Refresh embeddings in the background (same as submission) so the next
  // matching run scores against the updated text
  embedApplicant(oid, merged).catch((err) =>
    console.error(`[profile] Background embedding refresh failed for ${doc.alias}:`, err)
  );
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function getMyMatches(
  applicantId: string,
  threshold: number,
  limit: number,
  audit: { ipAddress: string; userAgent: string } = { ipAddress: "unknown", userAgent: "unknown" },
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

  // Batch-load partner answers so each card can show who the match is —
  // answers hold only public questionnaire fields, never the Instagram handle
  const partnerIds = docs.map((d) =>
    d.applicantAId.equals(oid) ? d.applicantBId : d.applicantAId
  );
  const partners = partnerIds.length
    ? await appCol
        .find({ _id: { $in: partnerIds } }, { projection: { answers: 1 } })
        .toArray()
    : [];
  const answersById = new Map(partners.map((p) => [p._id.toHexString(), p.answers]));

  // Reveal partner identities for committed matches (in_progress/dating) —
  // the contact flow already revealed the target's handle to the initiator,
  // and the initiator consented by initiating. The decryption is audit-logged
  // once per applicant per match, not on every page load.
  const instagramByMatchId = new Map<string, string>();
  for (const d of docs) {
    if (d.status !== "in_progress" && d.status !== "dating") continue;
    const partnerId = d.applicantAId.equals(oid) ? d.applicantBId : d.applicantAId;
    const alreadyLogged = d.identityViewLoggedFor?.includes(applicantId) ?? false;

    const handle = alreadyLogged
      ? await resolveIdentityById(partnerId)
      : await revealIdentityById(partnerId, {
          actor: { adminId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
          action: "APPLICANT_REVEAL_IDENTITY",
          targetAlias: d.applicantAId.equals(oid) ? d.applicantBAlias : d.applicantAAlias,
          metadata: {
            actorType: "applicant",
            matchId: d._id.toHexString(),
            reason: "match_view",
          },
        });
    if (!handle) continue;
    instagramByMatchId.set(d._id.toHexString(), handle);

    if (!alreadyLogged) {
      await matchCol.updateOne(
        { _id: d._id },
        { $addToSet: { identityViewLoggedFor: applicantId } }
      );
    }
  }

  return docs.map((d) => {
    const partnerId = d.applicantAId.equals(oid) ? d.applicantBId : d.applicantAId;
    return toMatchView(
      d,
      oid,
      answersById.get(partnerId.toHexString()),
      instagramByMatchId.get(d._id.toHexString())
    );
  });
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

  // Pre-flight identity check before any mutation — prevents stuck state if
  // identity is missing. Existence only: the decrypt (and its audit log)
  // happens after the atomic claim below, via revealIdentityById.
  if (!(await identityExistsById(targetId))) {
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
        // The contact reveal is logged below — repeat views on the matches
        // page must not write another entry for the initiator
        identityViewLoggedFor: [applicantId],
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw new AppError("Match is no longer available for contact — it may have been claimed concurrently", 409);
  }

  // Exclusive contact: committing to one match expires the initiator's other
  // proposed/in_progress matches. The target's other matches are untouched —
  // they haven't acted yet. (Accept later expires both sides as before.)
  await expireConflictingMatches([actorId], matchOid);

  // Decrypt + audit log after winning the race — revealIdentityById logs
  // before the plaintext is returned. Existence was verified pre-flight.
  const targetInstagram = await revealIdentityById(targetId, {
    actor: { adminId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
    action: "APPLICANT_REVEAL_IDENTITY",
    targetAlias: match.applicantAId.equals(actorId)
      ? match.applicantBAlias
      : match.applicantAAlias,
    metadata: {
      actorType: "applicant",
      matchId,
      reason: "contact_request",
    },
  });
  if (!targetInstagram) {
    throw new AppError("Target identity not found", 404);
  }

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

/**
 * Initiator backs out after the identity reveal. The match becomes "declined"
 * (terminal) so the pair is permanently excluded from future matching runs —
 * the applicant waits for the next matching phase for fresh matches.
 */
export async function withdrawContact(
  applicantId: string,
  matchId: string
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

  assertMatchTransition(match, "withdraw", actorId);

  const now = new Date();

  // Atomic claim — a concurrent accept/decline from the target wins or loses
  // the race cleanly instead of both transitions applying
  const claimed = await matchCol.findOneAndUpdate(
    { _id: matchOid, status: "in_progress" },
    {
      $set: {
        status:             "declined",
        contactRespondedAt: now,
        updatedAt:          now,
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw new AppError("Match was already responded to", 409);
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

/**
 * Cancels a pending account deletion and restores the applicant to the
 * matching pool. Only valid while a deletion is actually scheduled.
 */
export async function cancelAccountDeletion(applicantId: string): Promise<void> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);
  const oid = new ObjectId(applicantId);

  const result = await col.findOneAndUpdate(
    { _id: oid, status: "inactive", deletionScheduledAt: { $exists: true } },
    { $set: { status: "applied", updatedAt: new Date() }, $unset: { deletionScheduledAt: "" } },
  );

  if (!result) throw new AppError("No deletion is scheduled for this account", 409);
}

/**
 * Immediate, irreversible self-deletion — bypasses the 180-day grace period.
 * Removes the applicant document, their identity record, embeddings, and
 * any matches involving them.
 */
export async function deleteMyAccountNow(
  applicantId: string,
  audit: { ipAddress: string; userAgent: string } = { ipAddress: "unknown", userAgent: "unknown" },
): Promise<void> {
  const db  = await getDb();
  const oid = new ObjectId(applicantId);

  const appCol        = getApplicantsCollection(db);
  const matchCol      = getMatchesCollection(db);
  const identitiesCol = getIdentitiesCollection(db);
  const embeddingsCol = getEmbeddingsCollection(db);

  const doc = await appCol.findOne({ _id: oid });
  if (!doc) throw new AppError("Not found", 404);

  // Audit before the data it references is removed
  await writeAuditLog(
    { adminId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
    "APPLICANT_SELF_DELETE",
    { targetApplicantId: oid, targetAlias: doc.alias, metadata: { actorType: "applicant" } },
  );

  await Promise.all([
    appCol.deleteOne({ _id: oid }),
    identitiesCol.deleteOne({ applicantId: oid }),
    embeddingsCol.deleteOne({ applicantId: oid }),
    matchCol.deleteMany({ $or: [{ applicantAId: oid }, { applicantBId: oid }] }),
  ]);
}

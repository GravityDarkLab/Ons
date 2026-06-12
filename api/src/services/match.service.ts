import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { AppError } from "../errors.js";
import { getDb } from "../db/connection.js";
import { getMatchesCollection, getApplicantsCollection } from "../db/collections.js";
import type { MatchDoc, MatchStatus } from "../models/match.model.js";
import type { ApplicantDoc, ApplicantStatus } from "../models/applicant.model.js";
import { proposalPairAction, type CoupleProposal } from "../matching/proposals.js";
import type { PaginatedResult } from "./admin.service.js";

// ── Admin view (ObjectIds serialised to strings) ──────────────────────────────

export type MatchView = Omit<MatchDoc, "_id" | "applicantAId" | "applicantBId"> & {
  id: string;
  applicantAId: string;
  applicantBId: string;
};

function toView(doc: MatchDoc): MatchView {
  const { _id, applicantAId, applicantBId, ...rest } = doc;
  return {
    id: _id.toHexString(),
    applicantAId: applicantAId.toHexString(),
    applicantBId: applicantBId.toHexString(),
    ...rest,
  };
}

// ── Applicant-facing view (privacy-preserving, perspective-aware) ─────────────

export type MatchPerspective = "initiator" | "target" | "none";

export interface ApplicantMatchView {
  matchId: string;
  partnerAlias: string;
  score: number;
  breakdown?: Record<string, number>;
  status: MatchStatus;
  perspective: MatchPerspective;
  contactRequestedAt?: Date; // when the initiator clicked "contact" — shown to target
  iceBreakers?: string[];
  dateIdeas?: string[];
  partnerProfile?: Record<string, unknown>; // partner's public questionnaire answers
  partnerInstagram?: string; // only for in_progress/dating — see toMatchView
}

// Keys never shown to a partner: consent checkboxes carry no information, and
// instagram_handle is defense in depth — identity answers are stored encrypted
// in a separate collection and should never appear in `answers` at all
const PARTNER_PROFILE_EXCLUDED_KEYS = new Set(["disclaimer_agreed", "instagram_handle"]);

/**
 * Pure function — no DB calls. Projects a MatchDoc into the applicant-facing view
 * from the perspective of `actorId`. Instagram handles are never included:
 * `partnerAnswers` holds only the public answers (identity fields are stored
 * encrypted in a separate collection and never reach the applicants collection).
 */
export function toMatchView(
  doc: MatchDoc,
  actorId: ObjectId,
  partnerAnswers?: Record<string, unknown>,
  partnerInstagram?: string
): ApplicantMatchView {
  const isA       = doc.applicantAId.equals(actorId);
  const partnerAlias = isA ? doc.applicantBAlias : doc.applicantAAlias;

  let perspective: MatchPerspective = "none";
  if (doc.status === "in_progress" && doc.initiatorId) {
    perspective = doc.initiatorId.equals(actorId) ? "initiator" : "target";
  }

  const view: ApplicantMatchView = {
    matchId: doc._id.toHexString(),
    partnerAlias,
    score: doc.score,
    status: doc.status,
    perspective,
  };

  if (doc.breakdown) view.breakdown = doc.breakdown;

  if (partnerAnswers) {
    const profile = Object.fromEntries(
      Object.entries(partnerAnswers).filter(([key]) => !PARTNER_PROFILE_EXCLUDED_KEYS.has(key))
    );
    if (Object.keys(profile).length > 0) view.partnerProfile = profile;
  }

  // Identity is only revealed once contact is committed: the initiator consented
  // by initiating, and the target's handle was already revealed to the initiator
  // at contact time. Never attached while the match is merely proposed.
  if (partnerInstagram && (doc.status === "in_progress" || doc.status === "dating")) {
    view.partnerInstagram = partnerInstagram;
  }

  if (doc.status === "in_progress") {
    if (doc.contactRequestedAt) view.contactRequestedAt = doc.contactRequestedAt;
    if (perspective === "initiator") {
      if (doc.iceBreakers) view.iceBreakers = doc.iceBreakers;
      if (doc.dateIdeas)   view.dateIdeas   = doc.dateIdeas;
    }
  }

  return view;
}

// ── State-machine guard ────────────────────────────────────────────────────────

type MatchAction = "contact" | "respond" | "withdraw" | "outcome";

/**
 * Asserts that `actorId` may perform `action` on `match`.
 * Throws a descriptive Error on any violation — callers map to 403/409.
 */
export function assertMatchTransition(
  match: MatchDoc,
  action: MatchAction,
  actorId: ObjectId
): void {
  const isParticipant =
    match.applicantAId.equals(actorId) || match.applicantBId.equals(actorId);

  if (action === "contact") {
    if (!isParticipant) {
      throw new AppError("Not a participant in this match", 403);
    }
    if (match.status !== "proposed") {
      // Target should use the respond endpoint, not contact
      if (match.status === "in_progress" && !match.initiatorId?.equals(actorId)) {
        throw new AppError("Use the respond endpoint to accept or decline", 403);
      }
      // Any other state (duplicate, terminal): conflict
      throw new AppError(`Match status is "${match.status}" — contact not allowed`, 409);
    }
    return;
  }

  if (action === "respond") {
    if (!isParticipant) {
      throw new AppError("Not a participant in this match", 403);
    }
    if (match.status !== "in_progress") {
      throw new AppError(`Match status is "${match.status}" — nothing to respond to`, 409);
    }
    if (match.initiatorId?.equals(actorId)) {
      throw new AppError("Initiator cannot respond to their own contact request", 403);
    }
    return;
  }

  if (action === "withdraw") {
    if (!isParticipant) {
      throw new AppError("Not a participant in this match", 403);
    }
    if (match.status !== "in_progress") {
      throw new AppError(`Match status is "${match.status}" — nothing to withdraw`, 409);
    }
    if (!match.initiatorId?.equals(actorId)) {
      throw new AppError("Only the initiator can withdraw their contact request", 403);
    }
    return;
  }

  if (action === "outcome") {
    if (!isParticipant) {
      throw new AppError("Not a participant in this match", 403);
    }
    if (match.status !== "dating" && match.status !== "in_progress") {
      throw new AppError(`Match status is "${match.status}" — outcome cannot be reported`, 409);
    }
    return;
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Expires all proposed/in_progress matches for the given applicant IDs.
 * Called when someone contacts a match (their other matches expire), accepts
 * contact, or deactivates. `excludeMatchId` keeps the match being acted on
 * out of its own sweep.
 */
export async function expireConflictingMatches(
  applicantIds: ObjectId[],
  excludeMatchId?: ObjectId
): Promise<void> {
  const db  = await getDb();
  const col = getMatchesCollection(db);
  const now = new Date();

  const filter: Record<string, unknown> = {
    $or: [
      { applicantAId: { $in: applicantIds } },
      { applicantBId: { $in: applicantIds } },
    ],
    status: { $in: ["proposed", "in_progress"] },
  };
  if (excludeMatchId) filter._id = { $ne: excludeMatchId };

  await col.updateMany(filter, { $set: { status: "expired", updatedAt: now } });
}

/** Portal slider floor — matches below this score are never shown to applicants. */
export const PORTAL_MIN_SCORE = 0.6;

/** Grace period before personal data of inactive accounts is purged. Configurable via DELETION_GRACE_DAYS. */
export const DELETION_GRACE_MS = env.deletionGraceDays * 24 * 60 * 60 * 1000;

/**
 * Promotes "applied" applicants to "matched" when they have at least one
 * proposed match visible in the portal (score ≥ PORTAL_MIN_SCORE).
 * Called after every matching pass (admin-triggered and scheduled).
 */
export async function promoteAppliedToMatched(): Promise<number> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);
  const appCol   = getApplicantsCollection(db);

  const proposed = await matchCol
    .find(
      { status: "proposed", score: { $gte: PORTAL_MIN_SCORE } },
      { projection: { applicantAId: 1, applicantBId: 1 } },
    )
    .toArray();
  if (proposed.length === 0) return 0;

  const ids = new Map<string, ObjectId>();
  for (const m of proposed) {
    ids.set(m.applicantAId.toHexString(), m.applicantAId);
    ids.set(m.applicantBId.toHexString(), m.applicantBId);
  }

  const res = await appCol.updateMany(
    { _id: { $in: [...ids.values()] }, status: "applied" },
    { $set: { status: "matched", updatedAt: new Date() } },
  );
  return res.modifiedCount;
}

/**
 * Transitions multiple applicants to a new status in a single updateMany.
 */
export async function transitionApplicantStatus(
  ids: ObjectId[],
  newStatus: ApplicantStatus,
  extra?: Partial<Pick<ApplicantDoc, "deletionScheduledAt">>
): Promise<void> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);
  const now = new Date();

  await col.updateMany(
    { _id: { $in: ids } },
    { $set: { status: newStatus, updatedAt: now, ...extra } }
  );
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listMatches(
  page: number,
  limit: number,
  status?: MatchStatus,
  participantId?: string,
  search?: string,
): Promise<PaginatedResult<MatchView>> {
  const db  = await getDb();
  const col = getMatchesCollection(db);

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const andClauses: Record<string, unknown>[] = [];

  if (participantId) {
    let oid: ObjectId;
    try { oid = new ObjectId(participantId); } catch {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }
    andClauses.push({ $or: [{ applicantAId: oid }, { applicantBId: oid }] });
  }

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    andClauses.push({
      $or: [
        { applicantAAlias: { $regex: safeSearch, $options: "i" } },
        { applicantBAlias: { $regex: safeSearch, $options: "i" } },
      ],
    });
  }

  if (andClauses.length > 0) filter.$and = andClauses;

  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    col.find(filter).sort({ score: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  return {
    data: docs.map(toView),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateMatch(
  id: string,
  updates: { status?: MatchStatus; notes?: string },
): Promise<MatchView | null> {
  const db  = await getDb();
  const col = getMatchesCollection(db);

  let oid: ObjectId;
  try { oid = new ObjectId(id); } catch { return null; }

  const result = await col.findOneAndUpdate(
    { _id: oid },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  return result ? toView(result) : null;
}

export async function deleteMatch(id: string): Promise<boolean> {
  const db  = await getDb();
  const col = getMatchesCollection(db);

  let oid: ObjectId;
  try { oid = new ObjectId(id); } catch { return false; }

  const result = await col.deleteOne({ _id: oid });
  return result.deletedCount > 0;
}

// ── Proposal persistence ──────────────────────────────────────────────────────

export async function saveMatchProposals(
  proposals: CoupleProposal[],
  algorithm: string,
): Promise<number> {
  if (proposals.length === 0) return 0;

  const db  = await getDb();
  const col = getMatchesCollection(db);

  const now = new Date();
  let saved = 0;

  for (const p of proposals) {
    const existing = await col.findOne({
      applicantAId: p.applicantAId,
      applicantBId: p.applicantBId,
    });

    const action = proposalPairAction(existing?.status);
    if (action === "skip") continue;

    if (action === "revive" && existing) {
      const revived = await col.updateOne(
        { _id: existing._id, status: "expired" },
        {
          $set: {
            score:     p.score,
            breakdown: p.breakdown,
            algorithm,
            status:    "proposed",
            updatedAt: now,
          },
          $unset: {
            initiatorId:        "",
            iceBreakers:        "",
            dateIdeas:          "",
            contactRequestedAt: "",
            contactRespondedAt: "",
          },
        }
      );
      if (revived.modifiedCount > 0) saved++;
      continue;
    }

    try {
      await col.insertOne({
        _id:             new ObjectId(),
        applicantAId:    p.applicantAId,
        applicantAAlias: p.applicantAAlias,
        applicantBId:    p.applicantBId,
        applicantBAlias: p.applicantBAlias,
        score:           p.score,
        breakdown:       p.breakdown,
        algorithm,
        status:          "proposed",
        createdAt:       now,
        updatedAt:       now,
      });
      saved++;
    } catch (err: unknown) {
      if ((err as { code?: number })?.code !== 11000) throw err;
    }
  }

  return saved;
}

export async function loadActiveApplicants(): Promise<ApplicantDoc[]> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);
  return col.find({ status: { $in: ["applied", "matched"] } }).toArray();
}

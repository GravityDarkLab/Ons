import { ObjectId } from "mongodb";
import { AppError } from "../errors.js";
import type { ApplicantDoc } from "../models/applicant.model.js";
import { getDb } from "../db/connection.js";
import { getApplicantsCollection, getMatchesCollection } from "../db/collections.js";
import { isOrientationCompatible } from "./filters/orientation.filter.js";
import { isAgeCompatible } from "./filters/age.filter.js";
import { isReligionCompatible } from "./filters/religion.filter.js";
import { isLongDistanceCompatible } from "./filters/location.filter.js";
import { isChildrenCompatible } from "./filters/children.filter.js";
import { isHabitsCompatible } from "./filters/habits.filter.js";
import { score } from "./scorer.js";

export interface MatchScore {
  score: number;
  breakdown: Record<string, number>;
}

export interface RankedCandidate {
  alias: string;
  applicantId: string;
  /** Compatibility score in [0, 1] from the rule-based scorer. */
  score: number;
  breakdown: Record<string, number>;
}

/**
 * Returns the hex IDs of every applicant currently in an `in_progress` match
 * (an exclusive contact awaiting a response). They're mid-conversation and
 * must not receive new proposals until that contact resolves.
 */
export async function getActiveContactApplicantIds(): Promise<Set<string>> {
  const db  = await getDb();
  const col = getMatchesCollection(db);

  const inProgress = await col
    .find({ status: "in_progress" }, { projection: { applicantAId: 1, applicantBId: 1 } })
    .toArray();

  const ids = new Set<string>();
  for (const m of inProgress) {
    ids.add(m.applicantAId.toHexString());
    ids.add(m.applicantBId.toHexString());
  }
  return ids;
}

/** Hard, binary filters — an excluded pair gets no result, not a low score. */
function applyFilters(target: ApplicantDoc, candidates: ApplicantDoc[]): ApplicantDoc[] {
  return candidates.filter(
    (c) =>
      isOrientationCompatible(target, c) &&
      isAgeCompatible(target, c) &&
      isReligionCompatible(target, c) &&
      isLongDistanceCompatible(target, c) &&
      isChildrenCompatible(target, c) &&
      isHabitsCompatible(target, c),
  );
}

/** Filters, scores and ranks `candidates` for `target`; best first, at most `topN`. */
function rank(target: ApplicantDoc, candidates: ApplicantDoc[], topN: number): RankedCandidate[] {
  return applyFilters(target, candidates)
    .map((other) => ({
      alias:       other.alias,
      applicantId: other._id.toHexString(),
      ...score(target, other),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Returns the top N candidates scored against the given applicant.
 */
export async function getCandidates(
  applicantId: string,
  topN = 10,
): Promise<RankedCandidate[]> {
  const db = await getDb();
  const col = getApplicantsCollection(db);

  let targetId: ObjectId;
  try {
    targetId = new ObjectId(applicantId);
  } catch {
    throw new AppError(`Invalid applicant ID: ${applicantId}`, 400);
  }

  const target = await col.findOne({ _id: targetId, status: { $in: ["applied", "matched"] } });
  if (!target) {
    throw new AppError(`Active applicant not found: ${applicantId}`, 404);
  }

  const activeContactIds = await getActiveContactApplicantIds();
  if (activeContactIds.has(targetId.toHexString())) {
    return [];
  }

  const others = await col
    .find({ _id: { $ne: targetId }, status: { $in: ["applied", "matched"] } })
    .toArray();

  const eligible = others.filter((o) => !activeContactIds.has(o._id.toHexString()));
  return rank(target, eligible, topN);
}

/**
 * Runs a full pairwise matching pass over all active applicants.
 * Returns a map of applicantId → ranked candidates (top 10 each).
 */
export async function runFullMatchingPass(): Promise<Record<string, RankedCandidate[]>> {
  const db = await getDb();
  const col = getApplicantsCollection(db);
  const applicants = await col.find({ status: { $in: ["applied", "matched"] } }).toArray();

  const activeContactIds = await getActiveContactApplicantIds();
  const eligible = applicants.filter((a) => !activeContactIds.has(a._id.toHexString()));

  if (eligible.length < 2) {
    return {};
  }

  const results: Record<string, RankedCandidate[]> = {};

  for (const applicant of eligible) {
    const id = applicant._id.toHexString();
    // The scorer is total by design, but one unexpected failure must never
    // abort matching for everyone else — degrade that applicant to no
    // candidates this round instead.
    try {
      results[id] = rank(applicant, eligible.filter((o) => !o._id.equals(applicant._id)), 10);
    } catch (err) {
      console.error(`[engine] Scoring failed for applicant ${id}, degrading to no candidates this round:`, err);
      results[id] = [];
    }
  }

  return results;
}

// Re-export types needed by other modules
export type { ApplicantDoc };

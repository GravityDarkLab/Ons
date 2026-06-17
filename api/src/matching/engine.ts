import { ObjectId } from "mongodb";
import { AppError } from "../errors.js";
import type { ApplicantDoc } from "../models/applicant.model.js";
import type { QuestionnaireDoc } from "../models/questionnaire.model.js";
import { getDb } from "../db/connection.js";
import { getApplicantsCollection, getMatchesCollection } from "../db/collections.js";
import { getActiveQuestionnaire } from "../services/questionnaire.service.js";
import { isOrientationCompatible } from "./filters/orientation.filter.js";
import { isAgeCompatible } from "./filters/age.filter.js";
import { prepare, score } from "./scorer.js";

export interface MatchScore {
  score: number;
  breakdown: Record<string, number>;
}

export interface RankedCandidate {
  alias: string;
  applicantId: string;
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

function applyFilters(target: ApplicantDoc, candidates: ApplicantDoc[]): ApplicantDoc[] {
  return candidates.filter(
    (c) => isOrientationCompatible(target, c) && isAgeCompatible(target, c)
  );
}

/**
 * Returns the top N candidates scored against the given applicant.
 */
export async function getCandidates(
  applicantId: string,
  topN = 10,
): Promise<RankedCandidate[]> {
  const questionnaire = await getActiveQuestionnaire();
  if (!questionnaire) {
    throw new AppError("No active questionnaire found", 404);
  }

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
  const compatible = applyFilters(target, eligible);

  await prepare([target, ...compatible], questionnaire);

  const scored: RankedCandidate[] = compatible.map((other) => {
    const result = score(target, other, questionnaire);
    return {
      alias:       other.alias,
      applicantId: other._id.toHexString(),
      score:       result.score,
      breakdown:   result.breakdown,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}

/**
 * Runs a full pairwise matching pass over all active applicants.
 * Returns a map of applicantId → ranked candidates.
 */
export async function runFullMatchingPass(): Promise<Record<string, RankedCandidate[]>> {
  const questionnaire = await getActiveQuestionnaire();
  if (!questionnaire) {
    throw new AppError("No active questionnaire found", 404);
  }

  const db = await getDb();
  const col = getApplicantsCollection(db);
  const applicants = await col.find({ status: { $in: ["applied", "matched"] } }).toArray();

  if (applicants.length < 2) {
    return {};
  }

  const activeContactIds = await getActiveContactApplicantIds();
  const eligible = applicants.filter((a) => !activeContactIds.has(a._id.toHexString()));

  if (eligible.length < 2) {
    return {};
  }

  await prepare(eligible, questionnaire);

  const results: Record<string, RankedCandidate[]> = {};

  for (const applicant of eligible) {
    const others = eligible.filter((o) => !o._id.equals(applicant._id));
    const compatible = applyFilters(applicant, others);

    const scored: RankedCandidate[] = compatible.map((other) => {
      const result = score(applicant, other, questionnaire);
      return {
        alias:       other.alias,
        applicantId: other._id.toHexString(),
        score:       result.score,
        breakdown:   result.breakdown,
      };
    });

    results[applicant._id.toHexString()] = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  return results;
}

// Re-export types needed by other modules
export type { ApplicantDoc, QuestionnaireDoc };

import { ObjectId } from "mongodb";
import { AppError } from "../errors.js";
import type { ApplicantDoc } from "../models/applicant.model.js";
import type { QuestionnaireDoc } from "../models/questionnaire.model.js";
import { getDb } from "../db/connection.js";
import { getApplicantsCollection, getMatchesCollection } from "../db/collections.js";
import { getActiveQuestionnaire } from "../services/questionnaire.service.js";
import { baselineAlgorithm } from "./algorithms/baseline.js";
import { cosineAlgorithm } from "./algorithms/cosine.js";
import { embeddingCosineAlgorithm } from "./algorithms/embedding-cosine.js";
import { filterCandidates } from "./filters.js";

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
 * Plugin interface that all matching algorithms must implement.
 *
 * Optional prepare() hook:
 * Called once by the engine before any pairwise scoring begins.
 * Use it for expensive one-time setup — e.g. batch-embedding all applicants
 * so that score() can run synchronously from a warm cache.
 * If prepare() is absent the engine skips it (baseline/cosine don't need it).
 */
export interface Algorithm {
  name: string;
  prepare?: (
    applicants: ApplicantDoc[],
    questionnaire: QuestionnaireDoc
  ) => Promise<void>;
  score(
    a: ApplicantDoc,
    b: ApplicantDoc,
    questionnaire: QuestionnaireDoc
  ): MatchScore;
}

const ALGORITHM_REGISTRY: Record<string, Algorithm> = {
  "baseline": baselineAlgorithm,
  "cosine": cosineAlgorithm,
  "embedding-cosine": embeddingCosineAlgorithm,
};

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

/**
 * Returns the top N candidates scored against the given applicant.
 */
export async function getCandidates(
  applicantId: string,
  topN = 10,
  algorithmName = "embedding-cosine"
): Promise<RankedCandidate[]> {
  const algorithm = ALGORITHM_REGISTRY[algorithmName];
  if (!algorithm) {
    throw new AppError(`Unknown algorithm: ${algorithmName}`, 400);
  }

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

  // Applicants mid-contact (in_progress) are not eligible for new suggestions
  const activeContactIds = await getActiveContactApplicantIds();
  if (activeContactIds.has(targetId.toHexString())) {
    return [];
  }

  // Load all other active applicants
  const others = await col
    .find({ _id: { $ne: targetId }, status: { $in: ["applied", "matched"] } })
    .toArray();

  const eligibleOthers = others.filter((o) => !activeContactIds.has(o._id.toHexString()));

  // Hard filters — remove incompatible candidates before scoring
  const compatible = filterCandidates(target, eligibleOthers);

  // Allow the algorithm to pre-compute anything it needs (e.g. embeddings)
  if (algorithm.prepare) {
    await algorithm.prepare([target, ...compatible], questionnaire);
  }

  // Score pairwise
  const scored: RankedCandidate[] = compatible.map((other) => {
    const result = algorithm.score(target, other, questionnaire);
    return {
      alias: other.alias,
      applicantId: other._id.toHexString(),
      score: result.score,
      breakdown: result.breakdown,
    };
  });

  // Sort descending by score, return top N
  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}

/**
 * Runs a full pairwise matching pass over all active applicants.
 * Returns a map of applicantId -> ranked candidates.
 */
export async function runFullMatchingPass(
  algorithmName = "embedding-cosine"
): Promise<Record<string, RankedCandidate[]>> {
  const algorithm = ALGORITHM_REGISTRY[algorithmName];
  if (!algorithm) {
    throw new AppError(`Unknown algorithm: ${algorithmName}`, 400);
  }

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

  // Applicants mid-contact (in_progress) sit out this pass entirely — they're
  // not offered as candidates and don't receive new proposals themselves.
  const activeContactIds = await getActiveContactApplicantIds();
  const eligible = applicants.filter((a) => !activeContactIds.has(a._id.toHexString()));

  if (eligible.length < 2) {
    return {};
  }

  // Allow the algorithm to pre-compute anything it needs (e.g. embeddings)
  if (algorithm.prepare) {
    await algorithm.prepare(eligible, questionnaire);
  }

  const results: Record<string, RankedCandidate[]> = {};

  for (const applicant of eligible) {
    const scored: RankedCandidate[] = [];
    const compatible = filterCandidates(applicant, eligible.filter((o) => !o._id.equals(applicant._id)));

    for (const other of compatible) {
      const result = algorithm.score(applicant, other, questionnaire);
      scored.push({
        alias: other.alias,
        applicantId: other._id.toHexString(),
        score: result.score,
        breakdown: result.breakdown,
      });
    }

    results[applicant._id.toHexString()] = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  return results;
}

export { ALGORITHM_REGISTRY };

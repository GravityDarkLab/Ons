import { ObjectId } from "mongodb";
import type { ApplicantDoc } from "../models/applicant.model.js";
import type { QuestionnaireDoc } from "../models/questionnaire.model.js";
import { getDb } from "../db/connection.js";
import { getApplicantsCollection } from "../db/collections.js";
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
 * Returns the top N candidates scored against the given applicant.
 */
export async function getCandidates(
  applicantId: string,
  topN = 10,
  algorithmName = "embedding-cosine"
): Promise<RankedCandidate[]> {
  const algorithm = ALGORITHM_REGISTRY[algorithmName];
  if (!algorithm) {
    throw new Error(`Unknown algorithm: ${algorithmName}`);
  }

  const questionnaire = await getActiveQuestionnaire();
  if (!questionnaire) {
    throw new Error("No active questionnaire found");
  }

  const db = await getDb();
  const col = getApplicantsCollection(db);

  const { ObjectId } = await import("mongodb");
  let targetId: import("mongodb").ObjectId;
  try {
    targetId = new ObjectId(applicantId);
  } catch {
    throw new Error(`Invalid applicant ID: ${applicantId}`);
  }

  const target = await col.findOne({ _id: targetId, status: { $in: ["applied", "matched"] } });
  if (!target) {
    throw new Error(`Active applicant not found: ${applicantId}`);
  }

  // Load all other active applicants
  const others = await col
    .find({ _id: { $ne: targetId }, status: { $in: ["applied", "matched"] } })
    .toArray();

  // Hard filters — remove incompatible candidates before scoring
  const compatible = filterCandidates(target, others);

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
    throw new Error(`Unknown algorithm: ${algorithmName}`);
  }

  const questionnaire = await getActiveQuestionnaire();
  if (!questionnaire) {
    throw new Error("No active questionnaire found");
  }

  const db = await getDb();
  const col = getApplicantsCollection(db);
  const applicants = await col.find({ status: { $in: ["applied", "matched"] } }).toArray();

  if (applicants.length < 2) {
    return {};
  }

  // Allow the algorithm to pre-compute anything it needs (e.g. embeddings)
  if (algorithm.prepare) {
    await algorithm.prepare(applicants, questionnaire);
  }

  const results: Record<string, RankedCandidate[]> = {};

  for (const applicant of applicants) {
    const scored: RankedCandidate[] = [];
    const compatible = filterCandidates(applicant, applicants.filter((o) => !o._id.equals(applicant._id)));

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

// ── Couple proposal generation ─────────────────────────────────────────────────

export interface CoupleProposal {
  applicantAId: ObjectId;
  applicantAAlias: string;
  applicantBId: ObjectId;
  applicantBAlias: string;
  /** Symmetric score: average of A→B and B→A when both exist */
  score: number;
}

/**
 * Derives unique couple proposals from a full matching pass result.
 *
 * Each pair (A, B) is canonicalised so the smaller hex string is always "A".
 * The symmetric score is the average of A→B and B→A scores (however many
 * exist). Pairs that appear only once still get a valid score.
 *
 * Returns proposals sorted by score descending.
 */
export function generateCoupleProposals(
  applicants: ApplicantDoc[],
  results: Record<string, RankedCandidate[]>,
): CoupleProposal[] {
  // Quick lookup by hex ID
  const applicantMap = new Map<string, ApplicantDoc>();
  for (const a of applicants) {
    applicantMap.set(a._id.toHexString(), a);
  }

  // Build directed score map: "aId→bId" → score
  const scoreMap = new Map<string, number>();
  for (const [aId, candidates] of Object.entries(results)) {
    for (const cand of candidates) {
      scoreMap.set(`${aId}→${cand.applicantId}`, cand.score);
    }
  }

  const seen = new Set<string>();
  const proposals: CoupleProposal[] = [];

  for (const [aId, candidates] of Object.entries(results)) {
    for (const cand of candidates) {
      const bId = cand.applicantId;
      // Canonical order: lexicographically smaller hex ID first
      const [firstId, secondId] = aId < bId ? [aId, bId] : [bId, aId];
      const key = `${firstId}:${secondId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const scoreAB = scoreMap.get(`${firstId}→${secondId}`) ?? 0;
      const scoreBA = scoreMap.get(`${secondId}→${firstId}`) ?? 0;
      const count   = (scoreAB > 0 ? 1 : 0) + (scoreBA > 0 ? 1 : 0);
      const symScore = count > 0 ? (scoreAB + scoreBA) / count : 0;

      const applicantA = applicantMap.get(firstId);
      const applicantB = applicantMap.get(secondId);
      if (!applicantA || !applicantB) continue;

      proposals.push({
        applicantAId:    applicantA._id,
        applicantAAlias: applicantA.alias,
        applicantBId:    applicantB._id,
        applicantBAlias: applicantB.alias,
        score:           symScore,
      });
    }
  }

  return proposals.sort((a, b) => b.score - a.score);
}

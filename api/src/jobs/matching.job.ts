import { loadActiveApplicants, saveMatchProposals } from "../services/match.service.js";
import { runFullMatchingPass } from "../matching/engine.js";
import { generateCoupleProposals } from "../matching/proposals.js";
import { transitionApplicantStatus } from "../services/match.service.js";
import { getDb } from "../db/connection.js";
import { getMatchesCollection } from "../db/collections.js";
import type { ObjectId } from "mongodb";

/**
 * Full scheduled matching run:
 * 1. Load all eligible applicants (applied + matched)
 * 2. Run the embedding-cosine algorithm over all pairs
 * 3. Persist new couple proposals
 * 4. Transition any "applied" applicants who now have proposals to "matched"
 */
export async function runScheduledMatchingJob(): Promise<void> {
  const startedAt = Date.now();
  console.info("[matching-job] Starting scheduled matching run...");

  try {
    const applicants = await loadActiveApplicants();
    if (applicants.length < 2) {
      console.info("[matching-job] Fewer than 2 active applicants — skipping.");
      return;
    }

    const results  = await runFullMatchingPass("embedding-cosine");
    const proposals = generateCoupleProposals(applicants, results);
    const saved    = await saveMatchProposals(proposals, "embedding-cosine");

    console.info(`[matching-job] Saved ${saved} new proposals from ${proposals.length} candidates.`);

    // Transition applied applicants who now have at least one proposed match
    // above their score threshold to "matched"
    await promoteAppliedToMatched();

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.info(`[matching-job] Done in ${elapsed}s.`);
  } catch (err) {
    console.error("[matching-job] Error during scheduled run:", err);
    // Never rethrow — the caller (setInterval) must not crash the process
  }
}

async function promoteAppliedToMatched(): Promise<void> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);

  // Collect the best (highest) proposed match score per participant
  const proposed = await matchCol
    .find({ status: "proposed" }, { projection: { applicantAId: 1, applicantBId: 1, score: 1 } })
    .toArray();

  if (proposed.length === 0) return;

  const bestScore = new Map<string, number>();
  for (const m of proposed) {
    const a = m.applicantAId.toHexString();
    const b = m.applicantBId.toHexString();
    bestScore.set(a, Math.max(bestScore.get(a) ?? 0, m.score));
    bestScore.set(b, Math.max(bestScore.get(b) ?? 0, m.score));
  }

  const { ObjectId } = await import("mongodb");
  const ids = [...bestScore.keys()].map((id) => new ObjectId(id));

  const { getApplicantsCollection } = await import("../db/collections.js");
  const appCol = getApplicantsCollection(db);

  // Only promote "applied" applicants whose best match score meets their threshold
  const candidates = await appCol
    .find(
      { _id: { $in: ids }, status: "applied" },
      { projection: { _id: 1, scoreThreshold: 1 } },
    )
    .toArray();

  const toPromote = candidates
    .filter((a) => (bestScore.get(a._id.toHexString()) ?? 0) >= (a.scoreThreshold ?? 0.8))
    .map((a) => a._id);

  if (toPromote.length === 0) return;

  await transitionApplicantStatus(toPromote, "matched");

  console.info(`[matching-job] Promoted ${toPromote.length} applicants: applied → matched.`);
}

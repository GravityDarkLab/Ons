import { loadActiveApplicants, saveMatchProposals } from "../services/match.service.js";
import { runFullMatchingPass, generateCoupleProposals } from "../matching/engine.js";
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

  // Find all proposed matches and collect unique participant IDs
  const proposed = await matchCol
    .find({ status: "proposed" }, { projection: { applicantAId: 1, applicantBId: 1 } })
    .toArray();

  if (proposed.length === 0) return;

  const participantIds = new Set<string>();
  for (const m of proposed) {
    participantIds.add(m.applicantAId.toHexString());
    participantIds.add(m.applicantBId.toHexString());
  }

  const { ObjectId } = await import("mongodb");
  const ids: ObjectId[] = [...participantIds].map((id) => new ObjectId(id));

  // Only transition applicants currently in "applied" state
  const { getApplicantsCollection } = await import("../db/collections.js");
  const appCol = getApplicantsCollection(db);

  const appliedWithMatches = await appCol
    .find({ _id: { $in: ids }, status: "applied" }, { projection: { _id: 1 } })
    .toArray();

  if (appliedWithMatches.length === 0) return;

  await transitionApplicantStatus(
    appliedWithMatches.map((d) => d._id),
    "matched"
  );

  console.info(`[matching-job] Promoted ${appliedWithMatches.length} applicants: applied → matched.`);
}

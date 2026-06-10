import { Context } from "hono";
import { getCandidates, runFullMatchingPass } from "../matching/engine.js";
import { generateCoupleProposals } from "../matching/proposals.js";
import { saveMatchProposals, loadActiveApplicants } from "../services/match.service.js";

/**
 * GET /api/v1/matching/candidates/:applicantId
 * Returns top N candidates scored against the given applicant.
 */
export async function getMatchCandidates(c: Context): Promise<Response> {
  const applicantId = c.req.param("applicantId") ?? "";
  const query = c.req.query();
  const topN = Math.min(50, Math.max(1, parseInt(query.top ?? "10", 10)));
  const algorithm = query.algorithm ?? "baseline";

  try {
    const candidates = await getCandidates(applicantId, topN, algorithm);

    return c.json({
      success: true,
      applicantId,
      candidates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get candidates";
    const status = message.includes("not found") || message.includes("Invalid") ? 404 : 500;
    return c.json({ success: false, error: message }, status as 404 | 500);
  }
}

/**
 * POST /api/v1/matching/run
 * Admin triggers a full matching pass.
 */
export async function runMatching(c: Context): Promise<Response> {
  const body = c.req.valid("json" as never) as { algorithm: string };
  const algorithm = body.algorithm ?? "baseline";

  try {
    const startTime = Date.now();
    const results = await runFullMatchingPass(algorithm);
    const durationMs = Date.now() - startTime;

    const totalApplicants = Object.keys(results).length;

    // Generate couple proposals and persist them.
    // Non-fatal: matching scores are still returned even if persistence fails.
    let couplesProposed = 0;
    try {
      if (totalApplicants >= 2) {
        const applicants = await loadActiveApplicants();
        const proposals  = generateCoupleProposals(applicants, results);
        couplesProposed  = await saveMatchProposals(proposals, algorithm);
      }
    } catch (coupleErr) {
      console.error("[matching] Couple generation/save failed:", coupleErr);
    }

    return c.json({
      success: true,
      algorithm,
      totalApplicants,
      durationMs,
      couplesProposed,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Matching failed";
    return c.json({ success: false, error: message }, 500);
  }
}

import { Context } from "hono";
import { listMatches, updateMatch, deleteMatch } from "../services/match.service.js";
import type { MatchStatus } from "../models/match.model.js";

/**
 * GET /api/v1/admin/matches
 * Query params: page, limit, status, participantId
 */
export async function getMatches(c: Context): Promise<Response> {
  const query         = c.req.query();
  const page          = Math.max(1, parseInt(query.page  ?? "1",  10));
  const limit         = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));
  const status        = query.status       as MatchStatus | undefined;
  const participantId = query.participantId as string     | undefined;

  try {
    const result = await listMatches(page, limit, status, participantId);
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list matches";
    return c.json({ success: false, error: message }, 500);
  }
}

/**
 * PATCH /api/v1/admin/matches/:id
 * Body: { status?, notes? }
 */
export async function patchMatch(c: Context): Promise<Response> {
  const id   = c.req.param("id") ?? "";
  const body = c.req.valid("json" as never) as { status?: MatchStatus; notes?: string };

  try {
    const match = await updateMatch(id, body);
    if (!match) return c.json({ success: false, error: "Match not found" }, 404);
    return c.json({ success: true, data: match });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update match";
    return c.json({ success: false, error: message }, 500);
  }
}

/**
 * DELETE /api/v1/admin/matches/:id
 */
export async function removeMatch(c: Context): Promise<Response> {
  const id = c.req.param("id") ?? "";

  try {
    const ok = await deleteMatch(id);
    if (!ok) return c.json({ success: false, error: "Match not found" }, 404);
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete match";
    return c.json({ success: false, error: message }, 500);
  }
}

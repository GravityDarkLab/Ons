import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

/**
 * Client IP from proxy headers (X-Forwarded-For → X-Real-IP), falling back to
 * the raw socket address when no reverse proxy is in front of the server —
 * this keeps rate-limiting/audit keyed per-client even in direct-to-Bun setups
 * (e.g. local dev) instead of bucketing every such client under "unknown".
 * getConnInfo throws outside a real Bun server (e.g. Hono's in-memory test
 * client), so that branch degrades to "unknown" rather than crashing the request.
 */
export function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip");
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** { ipAddress, userAgent } — the pair nearly every audited or rate-limited request needs. */
export function getRequestMeta(c: Context): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: getClientIp(c),
    userAgent: c.req.header("user-agent") ?? "unknown",
  };
}

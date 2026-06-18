import type { Context } from "hono";

/** Client IP from proxy headers (X-Forwarded-For → X-Real-IP), header names are case-insensitive. */
export function getClientIp(c: Context, fallback = "unknown"): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    fallback
  );
}

/** { ipAddress, userAgent } — the pair nearly every audited or rate-limited request needs. */
export function getRequestMeta(c: Context, ipFallback = "unknown"): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: getClientIp(c, ipFallback),
    userAgent: c.req.header("user-agent") ?? "unknown",
  };
}

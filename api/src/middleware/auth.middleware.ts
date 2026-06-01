import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";
import { type AdminRole, ADMIN_ROLES } from "../models/admin.model.js";

const SECRET    = new TextEncoder().encode(env.jwtSecret);
const ALGORITHM = "HS256";
const EXPIRY    = env.jwtExpiry || "8h";

export const COOKIE_NAME = "admin_token";

export async function signAdminToken(adminId: string, role: AdminRole): Promise<string> {
  return new SignJWT({ sub: adminId, role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

/**
 * Converts a JWT expiry string (e.g. "8h", "30m") to seconds for cookie maxAge.
 */
export function expiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return 8 * 3600;
  const n = parseInt(match[1], 10);
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return n * (units[match[2]] ?? 3600);
}

export const COOKIE_MAX_AGE = expiryToSeconds(EXPIRY);

/**
 * Extracts the JWT from the request — cookie first, Authorization header as fallback.
 * Cookie is preferred for browser clients (HttpOnly, no JS access).
 * Authorization header is kept for API clients and tests.
 */
function extractToken(c: Context): string | null {
  const cookie = getCookie(c, COOKIE_NAME);
  if (cookie) return cookie;

  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);

  return null;
}

export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const token = extractToken(c);

  if (!token) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });

    if (!payload.sub || !ADMIN_ROLES.includes(payload.role as AdminRole)) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }

    c.set("adminId",   payload.sub as string);
    c.set("adminRole", payload.role as AdminRole);
    await next();
  } catch {
    return c.json({ success: false, error: "Invalid or expired token" }, 401);
  }
}

export function requireRole(...roles: AdminRole[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const role = c.get("adminRole") as AdminRole | undefined;
    if (!role || !roles.includes(role)) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}

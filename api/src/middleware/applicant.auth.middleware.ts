import { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { getCookie } from "hono/cookie";
import { env } from "../config/env.js";

const SECRET    = new TextEncoder().encode(env.jwtSecret);
const ALGORITHM = "HS256";
const EXPIRY    = "30d";

export const APPLICANT_COOKIE = "ons_applicant_session";

export async function signApplicantToken(applicantId: string, alias: string): Promise<string> {
  return new SignJWT({ sub: applicantId, alias, type: "applicant" })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

function extractApplicantToken(c: Context): string | null {
  // Prefer Bearer header for API clients; fall back to HttpOnly session cookie
  const cookieToken = getCookie(c, APPLICANT_COOKIE);
  const header = c.req.header("Authorization");
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return bearerToken ?? cookieToken ?? null;
}

async function verifyApplicantToken(token: string): Promise<{ sub: string; alias: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });
    if (!payload.sub || payload.type !== "applicant") return null;
    return { sub: payload.sub as string, alias: payload.alias as string };
  } catch {
    return null;
  }
}

export async function requireApplicant(c: Context, next: Next): Promise<Response | void> {
  const token = extractApplicantToken(c);
  if (!token) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const claims = await verifyApplicantToken(token);
  if (!claims) {
    return c.json({ success: false, error: "Invalid or expired token" }, 401);
  }

  c.set("applicantId",    claims.sub);
  c.set("applicantAlias", claims.alias);
  await next();
}

/**
 * Non-throwing session check — returns the authenticated applicant's ID if
 * the request carries a valid session, or null otherwise. Used by endpoints
 * that behave differently for an already-authenticated caller without
 * requiring authentication.
 */
export async function tryGetApplicantSession(c: Context): Promise<string | null> {
  const token = extractApplicantToken(c);
  if (!token) return null;
  const claims = await verifyApplicantToken(token);
  return claims?.sub ?? null;
}

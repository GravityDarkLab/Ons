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

export async function requireApplicant(c: Context, next: Next): Promise<Response | void> {
  // Prefer HttpOnly session cookie; fall back to Bearer header for API clients
  const cookieToken = getCookie(c, APPLICANT_COOKIE);
  const header = c.req.header("Authorization");
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = cookieToken ?? bearerToken;

  if (!token) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });

    if (!payload.sub || payload.type !== "applicant") {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    c.set("applicantId",    payload.sub as string);
    c.set("applicantAlias", payload.alias as string);
    await next();
  } catch {
    return c.json({ success: false, error: "Invalid or expired token" }, 401);
  }
}

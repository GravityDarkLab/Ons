import { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";

const SECRET = new TextEncoder().encode(env.jwtSecret);
const ALGORITHM = "HS256";
const EXPIRY = "8h";

/**
 * Signs a JWT for the admin user.
 */
export async function signAdminToken(username: string): Promise<string> {
  return new SignJWT({ sub: username, role: "admin" })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

/**
 * Hono middleware that validates the Bearer JWT.
 * Attaches { adminId } to the Hono context variable.
 */
export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });

    if (payload.role !== "admin" || !payload.sub) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }

    c.set("adminId", payload.sub as string);
    await next();
  } catch {
    return c.json({ success: false, error: "Invalid or expired token" }, 401);
  }
}

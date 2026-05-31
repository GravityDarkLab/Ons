import { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";
import { type AdminRole, ADMIN_ROLES } from "../models/admin.model.js";

const SECRET    = new TextEncoder().encode(env.jwtSecret);
const ALGORITHM = "HS256";
const EXPIRY    = env.jwtExpiry || "8h";

/**
 * Signs a JWT for an admin.
 * @param adminId  MongoDB _id string — becomes the `sub` claim.
 * @param role     The admin's role — stored in the `role` claim.
 */
export async function signAdminToken(adminId: string, role: AdminRole): Promise<string> {
  return new SignJWT({ sub: adminId, role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

/**
 * Requires any valid admin role (authenticated admin).
 * Sets `adminId` and `adminRole` on the Hono context.
 */
export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

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

/**
 * Requires one of the specified roles.
 * Use after requireAdmin (which validates the token) for fine-grained gates.
 *
 * @example
 *   router.post("/admins", requireAdmin, requireRole("super_admin"), createAdminHandler);
 */
export function requireRole(...roles: AdminRole[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const role = c.get("adminRole") as AdminRole | undefined;
    if (!role || !roles.includes(role)) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}

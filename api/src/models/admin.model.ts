import { ObjectId } from "mongodb";

/**
 * Roles are additive — higher roles implicitly include lower ones in practice,
 * but enforcement is explicit per-route via requireRole().
 *
 *   super_admin  Full access, including admin management
 *   admin        Day-to-day operations (applicants, matching, identities)
 *   viewer       Read-only access to applicants and audit logs
 */
export type AdminRole = "super_admin" | "admin" | "viewer";

export const ADMIN_ROLES: AdminRole[] = ["super_admin", "admin", "viewer"];

export interface AdminDoc {
  _id:          ObjectId;
  username:     string;       // unique
  passwordHash: string;       // bcrypt hash (Bun.password)
  role:         AdminRole;
  createdAt:    Date;
  updatedAt:    Date;
}

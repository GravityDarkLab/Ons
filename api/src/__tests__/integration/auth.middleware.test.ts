import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { signAdminToken, requireAdmin } from "../../middleware/auth.middleware.js";
import { SignJWT } from "jose";

const TEST_ADMIN_ID = "507f1f77bcf86cd799439011"; // realistic ObjectId string

// Minimal Hono app that protects a single route
function makeApp() {
  const app = new Hono<{ Variables: { adminId: string } }>();
  app.get("/protected", requireAdmin, (c) =>
    c.json({ ok: true, adminId: c.get("adminId") })
  );
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function request(app: Hono<any>, path: string, headers: Record<string, string> = {}) {
  return app.request(path, { headers });
}

describe("requireAdmin — happy path", () => {
  it("passes with a valid admin token and sets adminId on context", async () => {
    const app   = makeApp();
    const token = await signAdminToken(TEST_ADMIN_ID, "admin");

    const res  = await request(app, "/protected", { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; adminId: string };
    expect(body.ok).toBe(true);
    expect(body.adminId).toBe(TEST_ADMIN_ID);
  });

  it("accepts super_admin role", async () => {
    const app   = makeApp();
    const token = await signAdminToken(TEST_ADMIN_ID, "super_admin");
    const res   = await request(app, "/protected", { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });

  it("accepts viewer role", async () => {
    const app   = makeApp();
    const token = await signAdminToken(TEST_ADMIN_ID, "viewer");
    const res   = await request(app, "/protected", { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });
});

describe("requireAdmin — missing / malformed header", () => {
  it("returns 401 when Authorization header is absent", async () => {
    const app = makeApp();
    const res = await request(app, "/protected");
    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing|invalid/i);
  });

  it("returns 401 when scheme is not Bearer", async () => {
    const app   = makeApp();
    const token = await signAdminToken(TEST_ADMIN_ID, "admin");
    const res   = await request(app, "/protected", { Authorization: `Basic ${token}` });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an empty Bearer token", async () => {
    const app = makeApp();
    const res = await request(app, "/protected", { Authorization: "Bearer " });
    expect(res.status).toBe(401);
  });
});

describe("requireAdmin — invalid token", () => {
  it("returns 401 for a completely invalid token string", async () => {
    const app = makeApp();
    const res = await request(app, "/protected", { Authorization: "Bearer not.a.jwt" });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it("returns 401 for a token signed with a different secret", async () => {
    const app         = makeApp();
    const wrongSecret = new TextEncoder().encode("wrong-secret-totally-different");
    const forgedToken = await new SignJWT({ sub: "attacker", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(wrongSecret);

    const res = await request(app, "/protected", { Authorization: `Bearer ${forgedToken}` });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const app          = makeApp();
    const secret       = new TextEncoder().encode(process.env.JWT_SECRET!);
    const expiredToken = await new SignJWT({ sub: TEST_ADMIN_ID, role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("-1s")
      .sign(secret);

    const res = await request(app, "/protected", { Authorization: `Bearer ${expiredToken}` });
    expect(res.status).toBe(401);
  });
});

describe("requireAdmin — wrong role", () => {
  it("returns 403 when token has an unknown role", async () => {
    const app    = makeApp();
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token  = await new SignJWT({ sub: TEST_ADMIN_ID, role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(secret);

    const res  = await request(app, "/protected", { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/permission/i);
  });

  it("returns 403 when token has no role claim", async () => {
    const app    = makeApp();
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token  = await new SignJWT({ sub: TEST_ADMIN_ID })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(secret);

    const res = await request(app, "/protected", { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(403);
  });
});

describe("signAdminToken", () => {
  it("returns a non-empty string", async () => {
    const token = await signAdminToken(TEST_ADMIN_ID, "admin");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("produces tokens accepted by requireAdmin", async () => {
    const app   = makeApp();
    const token = await signAdminToken(TEST_ADMIN_ID, "admin");
    const res   = await request(app, "/protected", { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });
});

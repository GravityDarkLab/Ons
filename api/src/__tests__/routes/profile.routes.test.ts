import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Mock all DB-touching and external modules ─────────────────────────────────

mock.module("../../middleware/rateLimit.middleware.js", () => {
  const noop = async (_c: unknown, next: () => Promise<void>) => { await next(); };
  return {
    formSubmitRateLimiter: noop,
    adminRateLimiter:      noop,
    profileRateLimiter:    noop,
    createRateLimiter:     () => noop,
  };
});

const mockLoginWithMagicToken = mock(async () => null as any);
const mockGetMyProfile        = mock(async () => null as any);
const mockGetMyMatches        = mock(async () => [] as any[]);
const mockRequestContact      = mock(async () => ({ targetInstagram: "@partner", iceBreakers: [] as string[], dateIdeas: [] as string[] }));
const mockRespondToContact    = mock(async () => {});
const mockReportOutcome       = mock(async () => {});
const mockDeactivateMyAccount = mock(async () => {});

mock.module("../../services/profile.service.js", () => ({
  loginWithMagicToken: mockLoginWithMagicToken,
  getMyProfile:        mockGetMyProfile,
  getMyMatches:        mockGetMyMatches,
  requestContact:      mockRequestContact,
  respondToContact:    mockRespondToContact,
  reportOutcome:       mockReportOutcome,
  deactivateMyAccount: mockDeactivateMyAccount,
}));

mock.module("../../middleware/audit.middleware.js", () => ({
  writeAuditLog:       mock(async () => {}),
  extractAuditContext: mock(() => ({ adminId: "alias", ipAddress: "127.0.0.1", userAgent: "test" })),
}));

import { Hono } from "hono";
import { profileRoutes } from "../../routes/profile.routes.js";
import { signApplicantToken } from "../../middleware/applicant.auth.middleware.js";
import { signAdminToken } from "../../middleware/auth.middleware.js";
import { ObjectId } from "mongodb";

const app = new Hono();
app.route("/profile", profileRoutes);

const VALID_MAGIC_TOKEN = "a".repeat(64);
const VALID_APPLICANT_ID = new ObjectId().toHexString();

async function applicantToken() {
  return signApplicantToken(VALID_APPLICANT_ID, "Blue Falcon");
}

function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return app.request(path, { method: "POST", headers, body: JSON.stringify(body) });
}

function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return app.request(path, { headers });
}

beforeEach(() => {
  mockLoginWithMagicToken.mockReset();
  mockGetMyProfile.mockReset();
  mockGetMyMatches.mockReset();
  mockRequestContact.mockReset();
  mockRespondToContact.mockReset();
  mockReportOutcome.mockReset();
  mockDeactivateMyAccount.mockReset();

  // Restore defaults
  mockLoginWithMagicToken.mockResolvedValue(null);
  mockGetMyMatches.mockResolvedValue([]);
  mockRequestContact.mockResolvedValue({ targetInstagram: "@partner", iceBreakers: ["Q1"], dateIdeas: ["D1"] });
});

// ── POST /profile/login ───────────────────────────────────────────────────────

describe("POST /profile/login", () => {
  it("returns 200 + JWT on valid credentials", async () => {
    mockLoginWithMagicToken.mockResolvedValue({
      _id: new ObjectId(VALID_APPLICANT_ID),
      alias: "Blue Falcon",
      status: "applied",
    });
    const res = await post("/profile/login", { magicToken: VALID_MAGIC_TOKEN, password: "amber-river-silent-fox" });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe("string");
  });

  it("returns 401 on wrong password", async () => {
    mockLoginWithMagicToken.mockResolvedValue(null);
    const res = await post("/profile/login", { magicToken: VALID_MAGIC_TOKEN, password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns 422 when magicToken is the wrong length", async () => {
    const res = await post("/profile/login", { magicToken: "short", password: "some-pass" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when password is missing", async () => {
    const res = await post("/profile/login", { magicToken: VALID_MAGIC_TOKEN });
    expect(res.status).toBe(422);
  });
});

// ── GET /profile/me ───────────────────────────────────────────────────────────

describe("GET /profile/me", () => {
  it("returns 401 without a token", async () => {
    const res = await get("/profile/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an admin JWT (wrong type)", async () => {
    const adminJwt = await signAdminToken("adminId", "admin");
    const res = await get("/profile/me", adminJwt);
    expect(res.status).toBe(401);
  });

  it("returns 200 with applicant JWT", async () => {
    mockGetMyProfile.mockResolvedValue({
      applicantId: VALID_APPLICANT_ID,
      alias: "Blue Falcon",
      status: "applied",
      scoreThreshold: 0.8,
      createdAt: new Date(),
    });
    const token = await applicantToken();
    const res = await get("/profile/me", token);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.alias).toBe("Blue Falcon");
  });
});

// ── GET /profile/matches ──────────────────────────────────────────────────────

describe("GET /profile/matches", () => {
  it("returns 401 without token", async () => {
    const res = await get("/profile/matches");
    expect(res.status).toBe(401);
  });

  it("returns 200 with array of MatchView", async () => {
    mockGetMyMatches.mockResolvedValue([
      { matchId: "abc", partnerAlias: "River Storm", score: 0.9, breakdown: {}, status: "proposed", perspective: "none" },
    ]);
    const token = await applicantToken();
    const res = await get("/profile/matches", token);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].partnerAlias).toBe("River Storm");
  });

  it("passes threshold and limit to service", async () => {
    const token = await applicantToken();
    await get("/profile/matches?threshold=0.7&limit=5", token);
    const [, threshold, limit] = mockGetMyMatches.mock.calls[0] as any[];
    expect(threshold).toBe(0.7);
    expect(limit).toBe(5);
  });
});

// ── POST /profile/matches/:id/contact ────────────────────────────────────────

describe("POST /profile/matches/:id/contact", () => {
  it("returns 401 without token", async () => {
    const res = await post("/profile/matches/abc123/contact", {});
    expect(res.status).toBe(401);
  });

  it("returns 200 with targetInstagram + iceBreakers + dateIdeas", async () => {
    mockRequestContact.mockResolvedValue({
      targetInstagram: "@partner_handle",
      iceBreakers: ["What's your favourite place?"],
      dateIdeas: ["Coffee walk"],
    });
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/contact", {}, token);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.targetInstagram).toBe("@partner_handle");
    expect(Array.isArray(body.data.iceBreakers)).toBe(true);
  });
});

// ── POST /profile/matches/:id/respond ────────────────────────────────────────

describe("POST /profile/matches/:id/respond", () => {
  it("returns 401 without token", async () => {
    const res = await post("/profile/matches/abc123/respond", { accept: true });
    expect(res.status).toBe(401);
  });

  it("returns 200 on accept", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/respond", { accept: true }, token);
    expect(res.status).toBe(200);
  });

  it("returns 200 on decline", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/respond", { accept: false }, token);
    expect(res.status).toBe(200);
  });

  it("returns 422 when accept field is missing", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/respond", {}, token);
    expect(res.status).toBe(422);
  });
});

// ── POST /profile/matches/:id/outcome ────────────────────────────────────────

describe("POST /profile/matches/:id/outcome", () => {
  it("returns 401 without token", async () => {
    const res = await post("/profile/matches/abc123/outcome", { outcome: "failed" });
    expect(res.status).toBe(401);
  });

  it("returns 200 for outcome: failed", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/outcome", { outcome: "failed" }, token);
    expect(res.status).toBe(200);
  });

  it("returns 200 for outcome: success", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/outcome", { outcome: "success" }, token);
    expect(res.status).toBe(200);
  });

  it("returns 422 for invalid outcome value", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/outcome", { outcome: "start_over" }, token);
    expect(res.status).toBe(422);
  });
});

// ── POST /profile/deactivate ──────────────────────────────────────────────────

describe("POST /profile/deactivate", () => {
  it("returns 401 without token", async () => {
    const res = await post("/profile/deactivate", {});
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid applicant token", async () => {
    const token = await applicantToken();
    const res = await post("/profile/deactivate", {}, token);
    expect(res.status).toBe(200);
  });
});

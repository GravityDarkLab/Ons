import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Mock engine before any imports ────────────────────────────────────────────

const mockGetCandidates       = mock(async () => [] as any[]);
const mockRunFullMatchingPass = mock(async () => ({} as Record<string, any[]>));

mock.module("../../matching/engine.js", () => ({
  getCandidates:        mockGetCandidates,
  runFullMatchingPass:  mockRunFullMatchingPass,
  ALGORITHM_REGISTRY:   {},
}));

import { Hono } from "hono";
import { matchingRoutes } from "../../routes/matching.routes.js";
import { signAdminToken } from "../../middleware/auth.middleware.js";

// ── Test app ──────────────────────────────────────────────────────────────────

const app = new Hono();
app.route("/matching", matchingRoutes);

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return app.request(path, { headers });
}

async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return app.request(path, { method: "POST", headers, body: JSON.stringify(body) });
}

async function adminToken() {
  return signAdminToken("507f1f77bcf86cd799439011", "admin");
}

// ── Fixture: ranked candidates ───────────────────────────────────────────────

function makeCandidates(n = 3) {
  return Array.from({ length: n }, (_, i) => ({
    alias: `Alias ${i}`,
    applicantId: `64b1234567890abcdef0000${i}`,
    score: 0.9 - i * 0.1,
    breakdown: { numeric_compatibility: 0.8 },
  }));
}

beforeEach(() => {
  mockGetCandidates.mockReset();
  mockRunFullMatchingPass.mockReset();
  mockGetCandidates.mockResolvedValue(makeCandidates());
  mockRunFullMatchingPass.mockResolvedValue({
    "64b1234567890abcdef01234": makeCandidates(2),
  });
});

// ── GET /matching/candidates/:applicantId ─────────────────────────────────────

describe("GET /matching/candidates/:applicantId", () => {
  it("returns 200 with a candidates array", async () => {
    const res = await get("/matching/candidates/64b1234567890abcdef01234");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.candidates)).toBe(true);
    expect(body.applicantId).toBe("64b1234567890abcdef01234");
  });

  it("passes algorithm query param to getCandidates", async () => {
    await get("/matching/candidates/abc123?algorithm=cosine&top=5");
    const [id, topN, algo] = mockGetCandidates.mock.calls[0] as unknown as [string, number, string];
    expect(id).toBe("abc123");
    expect(topN).toBe(5);
    expect(algo).toBe("cosine");
  });

  it("uses baseline algorithm by default", async () => {
    await get("/matching/candidates/abc123");
    const [, , algo] = mockGetCandidates.mock.calls[0] as unknown as [string, number, string];
    expect(algo).toBe("baseline");
  });

  it("caps top at 50 regardless of query param", async () => {
    await get("/matching/candidates/abc123?top=999");
    const [, topN] = mockGetCandidates.mock.calls[0] as unknown as [string, number, string];
    expect(topN).toBe(50);
  });

  it("returns 404 when engine throws 'not found'", async () => {
    mockGetCandidates.mockRejectedValue(new Error("Active applicant not found: abc123"));
    const res = await get("/matching/candidates/abc123");
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  it("returns 404 for invalid applicant ID", async () => {
    mockGetCandidates.mockRejectedValue(new Error("Invalid applicant ID: not-an-id"));
    const res = await get("/matching/candidates/not-an-id");
    expect(res.status).toBe(404);
  });

  it("returns 500 when engine throws an unexpected error", async () => {
    mockGetCandidates.mockRejectedValue(new Error("DB connection lost"));
    const res = await get("/matching/candidates/abc123");
    expect(res.status).toBe(500);
  });

  it("this route is public — no token required", async () => {
    const res = await get("/matching/candidates/64b1234567890abcdef01234");
    expect(res.status).not.toBe(401);
  });
});

// ── POST /matching/run ────────────────────────────────────────────────────────

describe("POST /matching/run", () => {
  it("returns 401 without a token", async () => {
    const res = await post("/matching/run", { algorithm: "baseline" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with results on a valid admin run (baseline)", async () => {
    const token = await adminToken();
    const res = await post("/matching/run", { algorithm: "baseline" }, token);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.algorithm).toBe("baseline");
    expect(typeof body.totalApplicants).toBe("number");
    expect(typeof body.durationMs).toBe("number");
  });

  it("passes the algorithm to runFullMatchingPass", async () => {
    const token = await adminToken();
    await post("/matching/run", { algorithm: "cosine" }, token);
    const [algo] = mockRunFullMatchingPass.mock.calls[0] as unknown as [string];
    expect(algo).toBe("cosine");
  });

  it("defaults to embedding-cosine when algorithm is omitted", async () => {
    const token = await adminToken();
    await post("/matching/run", {}, token);
    const [algo] = mockRunFullMatchingPass.mock.calls[0] as unknown as [string];
    expect(algo).toBe("embedding-cosine");
  });

  it("returns 422 for an unknown algorithm value", async () => {
    const token = await adminToken();
    const res = await post("/matching/run", { algorithm: "neural-network" }, token);
    expect(res.status).toBe(422);
  });

  it("returns 500 when the engine throws", async () => {
    mockRunFullMatchingPass.mockRejectedValue(new Error("No active questionnaire found"));
    const token = await adminToken();
    const res = await post("/matching/run", { algorithm: "baseline" }, token);
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/questionnaire/i);
  });

  it("totalApplicants reflects the result key count", async () => {
    mockRunFullMatchingPass.mockResolvedValue({
      id1: makeCandidates(2),
      id2: makeCandidates(2),
      id3: makeCandidates(1),
    });
    const token = await adminToken();
    const res = await post("/matching/run", { algorithm: "baseline" }, token);
    const body = await res.json() as any;
    expect(body.totalApplicants).toBe(3);
  });
});

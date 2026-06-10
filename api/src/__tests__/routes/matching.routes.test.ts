import { describe, it, expect, mock, beforeEach } from "bun:test";

mock.module("../../middleware/rateLimit.middleware.js", () => {
  const noop = async (_c: unknown, next: () => Promise<void>) => { await next(); };
  return {
    formSubmitRateLimiter:   noop,
    adminRateLimiter:        noop,
    adminLoginRateLimiter:   noop,
    profileRateLimiter:      noop,
    profileLoginRateLimiter: noop,
    createRateLimiter:       () => noop,
  };
});

// ── Mock engine before any imports ────────────────────────────────────────────

const mockGetCandidates         = mock(async () => [] as any[]);
const mockRunFullMatchingPass   = mock(async () => ({} as Record<string, any[]>));
const mockSaveMatchProposals    = mock(async (..._: any[]) => 0);
const mockLoadActiveApplicants  = mock(async () => [] as any[]);

// generateCoupleProposals (matching/proposals.js) is pure and DB-free, so it
// stays unmocked. Bun's mock.module is process-global: mocking it here would
// replace the shared export binding and poison the unit tests in full runs.
mock.module("../../matching/engine.js", () => ({
  getCandidates:          mockGetCandidates,
  runFullMatchingPass:    mockRunFullMatchingPass,
  ALGORITHM_REGISTRY:     {},
}));

// match.service is used by the matching controller to persist couple proposals.
// Mock it so tests never attempt a real MongoDB connection.
mock.module("../../services/match.service.js", () => ({
  saveMatchProposals:   mockSaveMatchProposals,
  loadActiveApplicants: mockLoadActiveApplicants,
}));

const mockGetConfig = mock(async () => null as unknown);
const mockSetConfig = mock(async () => {});

mock.module("../../services/appConfig.service.js", () => ({
  getConfig: mockGetConfig,
  setConfig: mockSetConfig,
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
  return signAdminToken("507f1f77bcf86cd799439011", "test_admin", "admin");
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
  mockSaveMatchProposals.mockReset();
  mockLoadActiveApplicants.mockReset();
  mockGetConfig.mockReset();
  mockSetConfig.mockReset();
  mockGetConfig.mockResolvedValue(null);
  mockSetConfig.mockResolvedValue(undefined);
  mockGetCandidates.mockResolvedValue(makeCandidates());
  mockRunFullMatchingPass.mockResolvedValue({
    "64b1234567890abcdef01234": makeCandidates(2),
  });
  mockSaveMatchProposals.mockResolvedValue(0);
  mockLoadActiveApplicants.mockResolvedValue([]);
});

// ── GET /matching/candidates/:applicantId ─────────────────────────────────────

describe("GET /matching/candidates/:applicantId", () => {
  it("returns 200 with a candidates array", async () => {
    const res = await get("/matching/candidates/64b1234567890abcdef01234", await adminToken());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.candidates)).toBe(true);
    expect(body.applicantId).toBe("64b1234567890abcdef01234");
  });

  it("passes algorithm query param to getCandidates", async () => {
    await get("/matching/candidates/abc123?algorithm=cosine&top=5", await adminToken());
    const [id, topN, algo] = mockGetCandidates.mock.calls[0] as unknown as [string, number, string];
    expect(id).toBe("abc123");
    expect(topN).toBe(5);
    expect(algo).toBe("cosine");
  });

  it("uses baseline algorithm by default", async () => {
    await get("/matching/candidates/abc123", await adminToken());
    const [, , algo] = mockGetCandidates.mock.calls[0] as unknown as [string, number, string];
    expect(algo).toBe("baseline");
  });

  it("caps top at 50 regardless of query param", async () => {
    await get("/matching/candidates/abc123?top=999", await adminToken());
    const [, topN] = mockGetCandidates.mock.calls[0] as unknown as [string, number, string];
    expect(topN).toBe(50);
  });

  it("returns 404 when engine throws 'not found'", async () => {
    mockGetCandidates.mockRejectedValue(new Error("Active applicant not found: abc123"));
    const res = await get("/matching/candidates/abc123", await adminToken());
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  it("returns 404 for invalid applicant ID", async () => {
    mockGetCandidates.mockRejectedValue(new Error("Invalid applicant ID: not-an-id"));
    const res = await get("/matching/candidates/not-an-id", await adminToken());
    expect(res.status).toBe(404);
  });

  it("returns 500 when engine throws an unexpected error", async () => {
    mockGetCandidates.mockRejectedValue(new Error("DB connection lost"));
    const res = await get("/matching/candidates/abc123", await adminToken());
    expect(res.status).toBe(500);
  });

  // tested: candidates endpoint requires admin auth — compatibility data and
  // paid embedding calls must not be reachable anonymously
  it("returns 401 without a token", async () => {
    const res = await get("/matching/candidates/64b1234567890abcdef01234");
    expect(res.status).toBe(401);
    expect(mockGetCandidates).not.toHaveBeenCalled();
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

// ── GET /matching/last-run ────────────────────────────────────────────────────

// tested: persisted last-run summary — auth gate, null when never run,
// stored value passthrough, and write-through on POST /matching/run
describe("GET /matching/last-run", () => {
  it("returns 401 without a token", async () => {
    const res = await get("/matching/last-run");
    expect(res.status).toBe(401);
  });

  it("returns null data when matching has never run", async () => {
    mockGetConfig.mockResolvedValue(null);
    const res = await get("/matching/last-run", await adminToken());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  it("returns the stored last-run summary", async () => {
    const stored = {
      at: new Date().toISOString(),
      algorithm: "embedding-cosine",
      totalApplicants: 12,
      couplesProposed: 4,
      durationMs: 850,
      triggeredBy: "admin",
    };
    mockGetConfig.mockResolvedValue(stored);
    const res = await get("/matching/last-run", await adminToken());
    const body = await res.json() as any;
    expect(body.data).toEqual(stored);
  });

  it("POST /matching/run persists the last-run summary", async () => {
    const token = await adminToken();
    await post("/matching/run", { algorithm: "baseline" }, token);
    expect(mockSetConfig).toHaveBeenCalledTimes(1);
    const [key, value] = mockSetConfig.mock.calls[0] as unknown as [string, any];
    expect(key).toBe("matching.lastRun");
    expect(value.algorithm).toBe("baseline");
    expect(value.triggeredBy).toBe("admin");
    expect(typeof value.durationMs).toBe("number");
  });
});

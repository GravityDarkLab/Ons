/**
 * Full match state-machine smoke test.
 *
 * Requires direct MongoDB access to inject test fixtures because the API has
 * no admin endpoint to create arbitrary matches. Set SMOKE_MONGO_URI to enable.
 *
 * Run (dev only):
 *   SMOKE_MONGO_URI=mongodb://localhost:27017/ons_dev \
 *   SMOKE_ADMIN_USER=your_admin_username SMOKE_ADMIN_PASS=your_admin_password \
 *   bun test tests/smoke/match-flow.smoke.ts
 *
 * In CI (post-deploy): omit SMOKE_MONGO_URI → all tests are skipped with a warning.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { MongoClient, ObjectId } from "mongodb";
import { createHash } from "crypto";
import {
  BASE_ROOT, BASE, ADMIN_USER, ADMIN_PASS, MONGO_URI,
  get, post, maleAnswers, femaleAnswers, checkServerAvailable, cookieToken,
} from "./helpers.ts";

// ── Availability guards ────────────────────────────────────────────────────────

const CREDS_AVAILABLE = !!(ADMIN_USER && ADMIN_PASS);

if (!CREDS_AVAILABLE) {
  console.warn(`\n⚠️  Smoke tests: SMOKE_ADMIN_USER / SMOKE_ADMIN_PASS not set.\n` +
    `   Without admin credentials most tests fail confusingly — skipping all.\n` +
    `   Example:\n` +
    `   SMOKE_ADMIN_USER=admin SMOKE_ADMIN_PASS=... bun test ./tests/smoke/match-flow.smoke.ts\n`);
}

const SERVER_AVAILABLE = CREDS_AVAILABLE && await checkServerAvailable();

if (CREDS_AVAILABLE && !SERVER_AVAILABLE) {
  console.warn(`\n⚠️  Match-flow smoke: server not reachable at ${BASE_ROOT}. All tests skipped.\n`);
}

if (!MONGO_URI) {
  console.warn(
    `\n⚠️  Match-flow smoke: SMOKE_MONGO_URI not set.\n` +
    `   These tests require direct DB access to inject test matches.\n` +
    `   All tests will be skipped in CI / production smoke runs.\n`
  );
}

const RUNNABLE = SERVER_AVAILABLE && !!MONGO_URI;
const T = test.skipIf(!RUNNABLE);

// ── Shared state ──────────────────────────────────────────────────────────────

const run = Date.now();
const hash256 = (s: string) => createHash("sha256").update(s).digest("hex");
const canonical = (x: ObjectId, y: ObjectId): [ObjectId, ObjectId] =>
  x.toHexString() < y.toHexString() ? [x, y] : [y, x];

const S = {
  // admin
  adminCookie: "",
  submissionKey: "",
  // applicants
  tokenA: "", jwtA: "", aliasA: "", idA: null as ObjectId | null,
  tokenB: "", jwtB: "", aliasB: "", idB: null as ObjectId | null,
  tokenC: "", jwtC: "", aliasC: "", idC: null as ObjectId | null,
  // injected matches
  matchAB: "",
  matchAC: "",
  matchBC: "",
};

let mc: MongoClient | null = null;

// ── Setup + teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!RUNNABLE) return;

  // Admin login
  const login = await post("/admin/login", { username: ADMIN_USER, password: ADMIN_PASS });
  S.adminCookie = login.cookie.split(";")[0];

  // Questionnaire key
  const q = await get("/form/questionnaire");
  S.submissionKey = q.body?.data?.submissionKey ?? "";

  // Create A (male), B (female), C (female)
  const configs: Array<[keyof typeof S, keyof typeof S, keyof typeof S, ReturnType<typeof maleAnswers>]> = [
    ["tokenA", "jwtA", "aliasA", maleAnswers("mf_a", run)],
    ["tokenB", "jwtB", "aliasB", femaleAnswers("mf_b", run)],
    ["tokenC", "jwtC", "aliasC", femaleAnswers("mf_c", run)],
  ];

  for (const [tokenKey, jwtKey, aliasKey, payload] of configs) {
    const sub = await post("/form/submit", payload, { submissionKey: S.submissionKey });
    (S as any)[tokenKey] = sub.body.magicToken ?? "";
    (S as any)[aliasKey] = sub.body.alias     ?? "";
    const pwd = await post("/profile/set-password", {
      magicToken: sub.body.magicToken,
      newPassword: `mf-pass-${tokenKey}-${run}`, // ggignore
    });
    (S as any)[jwtKey] = cookieToken(pwd.cookie);
  }

  // Connect to DB to look up applicant IDs + inject matches
  mc = new MongoClient(MONGO_URI);
  await mc.connect();
  const db = mc.db();

  S.idA = (await db.collection("applicants").findOne({ magicToken: hash256(S.tokenA) }))?._id ?? null;
  S.idB = (await db.collection("applicants").findOne({ magicToken: hash256(S.tokenB) }))?._id ?? null;
  S.idC = (await db.collection("applicants").findOne({ magicToken: hash256(S.tokenC) }))?._id ?? null;

  if (!S.idA || !S.idB || !S.idC) {
    console.error("[match-flow] Failed to find created applicants in DB — aborting setup.");
    await mc.close();
    mc = null;
    return;
  }

  const now = new Date();
  const algorithm = "baseline";

  // Pair A-B → decline flow
  const [cAB_a, cAB_b] = canonical(S.idA, S.idB);
  const abAliasA = cAB_a.equals(S.idA) ? S.aliasA : S.aliasB;
  const abAliasB = cAB_a.equals(S.idA) ? S.aliasB : S.aliasA;
  const mAB = await db.collection("matches").insertOne({
    _id: new ObjectId(),
    applicantAId: cAB_a, applicantBId: cAB_b,
    applicantAAlias: abAliasA, applicantBAlias: abAliasB,
    score: 0.85, algorithm, status: "proposed", createdAt: now, updatedAt: now,
  });
  S.matchAB = mAB.insertedId.toHexString();

  // Pair A-C → accept → success flow
  const [cAC_a, cAC_b] = canonical(S.idA, S.idC);
  const acAliasA = cAC_a.equals(S.idA) ? S.aliasA : S.aliasC;
  const acAliasC = cAC_a.equals(S.idA) ? S.aliasC : S.aliasA;
  const mAC = await db.collection("matches").insertOne({
    _id: new ObjectId(),
    applicantAId: cAC_a, applicantBId: cAC_b,
    applicantAAlias: acAliasA, applicantBAlias: acAliasC,
    score: 0.90, algorithm, status: "proposed", createdAt: now, updatedAt: now,
  });
  S.matchAC = mAC.insertedId.toHexString();

  await mc.close();
  mc = null;
});

afterAll(async () => {
  if (mc) await mc.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// A-B decline flow
// ─────────────────────────────────────────────────────────────────────────────

describe("Match state machine — A-B decline flow", () => {
  T("A sees A-B match in match list (matchId field)", async () => {
    const r = await get("/profile/matches?threshold=0.5", { bearer: S.jwtA });
    expect(r.status).toBe(200);
    const match = r.body.data?.find((m: any) => m.matchId === S.matchAB);
    expect(match).toBeTruthy();
    expect(match?.status).toBe("proposed");
    expect(match?.partnerAlias).toBeTruthy();
    expect(match?.partnerAlias).not.toContain("@"); // alias only, not Instagram
  });

  T("A contacts B → 200 + match transitions to in_progress", async () => {
    const r = await post(`/profile/matches/${S.matchAB}/contact`, {}, { bearer: S.jwtA });
    expect(r.status).toBe(200);
  });

  T("A contacts B again (duplicate) → 409", async () => {
    const r = await post(`/profile/matches/${S.matchAB}/contact`, {}, { bearer: S.jwtA });
    expect(r.status).toBe(409);
  });

  T("B tries to contact on in_progress match (wrong turn) → 403", async () => {
    const r = await post(`/profile/matches/${S.matchAB}/contact`, {}, { bearer: S.jwtB });
    expect(r.status).toBe(403);
  });

  T("B sees the match as target with contactRequestedAt", async () => {
    const r = await get("/profile/matches?threshold=0.5", { bearer: S.jwtB });
    expect(r.status).toBe(200);
    const match = r.body.data?.find((m: any) => m.matchId === S.matchAB);
    expect(match?.status).toBe("in_progress");
    expect(match?.perspective).toBe("target");
    expect(match?.contactRequestedAt).toBeTruthy();
  });

  T("A sees the match as initiator", async () => {
    const r = await get("/profile/matches?threshold=0.5", { bearer: S.jwtA });
    const match = r.body.data?.find((m: any) => m.matchId === S.matchAB);
    expect(match?.perspective).toBe("initiator");
  });

  T("B declines → 200", async () => {
    const r = await post(
      `/profile/matches/${S.matchAB}/respond`,
      { accept: false },
      { bearer: S.jwtB },
    );
    expect(r.status).toBe(200);
  });

  T("A tries to contact after decline → 409 (terminal state)", async () => {
    const r = await post(`/profile/matches/${S.matchAB}/contact`, {}, { bearer: S.jwtA });
    expect(r.status).toBe(409);
  });

  T("A cannot respond to a declined match → 4xx", async () => {
    const r = await post(
      `/profile/matches/${S.matchAB}/respond`,
      { accept: true },
      { bearer: S.jwtA },
    );
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A-C accept → success flow
// ─────────────────────────────────────────────────────────────────────────────

describe("Match state machine — A-C accept → success flow", () => {
  T("A contacts C → 200", async () => {
    const r = await post(`/profile/matches/${S.matchAC}/contact`, {}, { bearer: S.jwtA });
    expect(r.status).toBe(200);
  });

  T("C accepts → 200", async () => {
    const r = await post(
      `/profile/matches/${S.matchAC}/respond`,
      { accept: true },
      { bearer: S.jwtC },
    );
    expect(r.status).toBe(200);
  });

  T("A status → dating after accept", async () => {
    const r = await get("/profile/me", { bearer: S.jwtA });
    expect(r.body.data?.status).toBe("dating");
  });

  T("C status → dating after accept", async () => {
    const r = await get("/profile/me", { bearer: S.jwtC });
    expect(r.body.data?.status).toBe("dating");
  });

  T("A reports success → 200", async () => {
    const r = await post(
      `/profile/matches/${S.matchAC}/outcome`,
      { outcome: "success" },
      { bearer: S.jwtA },
    );
    expect(r.status).toBe(200);
  });

  T("A status → inactive after success", async () => {
    const r = await get("/profile/me", { bearer: S.jwtA });
    expect(r.body.data?.status).toBe("inactive");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B-C failed outcome flow
// ─────────────────────────────────────────────────────────────────────────────

describe("Match state machine — B-C failed outcome flow", () => {
  beforeAll(async () => {
    if (!RUNNABLE) return;

    // Inject B-C dating match directly in DB (B and C are both "applied" after their previous flows)
    mc = new MongoClient(MONGO_URI);
    await mc.connect();
    const db = mc.db();

    if (!S.idB || !S.idC) return;

    const [cBC_a, cBC_b] = canonical(S.idB, S.idC);
    const bcAliasA = cBC_a.equals(S.idB) ? S.aliasB : S.aliasC;
    const bcAliasB = cBC_a.equals(S.idB) ? S.aliasC : S.aliasB;
    const now = new Date();

    const mBC = await db.collection("matches").insertOne({
      _id: new ObjectId(),
      applicantAId: cBC_a, applicantBId: cBC_b,
      applicantAAlias: bcAliasA, applicantBAlias: bcAliasB,
      score: 0.78, algorithm: "baseline",
      status: "dating",
      initiatorId: cBC_a, // B is A in canonical order
      contactRequestedAt: now, contactRespondedAt: now,
      createdAt: now, updatedAt: now,
    });
    S.matchBC = mBC.insertedId.toHexString();

    // Set B and C to dating status
    await db.collection("applicants").updateMany(
      { _id: { $in: [S.idB, S.idC] } },
      { $set: { status: "dating", updatedAt: now } },
    );

    await mc.close();
    mc = null;

    // Refresh JWTs (status change doesn't invalidate tokens but re-login confirms account works)
    const lB = await post("/profile/login", { magicToken: S.tokenB, password: `mf-pass-tokenB-${run}` }); // ggignore
    const lC = await post("/profile/login", { magicToken: S.tokenC, password: `mf-pass-tokenC-${run}` }); // ggignore
    if (cookieToken(lB.cookie)) S.jwtB = cookieToken(lB.cookie);
    if (cookieToken(lC.cookie)) S.jwtC = cookieToken(lC.cookie);
  });

  T("B reports failed outcome → 200", async () => {
    const r = await post(
      `/profile/matches/${S.matchBC}/outcome`,
      { outcome: "failed" },
      { bearer: S.jwtB },
    );
    expect(r.status).toBe(200);
  });

  T("B status → applied after failed", async () => {
    const r = await get("/profile/me", { bearer: S.jwtB });
    expect(r.body.data?.status).toBe("applied");
  });

  T("C status → applied after failed", async () => {
    const r = await get("/profile/me", { bearer: S.jwtC });
    expect(r.body.data?.status).toBe("applied");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-participant access
// ─────────────────────────────────────────────────────────────────────────────

describe("Match access control", () => {
  T("non-participant contacting match → 403", async () => {
    // B is not in the A-C match (which is now success status anyway)
    const r = await post(`/profile/matches/${S.matchAC}/contact`, {}, { bearer: S.jwtB });
    expect([403, 409]).toContain(r.status); // 409 if terminal state reached first
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency — atomic transition claims (regression: respond/outcome races)
// ─────────────────────────────────────────────────────────────────────────────

describe("Match state machine — concurrent transitions", () => {
  // The matches collection has a unique index on (applicantAId, applicantBId),
  // so the B-C pair can only hold one match doc at a time — each test injects
  // its own fixture after removing the previous one.
  async function injectBCMatch(status: "in_progress" | "dating"): Promise<string> {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();

    const [cBC_a, cBC_b] = canonical(S.idB!, S.idC!);
    const aliasA = cBC_a.equals(S.idB!) ? S.aliasB : S.aliasC;
    const aliasB = cBC_a.equals(S.idB!) ? S.aliasC : S.aliasB;
    const initiatorId = cBC_a.equals(S.idB!) ? cBC_a : cBC_b;
    const now = new Date();

    await db.collection("matches").deleteMany({ applicantAId: cBC_a, applicantBId: cBC_b });
    const inserted = await db.collection("matches").insertOne({
      _id: new ObjectId(),
      applicantAId: cBC_a, applicantBId: cBC_b,
      applicantAAlias: aliasA, applicantBAlias: aliasB,
      score: 0.77, algorithm: "baseline",
      status, initiatorId,
      contactRequestedAt: now,
      ...(status === "dating" ? { contactRespondedAt: now } : {}),
      createdAt: now, updatedAt: now,
    });

    await client.close();
    return inserted.insertedId.toHexString();
  }

  T("concurrent accept + decline → exactly one 200, one 409", async () => {
    // B initiated, so C responds
    const matchId = await injectBCMatch("in_progress");
    const [r1, r2] = await Promise.all([
      post(`/profile/matches/${matchId}/respond`, { accept: true },  { bearer: S.jwtC }),
      post(`/profile/matches/${matchId}/respond`, { accept: false }, { bearer: S.jwtC }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  T("concurrent conflicting outcome reports → exactly one 200, one 409", async () => {
    const matchId = await injectBCMatch("dating");
    const [r1, r2] = await Promise.all([
      post(`/profile/matches/${matchId}/outcome`, { outcome: "success" }, { bearer: S.jwtB }),
      post(`/profile/matches/${matchId}/outcome`, { outcome: "failed" },  { bearer: S.jwtC }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});

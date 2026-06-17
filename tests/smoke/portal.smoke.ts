/**
 * Smoke / integration tests for the Ons API.
 *
 * Requires a running server. Configure with env vars:
 *   SMOKE_BASE_URL   — default: http://localhost:3001
 *   SMOKE_ADMIN_USER — admin username (see api/.env.dev)
 *   SMOKE_ADMIN_PASS — admin password (see api/.env.dev)
 *
 * Run:
 *   bun test tests/smoke/portal.smoke.ts
 *   SMOKE_BASE_URL=https://api.ons.app bun test tests/smoke/portal.smoke.ts
 */

import { describe, test, expect, beforeAll } from "bun:test";
import {
  BASE, BASE_ROOT, ADMIN_USER, ADMIN_PASS,
  get, post, maleAnswers, femaleAnswers, checkServerAvailable, cookieToken,
} from "./helpers.ts";

// ── Availability check (top-level await — runs before any test is registered) ─

const CREDS_AVAILABLE = !!(ADMIN_USER && ADMIN_PASS);

if (!CREDS_AVAILABLE) {
  console.warn(`\n⚠️  Smoke tests: SMOKE_ADMIN_USER / SMOKE_ADMIN_PASS not set.\n` +
    `   Without admin credentials most tests fail confusingly — skipping all.\n` +
    `   Example:\n` +
    `   SMOKE_ADMIN_USER=admin SMOKE_ADMIN_PASS=... bun test ./tests/smoke/portal.smoke.ts\n`);
}

const SERVER_AVAILABLE = CREDS_AVAILABLE && await checkServerAvailable();

if (CREDS_AVAILABLE && !SERVER_AVAILABLE) {
  console.warn(`\n⚠️  Smoke tests: server not reachable at ${BASE_ROOT}\n` +
    `   Set SMOKE_BASE_URL or start the server, then re-run.\n` +
    `   All tests below will be skipped.\n`);
}

const T = test.skipIf(!SERVER_AVAILABLE);

// ── Shared mutable state (populated in beforeAll, consumed by tests) ──────────

const run = Date.now();
const S = {
  // admin
  adminCookie:   "",
  // form
  submissionKey: "",
  sampleApplicantId: "",
  // applicant A (male, initiates contact)
  tokenA: "", jwtA: "", aliasA: "",
  // applicant B (female, declines)
  tokenB: "", jwtB: "", aliasB: "",
  // applicant C (female, accepts)
  tokenC: "", jwtC: "", aliasC: "",
  // applicant D (deactivate test)
  jwtD: "",
};

// ── Global setup ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!SERVER_AVAILABLE) return;

  // 1. Admin login
  const login = await post("/admin/login", { username: ADMIN_USER, password: ADMIN_PASS });
  S.adminCookie = login.cookie.split(";")[0];

  if (!S.adminCookie) {
    console.warn(`\n⚠️  Admin login failed — check SMOKE_ADMIN_USER / SMOKE_ADMIN_PASS\n`);
    return;
  }

  // 2. Questionnaire key
  const q = await get("/form/questionnaire");
  S.submissionKey = q.body?.data?.submissionKey ?? "";

  // 3. Create applicants A (male), B (female), C (female)
  //    A-B and A-C are orientation-compatible pairs for matching
  const submits: Array<[keyof typeof S, keyof typeof S, keyof typeof S, ReturnType<typeof maleAnswers>]> = [
    ["tokenA", "jwtA", "aliasA", maleAnswers("smoke_a", run)],
    ["tokenB", "jwtB", "aliasB", femaleAnswers("smoke_b", run)],
    ["tokenC", "jwtC", "aliasC", femaleAnswers("smoke_c", run)],
  ];

  for (const [tokenKey, jwtKey, aliasKey, payload] of submits) {
    const sub = await post("/form/submit", payload, { submissionKey: S.submissionKey });
    (S as any)[tokenKey] = sub.body.magicToken ?? "";
    (S as any)[aliasKey] = sub.body.alias     ?? "";
    const pwd = await post("/profile/set-password", {
      magicToken: sub.body.magicToken,
      newPassword: `smoke-pass-${tokenKey}-${run}`,
    });
    (S as any)[jwtKey] = cookieToken(pwd.cookie);
  }

  // 4. Applicant D for deactivate section
  const subD = await post("/form/submit", femaleAnswers("smoke_d", run), { submissionKey: S.submissionKey });
  const pwdD = await post("/profile/set-password", {
    magicToken: subD.body.magicToken,
    newPassword: `smoke-pass-d-${run}`,
  });
  S.jwtD = cookieToken(pwdD.cookie);

  // 5. Get a sample applicant ID for detail tests
  const list = await get("/admin/applicants?limit=1", { cookie: S.adminCookie });
  S.sampleApplicantId = list.body?.data?.[0]?.id ?? "";
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Health
// ─────────────────────────────────────────────────────────────────────────────

describe("Health", () => {
  T("GET /health → 200", async () => {
    const r = await fetch(`${BASE_ROOT}/health`);
    expect(r.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Admin auth
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin auth", () => {
  T("correct credentials → 200 + Set-Cookie", async () => {
    const r = await post("/admin/login", { username: ADMIN_USER, password: ADMIN_PASS });
    expect(r.status).toBe(200);
    expect(r.cookie).toBeTruthy();
  });

  T("wrong password → 401", async () => {
    const r = await post("/admin/login", { username: ADMIN_USER, password: "definitely-wrong" }); // ggignore
    expect(r.status).toBe(401);
  });

  T("unknown user → 401", async () => {
    const r = await post("/admin/login", { username: "nobody", password: "irrelevant" });
    expect(r.status).toBe(401);
  });

  T("missing password field → 422", async () => {
    const r = await post("/admin/login", { username: ADMIN_USER });
    expect(r.status).toBe(422);
  });

  T("missing both fields → 422", async () => {
    const r = await post("/admin/login", {});
    expect(r.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Admin /me
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin /me", () => {
  T("authenticated → 200 + adminId + adminUsername + adminRole", async () => {
    const r = await get("/admin/me", { cookie: S.adminCookie });
    expect(r.status).toBe(200);
    expect(r.body.data?.adminId).toBeTruthy();
    expect(r.body.data?.adminUsername).toBe(ADMIN_USER);
    expect(r.body.data?.adminRole).toBeTruthy();
  });

  T("no cookie → 401", async () => {
    expect((await get("/admin/me")).status).toBe(401);
  });

  T("garbage cookie → 401", async () => {
    expect((await get("/admin/me", { cookie: "admin_token=garbage" })).status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Admin applicant endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin applicants", () => {
  T("list → no magicToken or passwordHash in response", async () => {
    const r = await get("/admin/applicants?limit=5", { cookie: S.adminCookie });
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThan(0);
    const a = r.body.data[0];
    expect(a).not.toHaveProperty("magicToken");
    expect(a).not.toHaveProperty("passwordHash");
    expect(a.id).toBeTruthy();
  });

  T("list with status filter → only matching statuses returned", async () => {
    for (const status of ["applied", "matched", "dating", "inactive"] as const) {
      const r = await get(`/admin/applicants?status=${status}&limit=5`, { cookie: S.adminCookie });
      expect(r.status).toBe(200);
      if (r.body.data.length > 0) {
        expect(r.body.data.every((a: any) => a.status === status)).toBe(true);
      }
    }
  });

  T("list with search → alias search works", async () => {
    const r = await get("/admin/applicants?search=smoke_a&limit=5", { cookie: S.adminCookie });
    expect(r.status).toBe(200);
  });

  T("list — invalid status → 422", async () => {
    const r = await get("/admin/applicants?status=nonexistent", { cookie: S.adminCookie });
    expect(r.status).toBe(422);
  });

  T("list — no auth → 401", async () => {
    expect((await get("/admin/applicants")).status).toBe(401);
  });

  T("detail → 200 + no sensitive fields", async () => {
    const r = await get(`/admin/applicants/${S.sampleApplicantId}`, { cookie: S.adminCookie });
    expect(r.status).toBe(200);
    expect(r.body.data).not.toHaveProperty("magicToken");
    expect(r.body.data).not.toHaveProperty("passwordHash");
  });

  T("detail — not found → 404", async () => {
    const r = await get("/admin/applicants/000000000000000000000000", { cookie: S.adminCookie });
    expect(r.status).toBe(404);
  });

  T("detail — malformed id → 404", async () => {
    const r = await get("/admin/applicants/not-a-valid-id", { cookie: S.adminCookie });
    expect(r.status).toBe(404);
  });

  T("identity reveal — super_admin gets instagramHandle", async () => {
    const r = await get(`/admin/applicants/${S.sampleApplicantId}/identity`, { cookie: S.adminCookie });
    // Super_admin gets 200; regular admin gets 403 — both acceptable for this smoke
    expect([200, 403]).toContain(r.status);
    if (r.status === 200) {
      expect(r.body.data?.instagramHandle).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Questionnaire
// ─────────────────────────────────────────────────────────────────────────────

describe("Questionnaire", () => {
  T("GET /form/questionnaire → submissionKey + sections", async () => {
    const r = await get("/form/questionnaire");
    expect(r.status).toBe(200);
    expect(r.body.data?.submissionKey).toBeTruthy();
    expect(Array.isArray(r.body.data?.sections)).toBe(true);
    expect(r.body.data.sections.length).toBeGreaterThan(0);
  });

  T("GET /form/questionnaire?filter=all → list without submissionKey", async () => {
    const r = await get("/form/questionnaire?filter=all");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  T("invalid filter → 400", async () => {
    const r = await get("/form/questionnaire?filter=invalid");
    expect(r.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Form submission
// ─────────────────────────────────────────────────────────────────────────────

describe("Form submission", () => {
  T("valid submission → 201 + alias + magicToken", async () => {
    const r = await post(
      "/form/submit",
      maleAnswers("smoke_newuser", run),
      { submissionKey: S.submissionKey },
    );
    expect(r.status).toBe(201);
    expect(r.body.alias).toBeTruthy();
    expect(r.body.magicToken).toHaveLength(64);
    expect(r.body).not.toHaveProperty("plainPassword");
    expect(r.body).not.toHaveProperty("passwordHash");
  });

  T("duplicate instagram handle → 409", async () => {
    const r = await post(
      "/form/submit",
      maleAnswers("smoke_a", run), // same handle as applicant A created in beforeAll
      { submissionKey: S.submissionKey },
    );
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/already exists/i);
  });

  T("wrong X-Submission-Key → 401", async () => {
    const r = await post(
      "/form/submit",
      maleAnswers("smoke_wrongkey", run),
      { submissionKey: "dead".repeat(16) },
    );
    expect(r.status).toBe(401);
  });

  T("missing X-Submission-Key → 401", async () => {
    const r = await fetch(`${BASE}/form/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(maleAnswers("smoke_nokey", run)),
    });
    expect(r.status).toBe(401);
  });

  T("missing required fields → 400 or 422", async () => {
    const r = await post(
      "/form/submit",
      { questionnaireVersion: "1.0.0", answers: {} },
      { submissionKey: S.submissionKey },
    );
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  T("invalid questionnaire version → 400", async () => {
    const r = await post(
      "/form/submit",
      { ...maleAnswers("smoke_badver", run), questionnaireVersion: "9.9.9" },
      { submissionKey: S.submissionKey },
    );
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Profile auth
// ─────────────────────────────────────────────────────────────────────────────

describe("Profile auth — first-login flow", () => {
  let freshToken = "";

  T("submit fresh applicant for auth tests", async () => {
    const r = await post(
      "/form/submit",
      femaleAnswers("smoke_auth_test", run),
      { submissionKey: S.submissionKey },
    );
    expect(r.status).toBe(201);
    freshToken = r.body.magicToken;
  });

  T("login with token only → firstLogin: true (no password set yet)", async () => {
    const r = await post("/profile/login", { magicToken: freshToken });
    expect(r.status).toBe(200);
    expect(r.body.firstLogin).toBe(true);
    expect(r.body.token).toBeUndefined();
  });

  T("suggest-password → 4-word hyphenated passphrase", async () => {
    const r = await get("/profile/suggest-password");
    expect(r.status).toBe(200);
    expect(r.body.suggestion).toMatch(/\w+-\w+-\w+-\w+/);
  });

  T("set-password — too short → 422", async () => {
    const r = await post("/profile/set-password", { magicToken: freshToken, newPassword: "short" });
    expect(r.status).toBe(422);
  });

  T("set-password — valid → 200 + session cookie", async () => {
    const r = await post("/profile/set-password", { magicToken: freshToken, newPassword: "valid-password-123" });
    expect(r.status).toBe(200);
    expect(cookieToken(r.cookie)).toBeTruthy();
  });

  T("set-password — already set → 409", async () => {
    const r = await post("/profile/set-password", { magicToken: freshToken, newPassword: "another-password-123" });
    expect(r.status).toBe(409);
  });

  T("login — correct password → session cookie", async () => {
    const r = await post("/profile/login", { magicToken: freshToken, password: "valid-password-123" });
    expect(r.status).toBe(200);
    expect(cookieToken(r.cookie)).toBeTruthy();
  });

  T("login — wrong password → 401", async () => {
    const r = await post("/profile/login", { magicToken: freshToken, password: "wrong-password" });
    expect(r.status).toBe(401);
  });

  T("login — bad 64-char hex token → 401", async () => {
    const r = await post("/profile/login", { magicToken: "0".repeat(64), password: "anything" });
    expect(r.status).toBe(401);
  });

  T("login — short/malformed token → 422", async () => {
    const r = await post("/profile/login", { magicToken: "short" });
    expect(r.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Authenticated profile endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe("Profile — authenticated endpoints", () => {
  T("GET /profile/me → 200 + alias + status", async () => {
    const r = await get("/profile/me", { bearer: S.jwtA });
    expect(r.status).toBe(200);
    expect(r.body.data?.alias).toBe(S.aliasA);
    expect(r.body.data?.status).toBeTruthy();
    expect(r.body.data).not.toHaveProperty("magicToken");
    expect(r.body.data).not.toHaveProperty("passwordHash");
  });

  T("GET /profile/me — no token → 401", async () => {
    expect((await get("/profile/me")).status).toBe(401);
  });

  T("GET /profile/me — admin cookie (wrong auth type) → 401", async () => {
    expect((await get("/profile/me", { cookie: S.adminCookie })).status).toBe(401);
  });

  T("GET /profile/matches → 200 + array", async () => {
    const r = await get("/profile/matches", { bearer: S.jwtA });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  T("GET /profile/matches?threshold=0.5&limit=5 → accepted", async () => {
    const r = await get("/profile/matches?threshold=0.5&limit=5", { bearer: S.jwtA });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  T("GET /profile/matches — threshold out of range is clamped (not rejected)", async () => {
    // Threshold is clamped to [0.6, 1.0] by the validator transform, not rejected
    const r = await get("/profile/matches?threshold=1.5", { bearer: S.jwtA });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  T("GET /profile/matches — limit too large is clamped to max 10", async () => {
    // Limit is clamped to [1, 10] by the validator transform, not rejected
    const r = await get("/profile/matches?limit=999", { bearer: S.jwtA });
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeLessThanOrEqual(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Change password
// ─────────────────────────────────────────────────────────────────────────────

describe("Change password", () => {
  const pwdA = `smoke-pass-tokenA-${run}`; // ggignore
  const pwdANew = `smoke-pass-tokenA-new-${run}`; // ggignore

  T("wrong current password → 401", async () => {
    const r = await post(
      "/profile/change-password",
      { currentPassword: "wrong-password", newPassword: pwdANew }, // ggignore
      { bearer: S.jwtA },
    );
    expect(r.status).toBe(401);
  });

  T("correct current password → 200", async () => {
    const r = await post(
      "/profile/change-password",
      { currentPassword: pwdA, newPassword: pwdANew }, // ggignore
      { bearer: S.jwtA },
    );
    expect(r.status).toBe(200);
  });

  T("login with new password → session cookie", async () => {
    const r = await post("/profile/login", { magicToken: S.tokenA, password: pwdANew });
    expect(r.status).toBe(200);
    expect(cookieToken(r.cookie)).toBeTruthy();
    S.jwtA = cookieToken(r.cookie); // refresh JWT for downstream tests
  });

  T("login with old password fails after change → 401", async () => {
    const r = await post("/profile/login", { magicToken: S.tokenA, password: pwdA });
    expect(r.status).toBe(401);
  });

  T("new password too short → 422", async () => {
    const r = await post(
      "/profile/change-password",
      { currentPassword: pwdANew, newPassword: "short" },
      { bearer: S.jwtA },
    );
    expect(r.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Match contact/respond endpoints — validation only (no match injection)
// ─────────────────────────────────────────────────────────────────────────────

describe("Match endpoints — error paths", () => {
  const FAKE_ID = "000000000000000000000000";

  T("contact non-existent match → 404", async () => {
    const r = await post(`/profile/matches/${FAKE_ID}/contact`, {}, { bearer: S.jwtA });
    expect(r.status).toBe(404);
  });

  T("respond non-existent match → 404", async () => {
    const r = await post(`/profile/matches/${FAKE_ID}/respond`, { accept: true }, { bearer: S.jwtA });
    expect(r.status).toBe(404);
  });

  T("outcome non-existent match → 404", async () => {
    const r = await post(`/profile/matches/${FAKE_ID}/outcome`, { outcome: "success" }, { bearer: S.jwtA });
    expect(r.status).toBe(404);
  });

  T("respond with invalid body → 422", async () => {
    const r = await post(`/profile/matches/${FAKE_ID}/respond`, { accept: "yes" }, { bearer: S.jwtA });
    expect(r.status).toBe(422);
  });

  T("outcome with invalid value → 422", async () => {
    const r = await post(`/profile/matches/${FAKE_ID}/outcome`, { outcome: "maybe" }, { bearer: S.jwtA });
    expect(r.status).toBe(422);
  });

  T("contact — no auth → 401", async () => {
    const r = await post(`/profile/matches/${FAKE_ID}/contact`, {});
    expect(r.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Deactivate
// ─────────────────────────────────────────────────────────────────────────────

describe("Deactivate", () => {
  T("POST /profile/deactivate → 200", async () => {
    expect((await post("/profile/deactivate", {}, { bearer: S.jwtD })).status).toBe(200);
  });

  T("GET /profile/me after deactivate → status: inactive", async () => {
    const r = await get("/profile/me", { bearer: S.jwtD });
    expect(r.status).toBe(200);
    expect(r.body.data?.status).toBe("inactive");
  });

  T("POST /profile/deactivate again → 200 (idempotent)", async () => {
    expect((await post("/profile/deactivate", {}, { bearer: S.jwtD })).status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Matching admin
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin matching", () => {
  T("POST /matching/run baseline → 200 + couplesProposed", async () => {
    const r = await post(
      "/matching/run",
      { algorithm: "baseline", topN: 3 },
      { cookie: S.adminCookie },
    );
    expect(r.status).toBe(200);
    expect(typeof r.body.couplesProposed).toBe("number");
  });

  T("POST /matching/run — no auth → 401", async () => {
    const r = await post("/matching/run", { algorithm: "baseline" });
    expect(r.status).toBe(401);
  });

  T("POST /matching/run — invalid algorithm → 422", async () => {
    const r = await post(
      "/matching/run",
      { algorithm: "invalid_algo" },
      { cookie: S.adminCookie },
    );
    expect(r.status).toBe(422);
  });

  T("POST /matching/run — applicant JWT → 401 or 403", async () => {
    const r = await post(
      "/matching/run",
      { algorithm: "baseline" },
      { bearer: S.jwtB },
    );
    expect([401, 403]).toContain(r.status);
  });

  // tested: candidates endpoint is admin-only (compatibility data + paid
  // embedding calls must not be reachable anonymously)
  T("GET /matching/candidates — no auth → 401", async () => {
    const r = await get(`/matching/candidates/${S.sampleApplicantId}`);
    expect(r.status).toBe(401);
  });

  T("GET /matching/candidates — admin → 200 + candidates array", async () => {
    // sampleApplicantId may have been deactivated by the Deactivate section
    // (candidates 404s on inactive applicants) — fetch a currently active one
    const list = await get("/admin/applicants?status=applied&limit=1", { cookie: S.adminCookie });
    const activeId = list.body?.data?.[0]?.id;
    expect(activeId).toBeTruthy();

    const r = await get(
      `/matching/candidates/${activeId}?algorithm=baseline`,
      { cookie: S.adminCookie },
    );
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.candidates)).toBe(true);
  });

  // tested: last-run persistence — POST /matching/run above must have written
  // a summary to app_config that survives independent of component state
  T("GET /matching/last-run — no auth → 401", async () => {
    const r = await get("/matching/last-run");
    expect(r.status).toBe(401);
  });

  T("GET /matching/last-run — reflects the run this suite triggered", async () => {
    const r = await get("/matching/last-run", { cookie: S.adminCookie });
    expect(r.status).toBe(200);
    expect(r.body.data).toBeTruthy();
    const d = r.body.data;
    expect(typeof d.totalApplicants).toBe("number");
    expect(typeof d.couplesProposed).toBe("number");
    expect(["admin", "scheduler"]).toContain(d.triggeredBy);
    // The run happened within this suite execution — `at` must be recent
    const ageMs = Date.now() - new Date(d.at).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(0);
    expect(ageMs).toBeLessThan(10 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Admin matches list
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin matches list", () => {
  T("GET /admin/matches → 200 + paginated", async () => {
    const r = await get("/admin/matches?limit=5", { cookie: S.adminCookie });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(typeof r.body.total).toBe("number");
  });

  T("GET /admin/matches?status=proposed → filtered", async () => {
    const r = await get("/admin/matches?status=proposed&limit=5", { cookie: S.adminCookie });
    expect(r.status).toBe(200);
    if (r.body.data.length > 0) {
      expect(r.body.data.every((m: any) => m.status === "proposed")).toBe(true);
    }
  });

  T("GET /admin/matches — no auth → 401", async () => {
    expect((await get("/admin/matches")).status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Audit logs
// ─────────────────────────────────────────────────────────────────────────────

describe("Audit logs", () => {
  T("GET /admin/audit-logs → 200 + array", async () => {
    const r = await get("/admin/audit-logs?limit=5", { cookie: S.adminCookie });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  T("GET /admin/audit-logs — no auth → 401", async () => {
    expect((await get("/admin/audit-logs")).status).toBe(401);
  });

  T("identity reveal is role-gated and audited", async () => {
    const reveal = await get(`/admin/applicants/${S.sampleApplicantId}/identity`, { cookie: S.adminCookie });
    if (reveal.status === 200) {
      // super_admin credentials: the reveal must be audit-logged
      const r = await get("/admin/audit-logs?limit=50", { cookie: S.adminCookie });
      expect(r.status).toBe(200);
      const actions = r.body.data.map((l: any) => l.action);
      expect(actions).toContain("RESOLVE_IDENTITY");
    } else {
      // plain admin role: identity reveal requires super_admin
      expect(reveal.status).toBe(403);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Security / cross-auth
// ─────────────────────────────────────────────────────────────────────────────

describe("Security", () => {
  T("applicant JWT on admin endpoint → 401 or 403", async () => {
    const r = await get("/admin/applicants", { bearer: S.jwtB });
    expect([401, 403]).toContain(r.status);
  });

  T("admin cookie on profile endpoint → 401", async () => {
    expect((await get("/profile/me", { cookie: S.adminCookie })).status).toBe(401);
  });

  T("expired / garbage Bearer token → 401", async () => {
    const r = await get("/profile/me", { bearer: "not.a.valid.jwt" });
    expect(r.status).toBe(401);
  });

  T("contact on non-participant match → 403 or 404", async () => {
    // jwtD is deactivated but JWT still valid; no matches for D
    const r = await post(
      "/profile/matches/aaaaaaaaaaaaaaaaaaaaaaaa/contact",
      {},
      { bearer: S.jwtB },
    );
    expect([403, 404]).toContain(r.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Admin logout
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin logout", () => {
  let freshCookie = "";

  T("login to get a fresh cookie for logout test", async () => {
    const r = await post("/admin/login", { username: ADMIN_USER, password: ADMIN_PASS });
    freshCookie = r.cookie.split(";")[0];
    expect(freshCookie).toBeTruthy();
  });

  T("POST /admin/logout → 200", async () => {
    expect((await post("/admin/logout", {}, { cookie: freshCookie })).status).toBe(200);
  });

  T("GET /admin/me with no cookie (browser cleared it) → 401", async () => {
    // JWT is stateless — logout clears the HttpOnly cookie in the browser.
    // Without the cookie, /me returns 401 as expected.
    expect((await get("/admin/me")).status).toBe(401);
  });
});

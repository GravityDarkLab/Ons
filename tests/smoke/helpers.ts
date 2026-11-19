/**
 * Shared utilities for smoke tests.
 *
 * Configure via env vars:
 *   SMOKE_BASE_URL   — default: http://localhost:3001
 *   SMOKE_ADMIN_USER — default: from env or ""
 *   SMOKE_ADMIN_PASS — default: from env or ""
 *   SMOKE_MONGO_URI  — enables DB-dependent match-flow tests (optional)
 */

export const BASE_ROOT = process.env.SMOKE_BASE_URL ?? "http://localhost:3001";
export const BASE      = `${BASE_ROOT}/api/v1`;

export const ADMIN_USER = process.env.SMOKE_ADMIN_USER ?? "";
export const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS ?? "";

export const MONGO_URI = process.env.SMOKE_MONGO_URI ?? "";

// ── Server availability ───────────────────────────────────────────────────────

export async function checkServerAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_ROOT}/health`, {
      signal: AbortSignal.timeout(4_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

// Each smoke test run gets a unique IP block so rate limiters (per-IP) don't
// aggregate requests across unrelated test cases.
let _ipSeq = 0;
function nextIp() { return `10.${Math.floor(_ipSeq / 256)}.${_ipSeq++ % 256}.1`; }

export interface Opts {
  cookie?: string;
  bearer?: string;
  submissionKey?: string;
  ip?: string;
}

export async function post(path: string, body: unknown, opts: Opts = {}) {
  const h: Record<string, string> = {
    "Content-Type":    "application/json",
    "X-Forwarded-For": opts.ip ?? nextIp(),
  };
  if (opts.cookie)        h["Cookie"]           = opts.cookie;
  if (opts.bearer)        h["Authorization"]    = `Bearer ${opts.bearer}`;
  if (opts.submissionKey) h["X-Submission-Key"] = opts.submissionKey;

  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let bd: Record<string, any> = {};
  try { bd = await r.json(); } catch {}
  return {
    status: r.status,
    body:   bd,
    cookie: r.headers.get("set-cookie") ?? "",
  };
}

export async function del(path: string, body: unknown, opts: Opts = {}) {
  const h: Record<string, string> = {
    "Content-Type":    "application/json",
    "X-Forwarded-For": opts.ip ?? nextIp(),
  };
  if (opts.cookie)     h["Cookie"]        = opts.cookie;
  if (opts.bearer)     h["Authorization"] = `Bearer ${opts.bearer}`;

  const r = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: h,
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let bd: Record<string, any> = {};
  try { bd = await r.json(); } catch {}
  return { status: r.status, body: bd };
}

export async function get(path: string, opts: Opts = {}) {
  const h: Record<string, string> = {
    "X-Forwarded-For": opts.ip ?? nextIp(),
  };
  if (opts.cookie)  h["Cookie"]        = opts.cookie;
  if (opts.bearer)  h["Authorization"] = `Bearer ${opts.bearer}`;

  const r = await fetch(`${BASE}${path}`, { headers: h, redirect: "manual" });
  let bd: Record<string, any> = {};
  try { bd = await r.json(); } catch {}
  return { status: r.status, body: bd };
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Extracts the applicant session JWT from a Set-Cookie header.
 * Login/set-password set an HttpOnly cookie instead of returning the token in
 * the body; the API still accepts the JWT as a Bearer header.
 */
export function cookieToken(setCookie: string): string {
  const m = setCookie.match(/ons_applicant_session=([^;]+)/);
  return m?.[1] ?? "";
}

// ── Form payload helpers ──────────────────────────────────────────────────────

/** YYYY-MM-DD birth date for someone who is `age` years old today. */
function birthDateForAge(age: number): string {
  const today = new Date();
  const year = String(today.getUTCFullYear() - age);
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  const day = String(today.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A complete, valid v2 submission; `overrides` vary gender, age and handle. */
function answersFor(overrides: Record<string, unknown>) {
  return {
    questionnaireVersion: "2.0.0",
    answers: {
      first_name: "Smoke", last_name: "Test",
      location: "Paris, France", sexual_orientation: "Straight",
      religion: "muslim", religion_practice: "a_little",
      relationship_type: "Long Term", wants_children: "want",
      smoking: "never", partner_smoking: "fine", alcohol: "never", partner_alcohol: "fine",
      religion_match: "fine", open_to_long_distance: false, age_gap: "10", age_direction: "either",
      top_values: ["family", "growth", "fun"],
      social_energy: "mix", sleep_rhythm: "between", activity_level: "weekly",
      planning_style: "mostly_plan", money_style: "between", opposite_gender_friends: "fine",
      attach_anxiety_1: 2, attach_anxiety_2: 2, attach_avoidance_1: 2, attach_avoidance_2: 2,
      conflict_style: "cool_off", physical_affection: "quite", contact_frequency: "few_times",
      p_calm: 4, p_trust: 3, p_thorough: 4, p_open: 4,
      disclaimer_agreed: true,
      ...overrides,
    },
  };
}

export function maleAnswers(handle: string, run: number) {
  return answersFor({ gender_identity: "Male", birth_date: birthDateForAge(26), instagram_handle: `${handle}_${run}` });
}

export function femaleAnswers(handle: string, run: number) {
  return answersFor({ gender_identity: "Female", birth_date: birthDateForAge(25), instagram_handle: `${handle}_${run}` });
}

import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Mock all dependencies before any imports ──────────────────────────────────

mock.module("../../middleware/rateLimit.middleware.js", () => {
  const noop = async (_c: unknown, next: () => Promise<void>) => { await next(); };
  return {
    formSubmitRateLimiter: noop,
    adminRateLimiter:      noop,
    createRateLimiter:     () => noop,
  };
});

const mockGetActiveQuestionnaire = mock(async () => null as any);
const mockGetAllQuestionnaires   = mock(async () => [] as any[]);
const mockProcessFormSubmission  = mock(async () => ({
  alias: "Blue Falcon",
  applicantId: "64b1234567890abcdef01234",
}));

mock.module("../../services/questionnaire.service.js", () => ({
  getActiveQuestionnaire:   mockGetActiveQuestionnaire,
  getAllQuestionnaires:      mockGetAllQuestionnaires,
  buildQuestionMap:         mock(() => new Map()),
  getSensitiveQuestionIds:  mock(() => new Set()),
  getQuestionnaireByVersion: mock(async () => null),
  flattenQuestions:         mock(() => []),
}));

mock.module("../../services/form.service.js", () => ({
  processFormSubmission: mockProcessFormSubmission,
}));

import { Hono } from "hono";
import { formRoutes } from "../../routes/form.routes.js";
import { generateSubmissionKey } from "../../privacy/submission-key.js";
import { ObjectId } from "mongodb";

// ── Fixture: minimal questionnaire ──────────────────────────────────────────

function makeQuestionnaire(overrides = {}) {
  return {
    _id: new ObjectId(),
    version: "1.0.0",
    name: "Ons Application",
    isActive: true,
    sections: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Minimal valid submission body ────────────────────────────────────────────

function validBody() {
  return {
    questionnaireVersion: "1.0.0",
    answers: {
      instagram_handle: "@test_user",
      location: "Tunis",
      birth_date: "2000-05-15",
      work: "Engineer",
      gender_identity: "Male",
      sexual_orientation: "Straight",
      religion: "Islam",
      vibe_words: "funny kind",
      lifestyle: "gym coffee",
      relationship_type: "Long Term",
      open_to_long_distance: false,
      preferred_physical_traits: "tall",
      preferred_character_traits: "kind",
      deal_breakers: "smoking",
      okay_with_opposite_gender_friends: true,
      religion_deal_breaker: false,
      physical_affection_importance: 7,
      dream_first_date: "coffee walk",
      disclaimer_agreed: true,
    },
  };
}

// ── Test app ─────────────────────────────────────────────────────────────────

const app = new Hono();
app.route("/form", formRoutes);

async function get(path: string) {
  return app.request(path);
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetActiveQuestionnaire.mockReset();
  mockGetAllQuestionnaires.mockReset();
  mockProcessFormSubmission.mockReset();
  mockProcessFormSubmission.mockResolvedValue({
    alias: "Blue Falcon",
    applicantId: "64b1234567890abcdef01234",
  });
});

// ── GET /form/questionnaire ───────────────────────────────────────────────────

describe("GET /form/questionnaire", () => {
  it("returns 200 with questionnaire + submissionKey when active questionnaire exists", async () => {
    mockGetActiveQuestionnaire.mockResolvedValue(makeQuestionnaire());
    const res = await get("/form/questionnaire");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.version).toBe("1.0.0");
    expect(typeof body.data.submissionKey).toBe("string");
    expect(body.data.submissionKey).toHaveLength(64); // 32-byte hex
  });

  it("submissionKey is valid HMAC for the returned version", async () => {
    mockGetActiveQuestionnaire.mockResolvedValue(makeQuestionnaire({ version: "2.0.0" }));
    const res = await get("/form/questionnaire");
    const body = await res.json() as any;

    const expectedKey = generateSubmissionKey("2.0.0");
    expect(body.data.submissionKey).toBe(expectedKey);
  });

  it("returns 404 when no active questionnaire exists", async () => {
    mockGetActiveQuestionnaire.mockResolvedValue(null);
    const res = await get("/form/questionnaire");
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  it("returns 400 for an invalid filter value", async () => {
    const res = await get("/form/questionnaire?filter=invalid");
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/invalid filter/i);
  });

  it("returns all questionnaires when filter=all", async () => {
    mockGetAllQuestionnaires.mockResolvedValue([
      makeQuestionnaire({ version: "2.0.0" }),
      makeQuestionnaire({ version: "1.0.0", isActive: false }),
    ]);
    const res = await get("/form/questionnaire?filter=all");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    // submissionKey should NOT be present in the all-list
    expect(body.data[0].submissionKey).toBeUndefined();
  });
});

// ── POST /form/submit ─────────────────────────────────────────────────────────

describe("POST /form/submit", () => {
  it("returns 201 with alias and applicantId on valid submission", async () => {
    const key = generateSubmissionKey("1.0.0");
    const res = await post("/form/submit", validBody(), { "X-Submission-Key": key });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.alias).toBe("Blue Falcon");
    expect(body.applicantId).toBe("64b1234567890abcdef01234");
  });

  it("returns 422 when required fields are missing from the body", async () => {
    const res = await post("/form/submit", { questionnaireVersion: "1.0.0", answers: {} });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/validation/i);
  });

  it("returns 422 when questionnaireVersion is not semver", async () => {
    const bad = { ...validBody(), questionnaireVersion: "not-semver" };
    const res = await post("/form/submit", bad, { "X-Submission-Key": "x" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when the birth date is under 18 years ago", async () => {
    const tooYoung = new Date();
    tooYoung.setUTCFullYear(tooYoung.getUTCFullYear() - 16);
    const bad = { ...validBody(), answers: { ...validBody().answers, birth_date: tooYoung.toISOString().slice(0, 10) } };
    const res = await post("/form/submit", bad);
    expect(res.status).toBe(422);
  });

  it("returns 422 when disclaimer_agreed is false", async () => {
    const bad = { ...validBody(), answers: { ...validBody().answers, disclaimer_agreed: false } };
    const res = await post("/form/submit", bad);
    expect(res.status).toBe(422);
  });

  it("returns 422 when instagram_handle has invalid format", async () => {
    const bad = {
      ...validBody(),
      answers: { ...validBody().answers, instagram_handle: "has spaces here" },
    };
    const res = await post("/form/submit", bad);
    expect(res.status).toBe(422);
  });

  it("returns 400 when the service throws (e.g. invalid submission key)", async () => {
    mockProcessFormSubmission.mockRejectedValue(new Error("Invalid submission key."));
    const res = await post("/form/submit", validBody(), { "X-Submission-Key": "bad" });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/invalid submission key/i);
  });

  it("returns 400 when questionnaire version is not found by the service", async () => {
    mockProcessFormSubmission.mockRejectedValue(new Error("Questionnaire not found"));
    const key = generateSubmissionKey("99.0.0");
    const bad = { ...validBody(), questionnaireVersion: "99.0.0" };
    const res = await post("/form/submit", bad, { "X-Submission-Key": key });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/not found/i);
  });
});

// tested: matching/engine.ts
//  - getActiveContactApplicantIds — applicants in an in_progress contact must
//    not be offered as candidates or receive new proposals on the next pass.
//  - getCandidates / runFullMatchingPass — orchestration around the scorer:
//    eligibility, hard filters, ranking, top-N, and per-applicant degradation
//    (one applicant's scoring failure must never abort matching for the rest).
//
// The hard filters run for real (empty answers pass all of them). The scorer
// is replaced by a fake keyed on aliases so ordering is explicit; the real
// scorer has its own tests. The DB is mocked. No network is involved.
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";
import type { ApplicantDoc } from "../../../models/applicant.model.js";

// ── DB ────────────────────────────────────────────────────────────────────────

let inProgressMatches: Array<{ applicantAId: ObjectId; applicantBId: ObjectId }> = [];
let pool: ApplicantDoc[] = [];

const fakeMatchesCol = {
  find: mock((_filter: any, _opts?: any) => ({
    toArray: async () => inProgressMatches,
  })),
};

// Honors the predicates the engine actually queries with — status.$in (the
// active pool) and _id.$ne / _id — so the eligibility tests fail if the
// engine ever stops filtering out dating/inactive applicants.
const matchesStatus = (filter: any, a: ApplicantDoc) =>
  !filter.status?.$in || filter.status.$in.includes(a.status);
const fakeApplicantsCol = {
  find: mock((filter: any) => ({
    toArray: async () =>
      pool.filter((a) => matchesStatus(filter, a) && (!filter._id?.$ne || !a._id.equals(filter._id.$ne))),
  })),
  findOne: mock(async (filter: any) =>
    pool.find((a) => a._id.equals(filter._id) && matchesStatus(filter, a)) ?? null),
};

mock.module("../../../db/connection.js", () => ({
  getDb: async () => ({}),
  closeDb: async () => {},
}));

mock.module("../../../db/collections.js", () => ({
  COLLECTION_NAMES: {},
  getMatchesCollection:        () => fakeMatchesCol,
  getApplicantsCollection:     () => fakeApplicantsCol,
  getQuestionnairesCollection: () => ({}),
  getIdentitiesCollection:     () => ({}),
  getAuditLogsCollection:      () => ({}),
  getAdminsCollection:         () => ({}),
  getAppConfigCollection:      () => ({}),
  ensureIndexes:               async () => {},
}));

// ── Scorer ────────────────────────────────────────────────────────────────────

let pairScores: Record<string, number> = {};
let throwsFor = new Set<string>();
let scoredPairs: string[] = [];

mock.module("../../../matching/scorer.js", () => ({
  score: (a: ApplicantDoc, b: ApplicantDoc) => {
    scoredPairs.push(`${a.alias}>${b.alias}`);
    if (throwsFor.has(a.alias)) throw new Error(`scoring blew up for ${a.alias}`);
    return { score: pairScores[`${a.alias}>${b.alias}`] ?? 0.5, breakdown: { values: 0.5 } };
  },
}));

// Dynamic so the engine is evaluated after the mocks above.
const { getActiveContactApplicantIds, getCandidates, runFullMatchingPass } =
  await import("../../../matching/engine.js");

// ── Fixtures ──────────────────────────────────────────────────────────────────

function applicant(alias: string, answers: Record<string, unknown> = {}): ApplicantDoc {
  return {
    _id: new ObjectId(),
    alias,
    questionnaireVersion: "2.0.0",
    answers,
    status: "applied",
    magicToken: "a".repeat(64),
    passwordHash: null,
    scoreThreshold: 0.6,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function aliases(candidates: { alias: string }[]): string[] {
  return candidates.map((c) => c.alias);
}

beforeEach(() => {
  inProgressMatches = [];
  pool = [];
  pairScores = {};
  throwsFor = new Set();
  scoredPairs = [];
  fakeMatchesCol.find.mockClear();
});

// ── getActiveContactApplicantIds ──────────────────────────────────────────────

describe("getActiveContactApplicantIds", () => {
  it("returns an empty set when there are no in_progress matches", async () => {
    const ids = await getActiveContactApplicantIds();
    expect(ids.size).toBe(0);
  });

  it("returns both participants of an in_progress match", async () => {
    const a = new ObjectId();
    const b = new ObjectId();
    inProgressMatches = [{ applicantAId: a, applicantBId: b }];

    const ids = await getActiveContactApplicantIds();
    expect(ids).toEqual(new Set([a.toHexString(), b.toHexString()]));
  });

  it("dedupes participants across multiple in_progress matches", async () => {
    const a = new ObjectId();
    const b = new ObjectId();
    const d = new ObjectId();
    inProgressMatches = [
      { applicantAId: a, applicantBId: b },
      { applicantAId: a, applicantBId: d },
    ];

    const ids = await getActiveContactApplicantIds();
    expect(ids.size).toBe(3);
    expect(ids.has(a.toHexString())).toBe(true);
    expect(ids.has(b.toHexString())).toBe(true);
    expect(ids.has(d.toHexString())).toBe(true);
  });

  it("queries only matches with status in_progress", async () => {
    await getActiveContactApplicantIds();
    const [filter] = fakeMatchesCol.find.mock.calls[0] as any[];
    expect(filter.status).toBe("in_progress");
  });
});

// ── getCandidates ─────────────────────────────────────────────────────────────

describe("getCandidates", () => {
  it("throws 400 for a malformed applicant id", async () => {
    await expect(getCandidates("not-an-object-id")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the target doesn't exist", async () => {
    await expect(getCandidates(new ObjectId().toHexString())).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(["dating", "inactive"] as const)("throws 404 when the target exists but is %s", async (status) => {
    const target = { ...applicant("Target"), status };
    pool = [target, applicant("Other")];

    await expect(getCandidates(target._id.toHexString())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("offers only applied/matched applicants as candidates", async () => {
    const target = applicant("Target");
    pool = [
      target,
      applicant("Applied"),
      { ...applicant("Matched"), status: "matched" },
      { ...applicant("Dating"), status: "dating" },
      { ...applicant("Inactive"), status: "inactive" },
    ];

    expect(aliases(await getCandidates(target._id.toHexString())).sort()).toEqual(["Applied", "Matched"]);
  });

  it("ranks candidates by score, descending, with the scorer's breakdown", async () => {
    const target = applicant("Target");
    pool = [target, applicant("Low"), applicant("High"), applicant("Mid")];
    pairScores = { "Target>Low": 0.2, "Target>High": 0.9, "Target>Mid": 0.6 };

    const result = await getCandidates(target._id.toHexString());

    expect(aliases(result)).toEqual(["High", "Mid", "Low"]);
    expect(result[0]).toEqual({
      alias: "High",
      applicantId: pool[2]!._id.toHexString(),
      score: 0.9,
      breakdown: { values: 0.5 },
    });
  });

  it("respects topN", async () => {
    const target = applicant("Target");
    pool = [target, applicant("A"), applicant("B"), applicant("C")];
    pairScores = { "Target>A": 0.3, "Target>B": 0.8, "Target>C": 0.5 };

    expect(aliases(await getCandidates(target._id.toHexString(), 2))).toEqual(["B", "C"]);
  });

  it("returns [] when the target is in an active contact", async () => {
    const target = applicant("Target");
    pool = [target, applicant("Other")];
    inProgressMatches = [{ applicantAId: target._id, applicantBId: new ObjectId() }];

    expect(await getCandidates(target._id.toHexString())).toEqual([]);
  });

  it("excludes candidates who are in an active contact", async () => {
    const target = applicant("Target");
    const busy = applicant("Busy");
    pool = [target, busy, applicant("Free")];
    inProgressMatches = [{ applicantAId: busy._id, applicantBId: new ObjectId() }];

    expect(aliases(await getCandidates(target._id.toHexString()))).toEqual(["Free"]);
  });

  it.each([
    ["orientation", { sexual_orientation: "Straight", gender_identity: "Male" }, { gender_identity: "Male" }, { gender_identity: "Female" }],
    ["age", { birth_date: "1999-01-01", age_direction: "younger" }, { birth_date: "1990-01-01" }],
    ["religion", { religion: "muslim", religion_match: "deal_breaker" }, { religion: "christian" }],
    ["location", { location: "Tunis", open_to_long_distance: false }, { location: "Paris" }],
    ["children", { wants_children: "want" }, { wants_children: "dont_want" }],
    ["habits", { partner_smoking: "deal_breaker" }, { smoking: "regularly" }],
  ] as [string, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>?][])(
    "drops a pair rejected by the %s filter before it is scored", async (_name, targetAnswers, otherAnswers, fineAnswers = {}) => {
    const target = applicant("Target", targetAnswers);
    pool = [target, applicant("Rejected", otherAnswers), applicant("Fine", fineAnswers)];

    expect(aliases(await getCandidates(target._id.toHexString()))).toEqual(["Fine"]);
    expect(scoredPairs).toEqual(["Target>Fine"]);
  });
});

// ── runFullMatchingPass ───────────────────────────────────────────────────────

describe("runFullMatchingPass", () => {
  it("returns {} with fewer than two active applicants", async () => {
    pool = [applicant("Solo")];
    expect(await runFullMatchingPass()).toEqual({});
  });

  it("returns {} when fewer than two applicants remain outside active contacts", async () => {
    const busy = applicant("Busy");
    pool = [busy, applicant("Free")];
    inProgressMatches = [{ applicantAId: busy._id, applicantBId: new ObjectId() }];

    expect(await runFullMatchingPass()).toEqual({});
  });

  it("scores every eligible applicant against every other one", async () => {
    const [a, b, c] = [applicant("A"), applicant("B"), applicant("C")];
    pool = [a, b, c];
    pairScores = { "A>B": 0.9, "A>C": 0.1 };

    const results = await runFullMatchingPass();

    expect(Object.keys(results).sort()).toEqual([a, b, c].map((x) => x._id.toHexString()).sort());
    expect(aliases(results[a._id.toHexString()]!)).toEqual(["B", "C"]);
    expect(aliases(results[b._id.toHexString()]!).sort()).toEqual(["A", "C"]);
  });

  it("includes only applied/matched applicants in the pass", async () => {
    const dating = { ...applicant("Dating"), status: "dating" as const };
    const [a, b] = [applicant("A"), { ...applicant("B"), status: "matched" as const }];
    pool = [a, b, dating];

    const results = await runFullMatchingPass();

    expect(Object.keys(results).sort()).toEqual([a, b].map((x) => x._id.toHexString()).sort());
    expect(aliases(results[a._id.toHexString()]!)).toEqual(["B"]);
  });

  it("leaves applicants in an active contact out of the pass entirely", async () => {
    const busy = applicant("Busy");
    const [a, b] = [applicant("A"), applicant("B")];
    pool = [a, b, busy];
    inProgressMatches = [{ applicantAId: busy._id, applicantBId: new ObjectId() }];

    const results = await runFullMatchingPass();

    expect(results[busy._id.toHexString()]).toBeUndefined();
    expect(aliases(results[a._id.toHexString()]!)).toEqual(["B"]);
  });

  it("applies the hard filters in the pass", async () => {
    const wants = applicant("Wants", { wants_children: "want" });
    const doesNot = applicant("DoesNot", { wants_children: "dont_want" });
    const open = applicant("Open", { wants_children: "open" });
    pool = [wants, doesNot, open];

    const results = await runFullMatchingPass();

    expect(aliases(results[wants._id.toHexString()]!)).toEqual(["Open"]);
    expect(aliases(results[doesNot._id.toHexString()]!)).toEqual(["Open"]);
  });

  it("gives an applicant whose scoring throws [] without affecting the others", async () => {
    const [broken, a, b] = [applicant("Broken"), applicant("A"), applicant("B")];
    pool = [broken, a, b];
    throwsFor = new Set(["Broken"]);

    const results = await runFullMatchingPass();

    expect(results[broken._id.toHexString()]).toEqual([]);
    expect(aliases(results[a._id.toHexString()]!).sort()).toEqual(["B", "Broken"]);
  });

  it("caps each applicant's list at 10 candidates", async () => {
    pool = Array.from({ length: 13 }, (_, i) => applicant(`P${i}`));

    const results = await runFullMatchingPass();

    for (const list of Object.values(results)) expect(list).toHaveLength(10);
  });
});

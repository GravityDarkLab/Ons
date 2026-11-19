import { describe, expect, it } from "bun:test";
import { score } from "../../../matching/scorer.js";
import { WEIGHTS } from "../../../matching/scoring/weights.js";
import { QUESTIONS } from "../../../questionnaire/questions.js";
import { makeApplicant, validAnswers, LEGACY_V1_ANSWERS } from "./_fixtures.js";

const pair = (a: Record<string, unknown> = {}, b: Record<string, unknown> = {}) =>
  score(makeApplicant(validAnswers(a)), makeApplicant(validAnswers(b)));

/** Deterministic pseudo-random valid answers (LCG), for the symmetry property. */
function randomAnswers(seed: number): Record<string, unknown> {
  let state = seed;
  const next = (n: number) => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return Math.floor((state / 4294967296) * n);
  };
  const answers = validAnswers();
  for (const q of QUESTIONS) {
    if (q.type === "select") answers[q.id] = q.options![next(q.options!.length)]!.value;
    if (q.type === "range") answers[q.id] = 1 + next(5);
    if (q.type === "multiselect") {
      const pool = q.options!.map((o) => o.value);
      answers[q.id] = Array.from({ length: q.maxSelect! }, () => pool.splice(next(pool.length), 1)[0]);
    }
  }
  answers["birth_date"] = `${1985 + next(15)}-01-01`;
  return answers;
}

describe("weights", () => {
  it("sum to 1", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("are the agreed values", () => {
    expect(WEIGHTS).toEqual({ values: 0.25, lifestyle: 0.25, connection: 0.3, personality: 0.1, goals: 0.1 });
  });
});

describe("score", () => {
  it("identical answers score 1 on every dimension", () => {
    expect(pair()).toEqual({
      score: 1,
      breakdown: {
        values: 1, lifestyle: 1, connection: 1, personality: 1, goals: 1, age_modifier: 1,
        values_shared: 1, lifestyle_shared: 1,
      },
    });
  });

  it("is symmetric", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const a = makeApplicant(randomAnswers(seed));
      const b = makeApplicant(randomAnswers(seed + 1000));
      expect(score(a, b)).toEqual(score(b, a));
    }
  });

  it("stays within 0 and 1 for random pairs", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = score(makeApplicant(randomAnswers(seed)), makeApplicant(randomAnswers(seed + 500)));
      for (const v of [result.score, ...Object.values(result.breakdown)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("weights the dimensions and multiplies by the age modifier", () => {
    // Long Term vs Short Term → goals 0.5, everything else 1 → 0.9 + 0.1 × 0.5
    expect(pair({}, { relationship_type: "Short Term" }).score).toBe(0.95);
    // gap 7 against a limit of 5 → cos(0.2π) ≈ 0.81
    const aged = pair({ birth_date: "1992-01-01", age_gap: "5" }, { birth_date: "1999-01-01", age_gap: "any" });
    expect(aged.breakdown.age_modifier).toBe(0.81);
    expect(aged.score).toBe(0.81);
  });
});

describe("values", () => {
  it.each([
    [["family", "growth", "fun"], 1],
    [["family", "growth", "faith"], 0.89],
    [["family", "career", "faith"], 0.78],
    [["helping", "career", "faith"], 0.67],
  ])("shared top values %p → %p", (other, expected) => {
    expect(pair({}, { top_values: other }).breakdown.values).toBe(expected);
  });

  it("compares how much faith is part of daily life", () => {
    // not_at_all vs central → practice similarity 0 → (1 + 0 + 1) / 3
    expect(pair({ religion_practice: "not_at_all" }, { religion_practice: "central" }).breakdown.values).toBe(0.67);
  });

  it("'rather share a faith' lowers a different-faith pair by 1/6 per direction", () => {
    expect(pair({ religion_match: "rather_share" }, { religion: "christian" }).breakdown.values).toBe(0.83);
    expect(
      pair({ religion_match: "rather_share" }, { religion: "christian", religion_match: "rather_share" }).breakdown.values
    ).toBe(0.67);
  });

  it("'rather share a faith' costs nothing with the same named religion", () => {
    expect(pair({ religion_match: "rather_share" }, { religion_match: "deal_breaker" }).breakdown.values).toBe(1);
  });

  it("'other' is never the same religion", () => {
    expect(pair({ religion: "other", religion_match: "rather_share" }, { religion: "other" }).breakdown.values).toBe(0.83);
  });
});

describe("lifestyle", () => {
  it("a habit the partner is fine with costs nothing", () => {
    expect(pair({ smoking: "regularly" }, {}).breakdown.lifestyle).toBe(1);
  });

  it("'rather not' against a regular habit costs one sixteenth", () => {
    expect(pair({ smoking: "regularly" }, { partner_smoking: "rather_not" }).breakdown.lifestyle).toBe(0.94); // 15/16
    expect(pair({ alcohol: "sometimes" }, { partner_alcohol: "rather_not" }).breakdown.lifestyle).toBe(0.97); // 7.75/8
  });

  it("ordinal answers are compared by distance", () => {
    // home vs big_crowd → 0 for one of eight components
    expect(pair({ social_energy: "home" }, { social_energy: "big_crowd" }).breakdown.lifestyle).toBe(0.88);
    // early vs between → 0.5 for one of eight
    expect(pair({ sleep_rhythm: "early" }, { sleep_rhythm: "between" }).breakdown.lifestyle).toBe(0.94);
  });

  it("an option the definitions do not know scores a neutral 0.5", () => {
    expect(pair({ sleep_rhythm: "typo" }, {}).breakdown.lifestyle).toBe(0.94);
  });
});

describe("connection", () => {
  it("an anxious person with an avoidant person loses the whole attachment part", () => {
    const result = pair(
      { attach_anxiety_1: 5, attach_anxiety_2: 5 },
      { attach_avoidance_1: 5, attach_avoidance_2: 5 }
    );
    expect(result.breakdown.connection).toBe(0.6);
  });

  it("is a pair effect: two anxious people are not penalised", () => {
    const anxious = { attach_anxiety_1: 5, attach_anxiety_2: 5 };
    expect(pair(anxious, anxious).breakdown.connection).toBe(1);
  });

  it("identical mid-range answers give 1 − 0.4 × anx × avo", () => {
    const mid = { attach_anxiety_1: 3, attach_anxiety_2: 3, attach_avoidance_1: 3, attach_avoidance_2: 3 };
    expect(pair(mid, mid).breakdown.connection).toBe(0.9);
  });

  it.each([
    ["talk_now", "talk_now", 1],
    ["cool_off", "cool_off", 1],
    ["let_go", "let_go", 0.7],
    ["avoid", "avoid", 0.5],
    ["talk_now", "cool_off", 0.7],
    ["talk_now", "let_go", 0.4],
    ["talk_now", "avoid", 0.1],
    ["cool_off", "let_go", 0.6],
    ["cool_off", "avoid", 0.3],
    ["let_go", "avoid", 0.5],
  ])("conflict %s × %s → %p, in both orders", (x, y, fit) => {
    const expected = Math.round((0.8 + 0.2 * fit) * 100) / 100;
    expect(pair({ conflict_style: x }, { conflict_style: y }).breakdown.connection).toBe(expected);
    expect(pair({ conflict_style: y }, { conflict_style: x }).breakdown.connection).toBe(expected);
  });

  it("compares affection and contact needs by distance", () => {
    expect(pair({ physical_affection: "not_important" }, { physical_affection: "essential" }).breakdown.connection).toBe(0.8);
    expect(pair({ contact_frequency: "all_day" }, { contact_frequency: "when_needed" }).breakdown.connection).toBe(0.8);
  });
});

describe("personality", () => {
  it("is the mean distance over the four items", () => {
    // one item 1 vs 5 → 0, three identical → 0.75
    expect(pair({ p_calm: 1 }, { p_calm: 5 }).breakdown.personality).toBe(0.75);
  });
});

describe("goals", () => {
  it("opposite relationship goals halve the dimension", () => {
    expect(pair({ relationship_type: "Long Term" }, { relationship_type: "Short Term" }).breakdown.goals).toBe(0.5);
  });

  it.each([
    ["want", "open", 0.7],
    ["want", "not_sure", 0.5],
    ["open", "not_sure", 0.8],
    ["dont_want", "open", 0.5],
    ["dont_want", "not_sure", 0.5],
    ["open", "open", 1],
  ])("children %s × %s → fit %p, in both orders", (x, y, fit) => {
    const expected = Math.round(((1 + fit) / 2) * 100) / 100;
    expect(pair({ wants_children: x }, { wants_children: y }).breakdown.goals).toBe(expected);
    expect(pair({ wants_children: y }, { wants_children: x }).breakdown.goals).toBe(expected);
  });
});

describe("applicant-facing breakdown", () => {
  it("adds values_shared and lifestyle_shared alongside the full dimensions", () => {
    expect(Object.keys(pair().breakdown).sort()).toEqual([
      "age_modifier", "connection", "goals", "lifestyle", "lifestyle_shared", "personality", "values", "values_shared",
    ]);
  });

  it.each([
    ["religion_match", { religion_match: "rather_share" }, { religion: "christian" }],
    ["partner_smoking", { partner_smoking: "rather_not" }, { smoking: "regularly" }],
    ["partner_alcohol", { partner_alcohol: "rather_not" }, { alcohol: "regularly" }],
    ["opposite_gender_friends", { opposite_gender_friends: "not_ok" }, {}],
  ])("the shared bars do not move with the private answer %s", (_name, a, b) => {
    const base = pair({}, b);
    const changed = pair(a, b);
    expect(changed.breakdown.values_shared).toBe(base.breakdown.values_shared);
    expect(changed.breakdown.lifestyle_shared).toBe(base.breakdown.lifestyle_shared);
    // …while the full dimensions (and so the score) do
    expect(changed.score).toBeLessThan(base.score);
  });

  it("the shared bars still reflect shared answers", () => {
    expect(pair({}, { top_values: ["helping", "career", "faith"] }).breakdown.values_shared).toBe(0.5);
    expect(pair({ social_energy: "home" }, { social_energy: "big_crowd" }).breakdown.lifestyle_shared).toBe(0.8);
  });
});

describe("robustness", () => {
  it("scores a legacy v1 applicant against a v2 one without NaN or throwing", () => {
    const result = score(makeApplicant(LEGACY_V1_ANSWERS), makeApplicant(validAnswers()));
    for (const v of [result.score, ...Object.values(result.breakdown)]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("two applicants with no answers at all score a neutral 0.5", () => {
    expect(score(makeApplicant({}), makeApplicant({})).score).toBe(0.5);
  });

  // These cannot get past the validator; they pin the scorer's promise to be
  // total and bounded even for data written straight to the database.
  const MALFORMED: Record<string, unknown>[] = [
    { top_values: ["family", "family", "family", "family"] },
    { top_values: ["family", "faith", "career", "fun", "growth", "helping"] },
    { top_values: [] },
    { top_values: [1, null, {}] },
    { smoking: "constructor", alcohol: "toString" },
    { relationship_type: "constructor" },
    { relationship_type: "__proto__", wants_children: "hasOwnProperty" },
    { conflict_style: "valueOf", physical_affection: "constructor" },
    { partner_smoking: "__proto__", religion_match: "constructor", religion: "toString" },
    { p_calm: 99, attach_anxiety_1: -3, attach_avoidance_1: Number.NaN, p_open: Infinity },
    { age_gap: "constructor", age_direction: {}, birth_date: "not-a-date" },
  ];

  it.each(MALFORMED.map((m) => [JSON.stringify(m), m] as const))(
    "malformed stored answers %s stay finite, bounded and symmetric", (_label, bad) => {
      const picky = { partner_smoking: "rather_not", partner_alcohol: "rather_not", religion_match: "rather_share" };
      for (const [x, y] of [[bad, picky], [bad, bad], [picky, bad]] as const) {
        const a = makeApplicant(validAnswers(x));
        const b = makeApplicant(validAnswers(y));
        const forward = score(a, b);
        expect(forward).toEqual(score(b, a));
        for (const v of [forward.score, ...Object.values(forward.breakdown)]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    });

  it("duplicate top values are counted once", () => {
    expect(pair({ top_values: ["family", "family", "family"] }, {}).breakdown.values_shared).toBe(0.67); // (1/3 + 1) / 2
  });

  it("wrongly typed answers are treated as missing", () => {
    const result = pair({ top_values: "family", p_calm: "4", attach_anxiety_1: null }, {});
    for (const v of Object.values(result.breakdown)) expect(Number.isFinite(v)).toBe(true);
  });
});

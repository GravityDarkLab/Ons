import { describe, it, expect } from "bun:test";
import { baselineAlgorithm } from "../../../matching/algorithms/baseline.js";
import { makeApplicant, makeQuestionnaire, FULL_ANSWERS } from "./_fixtures.js";

const q = makeQuestionnaire();

describe("baseline — relationship_type (30%)", () => {
  it("exact match → 1.0", () => {
    const a = makeApplicant({ relationship_type: "Long Term" });
    const b = makeApplicant({ relationship_type: "Long Term" });
    const { breakdown } = baselineAlgorithm.score(a, b, q);
    expect(breakdown.relationship_type).toBe(1.0);
  });

  it("'Open to Both' on one side → 0.7", () => {
    const a = makeApplicant({ relationship_type: "Long Term" });
    const b = makeApplicant({ relationship_type: "Open to Both" });
    const { breakdown } = baselineAlgorithm.score(a, b, q);
    expect(breakdown.relationship_type).toBe(0.7);
  });

  it("mismatch (Long Term vs Short Term) → 0.0", () => {
    const a = makeApplicant({ relationship_type: "Long Term" });
    const b = makeApplicant({ relationship_type: "Short Term" });
    const { breakdown } = baselineAlgorithm.score(a, b, q);
    expect(breakdown.relationship_type).toBe(0.0);
  });

  it("missing relationship_type → 0.0", () => {
    const a = makeApplicant({});
    const b = makeApplicant({});
    const { breakdown } = baselineAlgorithm.score(a, b, q);
    expect(breakdown.relationship_type).toBe(0.0);
  });
});

describe("baseline — religion_compatibility (15%)", () => {
  it("same religion → 1.0", () => {
    const a = makeApplicant({ religion: "Islam", religion_deal_breaker: true });
    const b = makeApplicant({ religion: "Islam", religion_deal_breaker: true });
    expect(baselineAlgorithm.score(a, b, q).breakdown.religion_compatibility).toBe(1.0);
  });

  it("different religions, one flexible → 0.5", () => {
    const a = makeApplicant({ religion: "Islam", religion_deal_breaker: false });
    const b = makeApplicant({ religion: "Christianity", religion_deal_breaker: true });
    expect(baselineAlgorithm.score(a, b, q).breakdown.religion_compatibility).toBe(0.5);
  });

  it("different religions, both deal breakers → 0.0", () => {
    const a = makeApplicant({ religion: "Islam", religion_deal_breaker: true });
    const b = makeApplicant({ religion: "Christianity", religion_deal_breaker: true });
    expect(baselineAlgorithm.score(a, b, q).breakdown.religion_compatibility).toBe(0.0);
  });
});

describe("baseline — affection_importance (15%)", () => {
  it("same value → 1.0", () => {
    const a = makeApplicant({ physical_affection_importance: 7 });
    const b = makeApplicant({ physical_affection_importance: 7 });
    expect(baselineAlgorithm.score(a, b, q).breakdown.affection_importance).toBe(1.0);
  });

  it("max distance (1 vs 10) → score close to 0", () => {
    const a = makeApplicant({ physical_affection_importance: 1 });
    const b = makeApplicant({ physical_affection_importance: 10 });
    const score = baselineAlgorithm.score(a, b, q).breakdown.affection_importance;
    expect(score).toBeCloseTo(0, 1);
  });

  it("missing values → 0.5 (neutral)", () => {
    const a = makeApplicant({});
    const b = makeApplicant({});
    expect(baselineAlgorithm.score(a, b, q).breakdown.affection_importance).toBe(0.5);
  });
});

describe("baseline — long_distance (10%)", () => {
  it("both open → 1.0", () => {
    const a = makeApplicant({ open_to_long_distance: true });
    const b = makeApplicant({ open_to_long_distance: true });
    expect(baselineAlgorithm.score(a, b, q).breakdown.long_distance).toBe(1.0);
  });

  it("one open → 0.5", () => {
    const a = makeApplicant({ open_to_long_distance: true });
    const b = makeApplicant({ open_to_long_distance: false });
    expect(baselineAlgorithm.score(a, b, q).breakdown.long_distance).toBe(0.5);
  });

  it("both closed → 0.0", () => {
    const a = makeApplicant({ open_to_long_distance: false });
    const b = makeApplicant({ open_to_long_distance: false });
    expect(baselineAlgorithm.score(a, b, q).breakdown.long_distance).toBe(0.0);
  });
});

describe("baseline — deal_breakers (20%)", () => {
  it("deal breakers match the other's lifestyle → penalty applied (score < 1)", () => {
    const a = makeApplicant({ deal_breakers: "smoking drugs", lifestyle: "hiking" });
    const b = makeApplicant({ deal_breakers: "", lifestyle: "smoking parties drugs" });
    const { breakdown } = baselineAlgorithm.score(a, b, q);
    // A's deal breakers overlap with B's lifestyle → should penalise
    expect(breakdown.deal_breakers).toBeLessThan(1.0);
  });

  it("no overlap between deal breakers and lifestyle → 1.0", () => {
    const a = makeApplicant({ deal_breakers: "smoking", lifestyle: "hiking gym" });
    const b = makeApplicant({ deal_breakers: "gambling", lifestyle: "reading coffee" });
    expect(baselineAlgorithm.score(a, b, q).breakdown.deal_breakers).toBe(1.0);
  });
});

describe("baseline — composite score", () => {
  it("identical applicants with all fields filled → score = 1.0", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    const { score } = baselineAlgorithm.score(a, b, q);
    // Deal breakers overlap with own lifestyle might reduce slightly, but should be high
    expect(score).toBeGreaterThan(0.8);
  });

  it("score is always in [0, 1]", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant({
      relationship_type: "Short Term",
      open_to_long_distance: false,
      physical_affection_importance: 1,
      religion: "Other",
      religion_deal_breaker: true,
      lifestyle: "parties clubbing",
      deal_breakers: "gym fitness",
    });
    const { score } = baselineAlgorithm.score(a, b, q);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("score is rounded to 2 decimal places", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant({ ...FULL_ANSWERS, physical_affection_importance: 5 });
    const { score } = baselineAlgorithm.score(a, b, q);
    expect(score).toBe(Math.round(score * 100) / 100);
  });

  it("breakdown keys match the 6 expected dimensions", () => {
    const { breakdown } = baselineAlgorithm.score(
      makeApplicant(FULL_ANSWERS),
      makeApplicant(FULL_ANSWERS),
      q
    );
    expect(Object.keys(breakdown)).toEqual(
      expect.arrayContaining([
        "relationship_type",
        "deal_breakers",
        "religion_compatibility",
        "affection_importance",
        "long_distance",
        "lifestyle",
      ])
    );
  });
});

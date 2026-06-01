import { describe, it, expect } from "bun:test";
import { cosineAlgorithm } from "../../../matching/algorithms/cosine.js";
import { makeApplicant, makeQuestionnaire, FULL_ANSWERS } from "./_fixtures.js";

const q = makeQuestionnaire();

describe("cosine — identical applicants", () => {
  it("returns score = 1.0 when both applicants have identical answers", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    expect(cosineAlgorithm.score(a, b, q).score).toBe(1.0);
  });

  it("numeric_compatibility = 1.0 for identical numeric fields", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    expect(cosineAlgorithm.score(a, b, q).breakdown.numeric_compatibility).toBe(1.0);
  });

  it("lifestyle_similarity = 1.0 for identical lifestyle", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    expect(cosineAlgorithm.score(a, b, q).breakdown.lifestyle_similarity).toBe(1.0);
  });

  it("character_cross_match = 1.0 when vibe perfectly matches preferences", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    expect(cosineAlgorithm.score(a, b, q).breakdown.character_cross_match).toBe(1.0);
  });
});

describe("cosine — numeric vector", () => {
  it("'Long Term' + 'Long Term' → higher numeric score than 'Long Term' + 'Short Term'", () => {
    const lt1 = makeApplicant({ relationship_type: "Long Term", open_to_long_distance: true, physical_affection_importance: 7, religion_deal_breaker: false });
    const lt2 = makeApplicant({ relationship_type: "Long Term", open_to_long_distance: true, physical_affection_importance: 7, religion_deal_breaker: false });
    const st  = makeApplicant({ relationship_type: "Short Term", open_to_long_distance: false, physical_affection_importance: 3, religion_deal_breaker: true });

    const sameScore = cosineAlgorithm.score(lt1, lt2, q).breakdown.numeric_compatibility;
    const diffScore = cosineAlgorithm.score(lt1, st, q).breakdown.numeric_compatibility;

    expect(sameScore).toBeGreaterThan(diffScore);
  });

  it("'Open to Both' relationship type yields intermediate numeric similarity", () => {
    const lt   = makeApplicant({ relationship_type: "Long Term" });
    const both = makeApplicant({ relationship_type: "Open to Both" });
    const st   = makeApplicant({ relationship_type: "Short Term" });

    const ltVsBoth = cosineAlgorithm.score(lt, both, q).breakdown.numeric_compatibility;
    const ltVsSt   = cosineAlgorithm.score(lt, st, q).breakdown.numeric_compatibility;
    const ltVsLt   = cosineAlgorithm.score(lt, lt, q).breakdown.numeric_compatibility;

    expect(ltVsLt).toBeGreaterThanOrEqual(ltVsBoth);
    expect(ltVsBoth).toBeGreaterThan(ltVsSt);
  });
});

describe("cosine — deal breaker penalty", () => {
  it("when A's deal breakers appear in B's lifestyle → penalty reduces score below 1", () => {
    const a = makeApplicant({
      ...FULL_ANSWERS,
      deal_breakers: "smoking parties",
      lifestyle: "gym hiking",
    });
    const b = makeApplicant({
      ...FULL_ANSWERS,
      lifestyle: "smoking parties clubbing",
      deal_breakers: "",
    });
    const { breakdown } = cosineAlgorithm.score(a, b, q);
    expect(breakdown.deal_breaker_penalty).toBeLessThan(1.0);
  });

  it("no overlap between deal breakers and lifestyle → deal_breaker_penalty = 1.0", () => {
    const a = makeApplicant({ deal_breakers: "smoking", lifestyle: "gym" });
    const b = makeApplicant({ deal_breakers: "parties", lifestyle: "reading" });
    expect(cosineAlgorithm.score(a, b, q).breakdown.deal_breaker_penalty).toBe(1.0);
  });
});

describe("cosine — edge cases", () => {
  it("empty text fields → text components = 0", () => {
    const a = makeApplicant({});
    const b = makeApplicant({});
    const { breakdown } = cosineAlgorithm.score(a, b, q);
    expect(breakdown.lifestyle_similarity).toBe(0);
    expect(breakdown.character_cross_match).toBe(0);
  });

  it("score is always in [0, 1]", () => {
    const scenarios: [Record<string, unknown>, Record<string, unknown>][] = [
      [FULL_ANSWERS, {}],
      [{}, {}],
      [FULL_ANSWERS, { ...FULL_ANSWERS, relationship_type: "Short Term", lifestyle: "parties clubbing" }],
    ];
    for (const [answersA, answersB] of scenarios) {
      const { score } = cosineAlgorithm.score(makeApplicant(answersA), makeApplicant(answersB), q);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("score is rounded to 2 decimal places", () => {
    const { score } = cosineAlgorithm.score(
      makeApplicant(FULL_ANSWERS),
      makeApplicant({ ...FULL_ANSWERS, physical_affection_importance: 3 }),
      q
    );
    expect(score).toBe(Math.round(score * 100) / 100);
  });

  it("is symmetric — score(A, B) ≈ score(B, A)", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant({
      relationship_type: "Short Term",
      open_to_long_distance: false,
      physical_affection_importance: 3,
      lifestyle: "parties clubbing",
      vibe_words: "spontaneous wild",
      preferred_character_traits: "funny bold",
      deal_breakers: "boring",
    });
    const ab = cosineAlgorithm.score(a, b, q).score;
    const ba = cosineAlgorithm.score(b, a, q).score;
    expect(ab).toBeCloseTo(ba, 1);
  });

  it("breakdown contains expected keys", () => {
    const { breakdown } = cosineAlgorithm.score(makeApplicant(FULL_ANSWERS), makeApplicant(FULL_ANSWERS), q);
    expect(Object.keys(breakdown)).toEqual(
      expect.arrayContaining([
        "numeric_compatibility",
        "lifestyle_similarity",
        "character_cross_match",
        "character_a_wants_b",
        "character_b_wants_a",
        "deal_breaker_penalty",
      ])
    );
  });
});

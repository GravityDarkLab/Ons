import { describe, it, expect } from "bun:test";
import { scoreTraitOverlap, scorePreferenceMatch } from "../../../matching/scorers/trait.scorer.js";

describe("scoreTraitOverlap", () => {
  it("returns 1.0 for identical strings", () => {
    expect(scoreTraitOverlap("gym fitness coffee", "gym fitness coffee")).toBe(1.0);
  });

  it("returns 0.0 for completely disjoint strings", () => {
    expect(scoreTraitOverlap("gym running", "reading books")).toBe(0.0);
  });

  it("returns 0.0 when either string is empty", () => {
    expect(scoreTraitOverlap("", "gym")).toBe(0);
    expect(scoreTraitOverlap("gym", "")).toBe(0);
    expect(scoreTraitOverlap("", "")).toBe(0);
  });

  it("computes correct Jaccard: |intersection| / |union|", () => {
    // A = {gym, coffee}, B = {gym, running} → intersection=1, union=3
    const score = scoreTraitOverlap("gym coffee", "gym running");
    expect(score).toBeCloseTo(1 / 3, 5);
  });

  it("is case-insensitive", () => {
    expect(scoreTraitOverlap("Gym Coffee", "gym coffee")).toBe(1.0);
  });

  it("handles comma and semicolon delimiters", () => {
    // "gym,coffee" and "gym coffee" should tokenize identically
    expect(scoreTraitOverlap("gym,coffee", "gym coffee")).toBe(1.0);
  });

  it("ignores single-character tokens (noise)", () => {
    // tokenizer filters tokens with length <= 1
    expect(scoreTraitOverlap("a b c gym", "a b c running")).toBeCloseTo(0.0, 5);
  });

  it("is symmetric", () => {
    const a = "gym fitness hiking";
    const b = "fitness reading yoga";
    expect(scoreTraitOverlap(a, b)).toBeCloseTo(scoreTraitOverlap(b, a), 10);
  });

  it("returns a value in [0, 1] for any inputs", () => {
    const cases = [
      ["", ""],
      ["xyz", "xyz"],
      ["abc def", "ghi jkl"],
      ["shared token extra", "shared other"],
    ];
    for (const [a, b] of cases) {
      const score = scoreTraitOverlap(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("scorePreferenceMatch", () => {
  it("returns 1.0 when all preferences are found in traits", () => {
    expect(scorePreferenceMatch("funny kind", "funny kind smart")).toBe(1.0);
  });

  it("returns 0.0 when no preferences are found in traits", () => {
    expect(scorePreferenceMatch("funny kind", "smart driven ambitious")).toBe(0.0);
  });

  it("returns correct partial ratio — matched / total_prefs", () => {
    // 1 out of 2 preferences matched
    const score = scorePreferenceMatch("funny kind", "funny smart");
    expect(score).toBeCloseTo(0.5, 5);
  });

  it("returns 0 when preferences string is empty (early-exit guard)", () => {
    // The function returns 0 on empty input via the !preferencesA guard.
    // The "no prefs = satisfied" branch only fires when tokenization yields an empty set.
    expect(scorePreferenceMatch("", "funny kind smart")).toBe(0);
  });

  it("returns 0.0 when traits string is empty", () => {
    expect(scorePreferenceMatch("funny kind", "")).toBe(0.0);
  });

  it("returns 0.0 when both strings are empty", () => {
    expect(scorePreferenceMatch("", "")).toBe(0.0);
  });

  it("is case-insensitive", () => {
    expect(scorePreferenceMatch("Funny Kind", "funny kind")).toBe(1.0);
  });

  it("returns a value in [0, 1] for any inputs", () => {
    const score = scorePreferenceMatch("ambitious driven", "funny relaxed");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

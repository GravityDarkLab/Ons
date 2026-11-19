import { describe, it, expect } from "bun:test";
import { isHabitsCompatible } from "../../../matching/filters/habits.filter.js";
import { makeApplicant } from "./_fixtures.js";

const easy = { smoking: "never", partner_smoking: "fine", alcohol: "never", partner_alcohol: "fine" };
const person = (overrides: Record<string, unknown> = {}) => makeApplicant({ ...easy, ...overrides });

describe.each([
  ["smoking", "partner_smoking"],
  ["alcohol", "partner_alcohol"],
])("isHabitsCompatible — %s", (habit, preference) => {
  it("rejects a deal-breaker holder with someone who does it sometimes or regularly", () => {
    expect(isHabitsCompatible(person({ [preference]: "deal_breaker" }), person({ [habit]: "sometimes" }))).toBe(false);
    expect(isHabitsCompatible(person({ [preference]: "deal_breaker" }), person({ [habit]: "regularly" }))).toBe(false);
  });

  it("is checked in both directions", () => {
    expect(isHabitsCompatible(person({ [habit]: "sometimes" }), person({ [preference]: "deal_breaker" }))).toBe(false);
  });

  it("accepts a deal-breaker holder with someone who never does it", () => {
    expect(isHabitsCompatible(person({ [preference]: "deal_breaker" }), person({ [habit]: "never" }))).toBe(true);
  });

  it("'rather not' is not a filter", () => {
    expect(isHabitsCompatible(person({ [preference]: "rather_not" }), person({ [habit]: "regularly" }))).toBe(true);
  });

  it("a missing habit answer passes", () => {
    const unknown = makeApplicant({});
    expect(isHabitsCompatible(person({ [preference]: "deal_breaker" }), unknown)).toBe(true);
  });
});

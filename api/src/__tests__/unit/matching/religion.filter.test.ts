import { describe, it, expect } from "bun:test";
import { isReligionCompatible } from "../../../matching/filters/religion.filter.js";
import { makeApplicant } from "./_fixtures.js";

const person = (religion: string | undefined, match?: string) =>
  makeApplicant({ ...(religion ? { religion } : {}), ...(match ? { religion_match: match } : {}) });

describe("isReligionCompatible", () => {
  it("passes when both share a named religion, whatever the preference", () => {
    expect(isReligionCompatible(person("muslim", "deal_breaker"), person("muslim", "deal_breaker"))).toBe(true);
  });

  it("fails when a deal-breaker holder meets a different religion, in either order", () => {
    expect(isReligionCompatible(person("muslim", "deal_breaker"), person("christian", "fine"))).toBe(false);
    expect(isReligionCompatible(person("christian", "fine"), person("muslim", "deal_breaker"))).toBe(false);
  });

  it("passes when religions differ and nobody holds a deal breaker", () => {
    expect(isReligionCompatible(person("muslim", "rather_share"), person("christian", "fine"))).toBe(true);
  });

  it("a named deal-breaker holder is never paired with other or prefer_not_to_say", () => {
    expect(isReligionCompatible(person("muslim", "deal_breaker"), person("other", "fine"))).toBe(false);
    expect(isReligionCompatible(person("muslim", "deal_breaker"), person("prefer_not_to_say", "fine"))).toBe(false);
  });

  it("a deal breaker held by someone whose own religion is not named is ignored", () => {
    expect(isReligionCompatible(person("other", "deal_breaker"), person("muslim", "fine"))).toBe(true);
    expect(isReligionCompatible(person("prefer_not_to_say", "deal_breaker"), person("other", "deal_breaker"))).toBe(true);
  });

  it("two 'other' answers are not the same religion for a named holder's deal breaker", () => {
    expect(isReligionCompatible(person("other", "fine"), person("christian", "deal_breaker"))).toBe(false);
  });

  it("not_religious is a named choice that can be a deal breaker", () => {
    expect(isReligionCompatible(person("not_religious", "deal_breaker"), person("muslim", "fine"))).toBe(false);
    expect(isReligionCompatible(person("not_religious", "deal_breaker"), person("not_religious", "fine"))).toBe(true);
  });

  it("passes when a religion answer is missing", () => {
    expect(isReligionCompatible(person(undefined, "deal_breaker"), person("muslim", "deal_breaker"))).toBe(true);
  });
});

import { describe, it, expect } from "bun:test";
import { isChildrenCompatible } from "../../../matching/filters/children.filter.js";
import { makeApplicant } from "./_fixtures.js";

const person = (wants?: string) => makeApplicant(wants ? { wants_children: wants } : {});
const ALL = ["want", "open", "dont_want", "not_sure"];

describe("isChildrenCompatible", () => {
  it("rejects want with dont_want in both orders", () => {
    expect(isChildrenCompatible(person("want"), person("dont_want"))).toBe(false);
    expect(isChildrenCompatible(person("dont_want"), person("want"))).toBe(false);
  });

  it("accepts every other combination", () => {
    for (const a of ALL) for (const b of ALL) {
      const clash = (a === "want" && b === "dont_want") || (a === "dont_want" && b === "want");
      expect(isChildrenCompatible(person(a), person(b))).toBe(!clash);
    }
  });

  it("passes when an answer is missing", () => {
    expect(isChildrenCompatible(person(), person("dont_want"))).toBe(true);
    expect(isChildrenCompatible(person("want"), person())).toBe(true);
  });
});

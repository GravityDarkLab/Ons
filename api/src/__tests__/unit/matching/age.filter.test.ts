import { describe, it, expect } from "bun:test";
import { isAgeCompatible, ageModifier } from "../../../matching/filters/age.filter.js";
import { makeApplicant } from "./_fixtures.js";

type Gap = "3" | "5" | "10" | "any" | undefined;
type Direction = "either" | "older" | "younger" | undefined;

const person = (birthDate: string | undefined, gap: Gap = "any", direction: Direction = "either") =>
  makeApplicant({ birth_date: birthDate, age_gap: gap, age_direction: direction });

// Ages are computed from today; these two are always exactly N whole years apart.
const born = (year: number) => `${year}-01-01`;

describe("isAgeCompatible", () => {
  it("passes when the gap is within both limits", () => {
    expect(isAgeCompatible(person(born(1994), "5"), person(born(1999), "5"))).toBe(true);
  });

  it("'any' imposes no limit", () => {
    expect(isAgeCompatible(person(born(1970), "any"), person(born(1999), "any"))).toBe(true);
  });

  // At exactly twice the limit the age modifier is cos(π/2) ≈ 0, so a pair that
  // passed would be saved with a score of 0 (#39). The boundary is exclusive.
  it("accepts a gap just under twice the limit and rejects exactly twice", () => {
    expect(isAgeCompatible(person(born(1991), "5"), person(born(2000), "any"))).toBe(true);
    expect(isAgeCompatible(person(born(1990), "5"), person(born(2000), "any"))).toBe(false);
  });

  it("every pair it accepts gets an age modifier above 0", () => {
    for (let year = 1975; year <= 2000; year++) {
      for (const gap of ["3", "5", "10"] as const) {
        const a = person(born(year), gap);
        const b = person(born(2000), "any");
        if (isAgeCompatible(a, b)) expect(ageModifier(a, b)).toBeGreaterThan(1e-9);
      }
    }
  });

  it("is checked in both directions", () => {
    expect(isAgeCompatible(person(born(2000), "any"), person(born(1989), "5"))).toBe(false);
  });

  it("'older' rejects a younger partner even with no gap limit", () => {
    expect(isAgeCompatible(person(born(1994), "any", "older"), person(born(1999)))).toBe(false);
    expect(isAgeCompatible(person(born(1999), "any", "older"), person(born(1994)))).toBe(true);
  });

  it("'younger' rejects an older partner even with no gap limit", () => {
    expect(isAgeCompatible(person(born(1999), "any", "younger"), person(born(1994)))).toBe(false);
    expect(isAgeCompatible(person(born(1994), "any", "younger"), person(born(1999)))).toBe(true);
  });

  it("'either' accepts both, and a same-age partner always passes direction", () => {
    expect(isAgeCompatible(person(born(1994), "any", "either"), person(born(1999)))).toBe(true);
    expect(isAgeCompatible(person(born(1994), "any", "older"), person(born(1994), "any", "younger"))).toBe(true);
  });

  it("passes when a birth date is missing", () => {
    expect(isAgeCompatible(person(undefined, "3", "older"), person(born(1960)))).toBe(true);
  });

  it("treats a missing or unknown preference as no preference", () => {
    expect(isAgeCompatible(person(born(1970), undefined, undefined), person(born(1999)))).toBe(true);
    expect(isAgeCompatible(makeApplicant({ birth_date: born(1970), age_gap: "lots" }), person(born(1999)))).toBe(true);
  });
});

describe("ageModifier", () => {
  it("is 1 within the limit, including exactly at it", () => {
    expect(ageModifier(person(born(1994), "5"), person(born(1999), "5"))).toBe(1);
  });

  it("is 1 with no limit or a missing birth date", () => {
    expect(ageModifier(person(born(1970), "any"), person(born(1999), "any"))).toBe(1);
    expect(ageModifier(person(undefined, "3"), person(born(1999), "3"))).toBe(1);
  });

  it("decays as cos(0.2π) at gap 7 for a limit of 5", () => {
    expect(ageModifier(person(born(1992), "5"), person(born(1999), "any"))).toBeCloseTo(Math.cos(0.2 * Math.PI), 10);
  });

  it("takes the stricter of the two people", () => {
    const strict = ageModifier(person(born(1992), "5"), person(born(1999), "10"));
    expect(strict).toBeCloseTo(Math.cos(0.2 * Math.PI), 10);
  });

  it("is 0 beyond twice the limit", () => {
    expect(ageModifier(person(born(1980), "5"), person(born(1999), "any"))).toBe(0);
  });
});

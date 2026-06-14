import { describe, expect, it } from "bun:test";
import { ageFromBirthDate } from "../../../utils/age";

const TODAY = new Date("2026-06-12T00:00:00Z");

describe("ageFromBirthDate", () => {
  it("computes full years when the birthday has passed this year", () => {
    expect(ageFromBirthDate("1998-03-10", TODAY)).toBe(28);
  });

  it("computes full years when the birthday is still ahead this year", () => {
    expect(ageFromBirthDate("1998-11-20", TODAY)).toBe(27);
  });

  it("counts the birthday itself as already had", () => {
    expect(ageFromBirthDate("1998-06-12", TODAY)).toBe(28);
  });

  it("returns null for malformed input", () => {
    expect(ageFromBirthDate("12.06.1998", TODAY)).toBeNull();
    expect(ageFromBirthDate("1998-6-12", TODAY)).toBeNull();
    expect(ageFromBirthDate(27, TODAY)).toBeNull();
    expect(ageFromBirthDate(undefined, TODAY)).toBeNull();
  });

  it("returns null for impossible calendar dates", () => {
    expect(ageFromBirthDate("1998-02-31", TODAY)).toBeNull();
    expect(ageFromBirthDate("1998-13-01", TODAY)).toBeNull();
  });
});

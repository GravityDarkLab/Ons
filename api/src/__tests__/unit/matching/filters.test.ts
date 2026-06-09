import { describe, it, expect } from "bun:test";
import { isOrientationCompatible, filterCandidates } from "../../../matching/filters.js";
import type { ApplicantDoc } from "../../../models/applicant.model.js";
import { ObjectId } from "mongodb";

function makeApplicant(
  orientation: string,
  gender: string,
  overrides: Partial<ApplicantDoc> = {}
): ApplicantDoc {
  return {
    _id: new ObjectId(),
    alias: "Test Alias",
    questionnaireVersion: "1.0.0",
    answers: { sexual_orientation: orientation, gender_identity: gender },
    status: "applied",
    magicToken: "a".repeat(64),
    passwordHash: "hash",
    scoreThreshold: 0.8,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("isOrientationCompatible — Straight", () => {
  it("Straight Male + Straight Female → compatible", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Straight", "Male"),
        makeApplicant("Straight", "Female")
      )
    ).toBe(true);
  });

  it("Straight Female + Straight Male → compatible (reversed)", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Straight", "Female"),
        makeApplicant("Straight", "Male")
      )
    ).toBe(true);
  });

  it("Straight Male + Straight Male → incompatible", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Straight", "Male"),
        makeApplicant("Straight", "Male")
      )
    ).toBe(false);
  });

  it("Straight Female + Straight Female → incompatible", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Straight", "Female"),
        makeApplicant("Straight", "Female")
      )
    ).toBe(false);
  });

  it("Straight Male + Gay Male → incompatible (Gay Male wants Male, Straight Male wants Female)", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Straight", "Male"),
        makeApplicant("Gay", "Male")
      )
    ).toBe(false);
  });
});

describe("isOrientationCompatible — Gay", () => {
  it("Gay Male + Gay Male → compatible", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Gay", "Male"),
        makeApplicant("Gay", "Male")
      )
    ).toBe(true);
  });

  it("Gay Male + Lesbian Female → incompatible (Gay wants Male, Lesbian wants Female)", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Gay", "Male"),
        makeApplicant("Lesbian", "Female")
      )
    ).toBe(false);
  });

  it("Gay Male + Straight Female → incompatible (Gay Male wants Male, Straight Female wants Male → both want Male partner)", () => {
    // Gay Male wants Male partner ✓ for Female? No — Gay Male wants Male, partner is Female → ✗
    expect(
      isOrientationCompatible(
        makeApplicant("Gay", "Male"),
        makeApplicant("Straight", "Female")
      )
    ).toBe(false);
  });

  it("Gay Female (unusual data) → excluded", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Gay", "Female"),
        makeApplicant("Gay", "Female")
      )
    ).toBe(false);
  });
});

describe("isOrientationCompatible — Lesbian", () => {
  it("Lesbian Female + Lesbian Female → compatible", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Lesbian", "Female"),
        makeApplicant("Lesbian", "Female")
      )
    ).toBe(true);
  });

  it("Lesbian Female + Straight Female → incompatible (Straight Female wants Male)", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Lesbian", "Female"),
        makeApplicant("Straight", "Female")
      )
    ).toBe(false);
  });

  it("Lesbian Male (unusual data) → excluded", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Lesbian", "Male"),
        makeApplicant("Lesbian", "Female")
      )
    ).toBe(false);
  });
});

describe("isOrientationCompatible — Bisexual / Pansexual", () => {
  it("Bisexual + Straight Male → compatible", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Bisexual", "Female"),
        makeApplicant("Straight", "Male")
      )
    ).toBe(true);
  });

  it("Bisexual + Lesbian Female → compatible (Bisexual has no gender filter)", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Bisexual", "Female"),
        makeApplicant("Lesbian", "Female")
      )
    ).toBe(true);
  });

  it("Pansexual + any gender/orientation → compatible", () => {
    const pan = makeApplicant("Pansexual", "Male");
    expect(isOrientationCompatible(pan, makeApplicant("Straight", "Female"))).toBe(true);
    expect(isOrientationCompatible(pan, makeApplicant("Gay", "Male"))).toBe(true);
    expect(isOrientationCompatible(pan, makeApplicant("Lesbian", "Female"))).toBe(false); // Lesbian Female doesn't want Male
  });

  it("Bisexual + Bisexual → compatible", () => {
    expect(
      isOrientationCompatible(
        makeApplicant("Bisexual", "Male"),
        makeApplicant("Bisexual", "Female")
      )
    ).toBe(true);
  });
});

describe("isOrientationCompatible — Asexual / missing", () => {
  it("Asexual has no gender filter — but other side's filter still applies", () => {
    const ace = makeApplicant("Asexual", "Female");
    // Straight Male wants Female → compatible with Asexual Female ✓
    expect(isOrientationCompatible(ace, makeApplicant("Straight", "Male"))).toBe(true);
    // Gay Male wants Male → Asexual Female is Female, so Gay Male's side fails ✗
    expect(isOrientationCompatible(ace, makeApplicant("Gay", "Male"))).toBe(false);
    // Lesbian Female wants Female → compatible with Asexual Female ✓
    expect(isOrientationCompatible(ace, makeApplicant("Lesbian", "Female"))).toBe(true);
    // Another Asexual → both pass through ✓
    expect(isOrientationCompatible(ace, makeApplicant("Asexual", "Male"))).toBe(true);
  });

  it("empty orientation → no gender filter, but other side's filter still applies", () => {
    // Unknown person has no gender — Straight Male wants Female; "" !== "Female" → fails
    const unknown = makeApplicant("", "");
    expect(isOrientationCompatible(unknown, makeApplicant("Straight", "Male"))).toBe(false);
    // Bisexual has no gender filter → both sides pass ✓
    expect(isOrientationCompatible(unknown, makeApplicant("Bisexual", "Female"))).toBe(true);
    // Two unknowns → both pass through ✓
    expect(isOrientationCompatible(unknown, makeApplicant("", ""))).toBe(true);
  });

  it("'Prefer not to say' orientation → compatible with any", () => {
    const pnts = makeApplicant("Prefer not to say", "Male");
    expect(isOrientationCompatible(pnts, makeApplicant("Straight", "Female"))).toBe(true);
    expect(isOrientationCompatible(pnts, makeApplicant("Bisexual", "Female"))).toBe(true);
  });
});

describe("filterCandidates", () => {
  it("removes incompatible candidates, keeps compatible ones", () => {
    const target = makeApplicant("Straight", "Male");
    const compatible = makeApplicant("Straight", "Female");
    const incompatible1 = makeApplicant("Straight", "Male");
    const incompatible2 = makeApplicant("Lesbian", "Female");

    const result = filterCandidates(target, [compatible, incompatible1, incompatible2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(compatible);
  });

  it("returns empty array when all candidates are incompatible", () => {
    const target = makeApplicant("Straight", "Male");
    const candidates = [
      makeApplicant("Straight", "Male"),
      makeApplicant("Gay", "Male"),
      makeApplicant("Lesbian", "Female"),
    ];
    expect(filterCandidates(target, candidates)).toHaveLength(0);
  });

  it("returns all candidates when all are compatible (Bisexual target)", () => {
    const target = makeApplicant("Bisexual", "Female");
    const candidates = [
      makeApplicant("Bisexual", "Male"),
      makeApplicant("Straight", "Male"),
      makeApplicant("Bisexual", "Female"),
    ];
    expect(filterCandidates(target, candidates)).toHaveLength(3);
  });

  it("handles empty candidates list", () => {
    expect(filterCandidates(makeApplicant("Straight", "Male"), [])).toEqual([]);
  });
});

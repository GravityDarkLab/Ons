import { describe, it, expect } from "bun:test";
import { ObjectId } from "mongodb";
import { isLongDistanceCompatible } from "../../../matching/filters/location.filter.js";
import type { ApplicantDoc } from "../../../models/applicant.model.js";

function makeApplicant(location: string | undefined, openToLD: boolean | null): ApplicantDoc {
  return {
    _id: new ObjectId(),
    alias: "Test",
    questionnaireVersion: "1.1.0",
    answers: {
      ...(location !== undefined ? { location } : {}),
      ...(openToLD !== null ? { open_to_long_distance: openToLD } : {}),
    },
    status: "applied",
    magicToken: "tok",
    scoreThreshold: 0.7,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ApplicantDoc;
}

describe("isLongDistanceCompatible", () => {
  it("passes when both are in the same city", () => {
    const a = makeApplicant("Paris, France", false);
    const b = makeApplicant("Paris, France", false);
    expect(isLongDistanceCompatible(a, b)).toBe(true);
  });

  it("passes when both are open to long distance and in different cities", () => {
    const a = makeApplicant("Paris, France", true);
    const b = makeApplicant("Tunis, Tunisia", true);
    expect(isLongDistanceCompatible(a, b)).toBe(true);
  });

  it("fails when A is not open to LD and they are in different cities", () => {
    const a = makeApplicant("Paris, France", false);
    const b = makeApplicant("Berlin, Germany", true);
    expect(isLongDistanceCompatible(a, b)).toBe(false);
  });

  it("fails when B is not open to LD and they are in different cities", () => {
    const a = makeApplicant("London, UK", true);
    const b = makeApplicant("Dubai, UAE", false);
    expect(isLongDistanceCompatible(a, b)).toBe(false);
  });

  it("fails when both are not open to LD and in different cities", () => {
    const a = makeApplicant("Montreal, Canada", false);
    const b = makeApplicant("Lyon, France", false);
    expect(isLongDistanceCompatible(a, b)).toBe(false);
  });

  it("passes when location is missing (skip filter)", () => {
    const a = makeApplicant(undefined, false);
    const b = makeApplicant("Tunis, Tunisia", true);
    expect(isLongDistanceCompatible(a, b)).toBe(true);
  });

  it("is case-insensitive for location comparison", () => {
    const a = makeApplicant("paris, france", false);
    const b = makeApplicant("Paris, France", false);
    expect(isLongDistanceCompatible(a, b)).toBe(true);
  });

  // The city option list relabeled Jerusalem/Tel Aviv/Haifa from "Israel" to
  // "Palestine" after some applicants had already submitted with the old
  // string — without aliasing, those pairs would wrongly look like different
  // cities and trip the long-distance hard filter.
  it("treats the old and new Jerusalem labels as the same city", () => {
    const a = makeApplicant("Jerusalem, Israel", false);
    const b = makeApplicant("Jerusalem, Palestine", false);
    expect(isLongDistanceCompatible(a, b)).toBe(true);
  });

  it("treats the old and new Tel Aviv labels as the same city", () => {
    const a = makeApplicant("Tel Aviv, Israel", false);
    const b = makeApplicant("Tel Aviv, Palestine", false);
    expect(isLongDistanceCompatible(a, b)).toBe(true);
  });

  it("treats the old and new Haifa labels as the same city", () => {
    const a = makeApplicant("Haifa, Israel", false);
    const b = makeApplicant("Haifa, Palestine", false);
    expect(isLongDistanceCompatible(a, b)).toBe(true);
  });
});

import { describe, expect, it } from "bun:test";
import { hashInstagram, normalizeInstagram } from "../../../privacy/hash";

describe("normalizeInstagram", () => {
  it("strips leading @", () => {
    expect(normalizeInstagram("@User")).toBe("user");
  });

  it("lowercases without @", () => {
    expect(normalizeInstagram("User")).toBe("user");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeInstagram("  @User  ")).toBe("user");
  });

  it("handles already-normalized handle", () => {
    expect(normalizeInstagram("user")).toBe("user");
  });
});

describe("hashInstagram", () => {
  it("returns a non-empty string", () => {
    expect(hashInstagram("user")).toBeTruthy();
  });

  it("is deterministic for the same input", () => {
    expect(hashInstagram("user")).toBe(hashInstagram("user"));
  });

  it("normalizes before hashing — @User equals user", () => {
    expect(hashInstagram("@User")).toBe(hashInstagram("user"));
  });

  it("returns different hashes for different handles", () => {
    expect(hashInstagram("alice")).not.toBe(hashInstagram("bob"));
  });
});

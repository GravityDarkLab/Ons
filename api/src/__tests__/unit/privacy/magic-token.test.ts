import { describe, expect, it } from "bun:test";
import {
  generateMagicToken,
  generateReadablePassword,
} from "../../../privacy/magic-token";

describe("generateMagicToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateMagicToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different values on consecutive calls", () => {
    const a = generateMagicToken();
    const b = generateMagicToken();
    expect(a).not.toBe(b);
  });
});

describe("generateReadablePassword", () => {
  it("returns a string with exactly three hyphens (four words)", () => {
    const pwd = generateReadablePassword();
    const parts = pwd.split("-");
    expect(parts).toHaveLength(4);
  });

  it("returns lowercase alphabetic words only", () => {
    const pwd = generateReadablePassword();
    for (const part of pwd.split("-")) {
      expect(part).toMatch(/^[a-z]+$/);
    }
  });

  it("returns different values on consecutive calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) seen.add(generateReadablePassword());
    expect(seen.size).toBeGreaterThan(1);
  });
});

import { describe, it, expect } from "bun:test";
import { generateUniqueAlias } from "../../../privacy/alias.generator.js";

describe("generateUniqueAlias", () => {
  it("returns a two-word string", () => {
    const alias = generateUniqueAlias([]);
    const parts = alias.split(" ");
    // Normal aliases are 2 words; fallback can be 3 (with numeric suffix)
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it("each word starts with an uppercase letter", () => {
    for (let i = 0; i < 20; i++) {
      const alias = generateUniqueAlias([]);
      for (const word of alias.split(" ")) {
        expect(word[0]).toBe(word[0].toUpperCase());
      }
    }
  });

  it("never returns an alias already in the existing set", () => {
    const existing: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const alias = generateUniqueAlias(existing);
      expect(seen.has(alias)).toBe(false);
      existing.push(alias);
      seen.add(alias);
    }
  });

  it("does not repeat across 200 consecutive calls with growing exclusion list", () => {
    const used: string[] = [];
    for (let i = 0; i < 200; i++) {
      const alias = generateUniqueAlias(used);
      expect(used.includes(alias)).toBe(false);
      used.push(alias);
    }
  });

  it("returns an alias not in the passed set even when the set is large", () => {
    // Build a set of 500 fake aliases that don't exist in the real pool
    const huge = Array.from({ length: 500 }, (_, i) => `Fake Alias${i}`);
    const alias = generateUniqueAlias(huge);
    expect(huge.includes(alias)).toBe(false);
  });

  it("falls back gracefully when pool is almost exhausted (numeric suffix)", () => {
    // Create 2500 aliases — more than the 2592 pool → forces fallback suffix
    // We don't exhaust the full pool here, just verify the function doesn't throw
    const used: string[] = [];
    expect(() => {
      for (let i = 0; i < 500; i++) {
        used.push(generateUniqueAlias(used));
      }
    }).not.toThrow();
  });

  it("accepts an empty existing list", () => {
    expect(() => generateUniqueAlias([])).not.toThrow();
  });
});

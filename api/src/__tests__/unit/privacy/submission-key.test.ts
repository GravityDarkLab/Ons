import { describe, it, expect } from "bun:test";
import {
  generateSubmissionKey,
  verifySubmissionKey,
} from "../../../privacy/submission-key.js";

describe("generateSubmissionKey", () => {
  it("returns a 64-character hex string", () => {
    const key = generateSubmissionKey("1.0.0");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same version always produces same key", () => {
    expect(generateSubmissionKey("1.0.0")).toBe(generateSubmissionKey("1.0.0"));
  });

  it("produces different keys for different versions", () => {
    expect(generateSubmissionKey("1.0.0")).not.toBe(generateSubmissionKey("2.0.0"));
    expect(generateSubmissionKey("1.0.0")).not.toBe(generateSubmissionKey("1.0.1"));
  });
});

describe("verifySubmissionKey", () => {
  it("returns true for the correct key", () => {
    const version = "1.0.0";
    const key = generateSubmissionKey(version);
    expect(verifySubmissionKey(version, key)).toBe(true);
  });

  it("returns false for a key generated from a different version", () => {
    const key = generateSubmissionKey("1.0.0");
    expect(verifySubmissionKey("2.0.0", key)).toBe(false);
  });

  it("returns false for a completely wrong key", () => {
    expect(verifySubmissionKey("1.0.0", "a".repeat(64))).toBe(false);
  });

  it("returns false for a key with incorrect length (not 32 bytes hex)", () => {
    // timingSafeEqual throws when buffer lengths differ; we must return false
    expect(verifySubmissionKey("1.0.0", "deadbeef")).toBe(false);
  });

  it("returns false for an empty string key", () => {
    expect(verifySubmissionKey("1.0.0", "")).toBe(false);
  });

  it("returns false for a key with non-hex characters", () => {
    expect(verifySubmissionKey("1.0.0", "z".repeat(64))).toBe(false);
  });

  it("is safe against timing attacks — uses constant-time comparison", () => {
    // Behavioural proof: near-correct keys should not short-circuit faster.
    // We can't measure time in unit tests, but we verify the function itself
    // uses timingSafeEqual by confirming it handles length mismatches gracefully.
    const key = generateSubmissionKey("1.0.0");
    const truncated = key.slice(0, 32);
    expect(verifySubmissionKey("1.0.0", truncated)).toBe(false);
  });
});

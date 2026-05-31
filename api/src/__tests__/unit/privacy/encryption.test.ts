import { describe, it, expect } from "bun:test";
import { encrypt, decrypt } from "../../../privacy/encryption.js";

describe("encrypt", () => {
  it("returns encrypted, iv, and tag fields", () => {
    const result = encrypt("hello");
    expect(result).toHaveProperty("encrypted");
    expect(result).toHaveProperty("iv");
    expect(result).toHaveProperty("tag");
  });

  it("returns hex-encoded strings", () => {
    const { encrypted, iv, tag } = encrypt("hello");
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    expect(iv).toMatch(/^[0-9a-f]+$/);
    expect(tag).toMatch(/^[0-9a-f]+$/);
  });

  it("generates a fresh IV on every call — same plaintext yields different ciphertext", () => {
    const a = encrypt("instagram_handle");
    const b = encrypt("instagram_handle");
    expect(a.iv).not.toBe(b.iv);
    expect(a.encrypted).not.toBe(b.encrypted);
  });

  it("produces a 32-character (16-byte) IV", () => {
    const { iv } = encrypt("test");
    expect(iv).toHaveLength(32); // 16 bytes × 2 hex chars
  });

  it("produces a 32-character (16-byte) GCM auth tag", () => {
    const { tag } = encrypt("test");
    expect(tag).toHaveLength(32);
  });
});

describe("decrypt", () => {
  it("round-trips ASCII plaintext", () => {
    const plaintext = "achraf_test_handle";
    const { encrypted, iv, tag } = encrypt(plaintext);
    expect(decrypt(encrypted, iv, tag)).toBe(plaintext);
  });

  it("round-trips unicode / Arabic text", () => {
    const plaintext = "مرحبا أنس";
    const { encrypted, iv, tag } = encrypt(plaintext);
    expect(decrypt(encrypted, iv, tag)).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const { encrypted, iv, tag } = encrypt("");
    expect(decrypt(encrypted, iv, tag)).toBe("");
  });

  it("round-trips a string with special characters", () => {
    const plaintext = "@user.name_123!#$%";
    const { encrypted, iv, tag } = encrypt(plaintext);
    expect(decrypt(encrypted, iv, tag)).toBe(plaintext);
  });

  it("throws when the auth tag is tampered", () => {
    const { encrypted, iv } = encrypt("sensitive_handle");
    const badTag = "ff".repeat(16);
    expect(() => decrypt(encrypted, iv, badTag)).toThrow();
  });

  it("throws when the ciphertext is tampered", () => {
    const { iv, tag } = encrypt("sensitive_handle");
    const badCiphertext = "00".repeat(20);
    expect(() => decrypt(badCiphertext, iv, tag)).toThrow();
  });

  it("throws when the IV is wrong", () => {
    const { encrypted, tag } = encrypt("sensitive_handle");
    const wrongIv = "bb".repeat(16);
    expect(() => decrypt(encrypted, wrongIv, tag)).toThrow();
  });
});

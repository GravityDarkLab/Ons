import { describe, expect, it, afterEach } from "bun:test";
import {
  parseAllowedOrigins,
  validateEncryptionKey,
  validateEmbeddingProvider,
  validatePositiveInt,
} from "../../../config/env.js";

describe("parseAllowedOrigins", () => {
  it("accepts comma and semicolon separated origins", () => {
    expect(
      parseAllowedOrigins(
        "http://localhost:3000,http://localhost:5173,http://localhost:5174;http://localhost:3001"
      )
    ).toEqual([
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3001",
    ]);
  });

  it("trims whitespace and trailing slashes", () => {
    expect(
      parseAllowedOrigins(" http://localhost:5174/ ; http://localhost:3001// ")
    ).toEqual(["http://localhost:5174", "http://localhost:3001"]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseAllowedOrigins("")).toEqual([]);
  });

  it("returns an empty array when only separators are present", () => {
    expect(parseAllowedOrigins(" ,;,; ")).toEqual([]);
  });

  it("filters out empty segments from leading/trailing/double separators", () => {
    expect(parseAllowedOrigins(",http://a.com,,http://b.com,")).toEqual([
      "http://a.com",
      "http://b.com",
    ]);
  });

  it("returns a single-element array when no separator is present", () => {
    expect(parseAllowedOrigins("http://localhost:3000")).toEqual([
      "http://localhost:3000",
    ]);
  });

  it("strips many trailing slashes but preserves internal path segments", () => {
    expect(parseAllowedOrigins("http://localhost:5174/api///")).toEqual([
      "http://localhost:5174/api",
    ]);
  });
});

describe("validateEncryptionKey", () => {
  it("accepts exactly 64 hex characters", () => {
    const key = "a".repeat(64);
    expect(validateEncryptionKey(key)).toBe(key);
  });

  it("accepts uppercase hex characters", () => {
    const key = "A".repeat(64);
    expect(validateEncryptionKey(key)).toBe(key);
  });

  it("rejects a key shorter than 64 characters", () => {
    expect(() => validateEncryptionKey("a".repeat(63))).toThrow(
      /must be exactly 64 hex characters/
    );
  });

  it("rejects a key longer than 64 characters", () => {
    expect(() => validateEncryptionKey("a".repeat(65))).toThrow(
      /must be exactly 64 hex characters/
    );
  });

  it("rejects non-hex characters", () => {
    expect(() => validateEncryptionKey("g".repeat(64))).toThrow(
      /must be exactly 64 hex characters/
    );
  });

  it("rejects an empty string", () => {
    expect(() => validateEncryptionKey("")).toThrow();
  });
});

describe("validateEmbeddingProvider", () => {
  const originalBaseUrl = process.env.EMBEDDING_BASE_URL;
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.EMBEDDING_BASE_URL;
    else process.env.EMBEDDING_BASE_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("accepts 'local' when EMBEDDING_BASE_URL is set", () => {
    process.env.EMBEDDING_BASE_URL = "http://localhost:1234/v1";
    expect(validateEmbeddingProvider("local")).toBe("local");
  });

  it("rejects 'local' when EMBEDDING_BASE_URL is missing", () => {
    delete process.env.EMBEDDING_BASE_URL;
    expect(() => validateEmbeddingProvider("local")).toThrow(
      /EMBEDDING_BASE_URL is required/
    );
  });

  it("accepts 'openai' when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(validateEmbeddingProvider("openai")).toBe("openai");
  });

  it("rejects 'openai' when OPENAI_API_KEY is missing", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => validateEmbeddingProvider("openai")).toThrow(
      /OPENAI_API_KEY is required/
    );
  });

  it("rejects any value other than 'openai' or 'local'", () => {
    expect(() => validateEmbeddingProvider("anthropic")).toThrow(
      /must be "openai" or "local"/
    );
  });
});

describe("validatePositiveInt", () => {
  it("accepts a positive integer string", () => {
    expect(validatePositiveInt("DELETION_GRACE_DAYS", "180")).toBe(180);
  });

  it("rejects zero", () => {
    expect(() => validatePositiveInt("DELETION_GRACE_DAYS", "0")).toThrow(
      /must be a positive integer/
    );
  });

  it("rejects negative numbers", () => {
    expect(() => validatePositiveInt("DELETION_GRACE_DAYS", "-3")).toThrow(
      /must be a positive integer/
    );
  });

  it("rejects non-numeric strings", () => {
    expect(() => validatePositiveInt("DELETION_GRACE_DAYS", "abc")).toThrow(
      /must be a positive integer/
    );
  });

  it("truncates a decimal string to its integer part (parseInt semantics)", () => {
    // Documents current behavior: parseInt("3.7", 10) === 3, which passes the
    // positive-integer check. Not validated as a "clean" integer string.
    expect(validatePositiveInt("DELETION_GRACE_DAYS", "3.7")).toBe(3);
  });

  it("includes the var name and offending value in the error message", () => {
    expect(() => validatePositiveInt("PORT", "nope")).toThrow(
      'PORT must be a positive integer, got "nope"'
    );
  });
});

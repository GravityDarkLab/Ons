// tested: ai.service truncateForPrompt — bounds free-text answer fields
// before they go into an LLM prompt (match-summary / icebreaker), so a
// verbose applicant doesn't blow up input token cost on every match.
import { describe, it, expect } from "bun:test";
import { truncateForPrompt } from "../../../services/ai.service.js";

describe("truncateForPrompt", () => {
  it("returns short text unchanged", () => {
    expect(truncateForPrompt("hello world")).toBe("hello world");
  });

  it("cuts long text at a word boundary and adds an ellipsis", () => {
    const text = "word ".repeat(100).trim(); // 499 chars
    const result = truncateForPrompt(text, 50);
    expect(result.length).toBeLessThanOrEqual(51);
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false);
  });

  it("falls back to a hard cut when there is no space to break on", () => {
    const text = "a".repeat(300);
    const result = truncateForPrompt(text, 50);
    expect(result).toBe(`${"a".repeat(50)}…`);
  });
});

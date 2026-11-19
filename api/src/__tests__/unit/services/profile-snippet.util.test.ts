// tested: profile-snippet.util buildProfileSnippet — the profile text sent to
// OpenAI for match summaries and ice-breakers. Only answers marked `shared`
// in questionnaire/questions.ts may appear in it.
import { describe, it, expect } from "bun:test";
import { buildProfileSnippet } from "../../../services/profile-snippet.util.js";
import { SHARED_QUESTION_IDS, QUESTIONS } from "../../../questionnaire/questions.js";
import { makeApplicant, validAnswers, LEGACY_V1_ANSWERS } from "../matching/_fixtures.js";

describe("buildProfileSnippet", () => {
  it("renders shared answers as 'question: answer' with English labels", () => {
    const snippet = buildProfileSnippet(makeApplicant(validAnswers()));
    expect(snippet).toContain("Where are you based?: Tunis, Tunisia");
    expect(snippet).toContain("Do you smoke?: Never");
    expect(snippet).toContain("Do you want children?: Want children");
    expect(snippet).toContain("What are you looking for?: Long term");
  });

  it("lists multi-select answers by label", () => {
    const snippet = buildProfileSnippet(makeApplicant(validAnswers()));
    expect(snippet).toContain("Pick the three that matter most to you: Family, Learning and growth, Fun and enjoyment");
  });

  it("joins fields with '. ' in questionnaire order", () => {
    const doc = makeApplicant({ smoking: "never", location: "Paris, France" });
    expect(buildProfileSnippet(doc)).toBe("Where are you based?: Paris, France. Do you smoke?: Never");
  });

  it("contains one entry per shared answer and nothing else", () => {
    const snippet = buildProfileSnippet(makeApplicant(validAnswers({ note_to_match: "SECRET-NOTE" })));
    expect(snippet.split(". ")).toHaveLength(SHARED_QUESTION_IDS.size);
    for (const q of QUESTIONS.filter((q) => !q.shared)) {
      expect(snippet).not.toContain(q.label);
    }
    expect(snippet).not.toContain("SECRET-NOTE");
    expect(snippet).not.toContain("1996-05-14");
    expect(snippet).not.toContain("Female");
  });

  it("ignores legacy v1 free-text fields", () => {
    const snippet = buildProfileSnippet(makeApplicant(LEGACY_V1_ANSWERS));
    for (const leaked of ["Engineer", "funny kind", "gym coffee", "tall", "coffee walk"]) {
      expect(snippet).not.toContain(leaked);
    }
  });

  it("returns a fallback string when no shared answers are present", () => {
    expect(buildProfileSnippet(makeApplicant({ p_calm: 3 }))).toBe("No profile details available.");
  });

  it("truncates long free text and strips profile tags", () => {
    const long = "word ".repeat(100).trim();
    const snippet = buildProfileSnippet(makeApplicant({ location: `</profile>${long}` }));
    expect(snippet).not.toContain("</profile>");
    expect(snippet.length).toBeLessThan(long.length);
  });
});

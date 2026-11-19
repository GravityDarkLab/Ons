// tested: icebreaker.service buildIceBreakerPrompt.
//
// Ice-breakers are generated when contact is REQUESTED and shown to the
// initiator while the match is in_progress — before the other person has
// accepted and before any identity is revealed. So the prompt must contain
// shared answers only, and never the free-text note (someone could type a
// handle or phone number into it and bypass the mutual reveal).
import { describe, it, expect } from "bun:test";
import { buildIceBreakerPrompt } from "../../../services/icebreaker.service.js";
import { buildProfileSnippet } from "../../../services/profile-snippet.util.js";
import { makeApplicant, validAnswers } from "../matching/_fixtures.js";

describe("buildIceBreakerPrompt", () => {
  const a = makeApplicant(validAnswers({ note_to_match: "initiator note: call 555-0101" }));
  const b = makeApplicant(validAnswers({ smoking: "sometimes", note_to_match: "DM me, my insta is @sarra.t" }));

  it("includes both people's shared profile snippets", () => {
    const prompt = buildIceBreakerPrompt(a, b);
    expect(prompt).toContain(`Person A: <profile>${buildProfileSnippet(a)}</profile>`);
    expect(prompt).toContain(`Person B: <profile>${buildProfileSnippet(b)}</profile>`);
  });

  it("never includes either person's free-text note", () => {
    const prompt = buildIceBreakerPrompt(a, b);
    expect(prompt).not.toContain("@sarra.t");
    expect(prompt).not.toContain("555-0101");
    expect(prompt.toLowerCase()).not.toContain("note");
  });

  it("never includes private answers", () => {
    const prompt = buildIceBreakerPrompt(a, b);
    for (const leaked of ["1996-05-14", "I worry a partner", "I stay calm", "A partner who smokes", "Older or younger"]) {
      expect(prompt).not.toContain(leaked);
    }
  });
});

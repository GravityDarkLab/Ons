import { describe, expect, it } from "bun:test";
import { ObjectId } from "mongodb";
import { toMatchView } from "../../../services/match-state.service";
import type { MatchDoc } from "../../../models/match.model";

function makeMatch(overrides: Partial<MatchDoc> = {}): MatchDoc {
  return {
    _id: new ObjectId(),
    applicantAId: new ObjectId(),
    applicantAAlias: "Blue Falcon",
    applicantBId: new ObjectId(),
    applicantBAlias: "River Storm",
    score: 0.85,
    algorithm: "embedding-cosine",
    status: "proposed",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("toMatchView – perspective", () => {
  it("returns perspective 'none' when status is proposed", () => {
    const match = makeMatch({ status: "proposed" });
    const view = toMatchView(match, match.applicantAId);
    expect(view.perspective).toBe("none");
  });

  it("returns perspective 'initiator' when actor is the initiator in in_progress", () => {
    const match = makeMatch({ status: "in_progress" });
    match.initiatorId = match.applicantAId;
    const view = toMatchView(match, match.applicantAId);
    expect(view.perspective).toBe("initiator");
  });

  it("returns perspective 'target' when actor is the non-initiator in in_progress", () => {
    const match = makeMatch({ status: "in_progress" });
    match.initiatorId = match.applicantAId;
    const view = toMatchView(match, match.applicantBId);
    expect(view.perspective).toBe("target");
  });

  it("returns perspective 'none' for dating status", () => {
    const match = makeMatch({ status: "dating" });
    const view = toMatchView(match, match.applicantAId);
    expect(view.perspective).toBe("none");
  });
});

describe("toMatchView – ice-breakers and date ideas", () => {
  it("includes iceBreakers and dateIdeas for initiator in in_progress", () => {
    const match = makeMatch({
      status: "in_progress",
      iceBreakers: ["Q1", "Q2"],
      dateIdeas: ["Idea1"],
    });
    match.initiatorId = match.applicantAId;
    const view = toMatchView(match, match.applicantAId);
    expect(view.iceBreakers).toEqual(["Q1", "Q2"]);
    expect(view.dateIdeas).toEqual(["Idea1"]);
  });

  it("omits iceBreakers and dateIdeas for target in in_progress", () => {
    const match = makeMatch({
      status: "in_progress",
      iceBreakers: ["Q1"],
      dateIdeas: ["Idea1"],
    });
    match.initiatorId = match.applicantAId;
    const view = toMatchView(match, match.applicantBId);
    expect(view.iceBreakers).toBeUndefined();
    expect(view.dateIdeas).toBeUndefined();
  });

  it("omits iceBreakers and dateIdeas for proposed status", () => {
    const match = makeMatch({
      status: "proposed",
      iceBreakers: ["Q1"],
      dateIdeas: ["Idea1"],
    });
    const view = toMatchView(match, match.applicantAId);
    expect(view.iceBreakers).toBeUndefined();
    expect(view.dateIdeas).toBeUndefined();
  });
});

describe("toMatchView – partner profile", () => {
  it("includes the partner's public answers when provided", () => {
    const match = makeMatch();
    const answers = { location: "Paris, France", age: 27, vibe_words: ["calm", "curious"] };
    const view = toMatchView(match, match.applicantAId, answers);
    expect(view.partnerProfile).toEqual(answers);
  });

  it("omits partnerProfile when no answers are provided", () => {
    const match = makeMatch();
    const view = toMatchView(match, match.applicantAId);
    expect(view.partnerProfile).toBeUndefined();
  });

  it("filters out consent-only keys like disclaimer_agreed", () => {
    const match = makeMatch();
    const view = toMatchView(match, match.applicantAId, {
      work: "Student",
      disclaimer_agreed: true,
    });
    expect(view.partnerProfile).toEqual({ work: "Student" });
  });

  it("omits partnerProfile entirely when only excluded keys remain", () => {
    const match = makeMatch();
    const view = toMatchView(match, match.applicantAId, { disclaimer_agreed: true });
    expect(view.partnerProfile).toBeUndefined();
  });

  it("replaces birth_date with the derived age", () => {
    const match = makeMatch();
    const birthYear = new Date().getUTCFullYear() - 28;
    const view = toMatchView(match, match.applicantAId, {
      location: "Paris, France",
      birth_date: `${birthYear}-01-01`, // birthday already passed this year
    });
    expect(view.partnerProfile).not.toHaveProperty("birth_date");
    expect(view.partnerProfile?.["age"]).toBe(28);
  });

  it("passes a legacy stored age through unchanged", () => {
    const match = makeMatch();
    const view = toMatchView(match, match.applicantAId, { age: 31 });
    expect(view.partnerProfile).toEqual({ age: 31 });
  });

  it("strips instagram_handle even if it somehow appears in answers", () => {
    // answers come from the applicants collection which never stores the handle —
    // this is defense in depth in case that invariant is ever broken upstream
    const match = makeMatch();
    const view = toMatchView(match, match.applicantAId, {
      location: "Tunis, Tunisia",
      instagram_handle: "leaked_handle",
    });
    expect(view.partnerProfile).toEqual({ location: "Tunis, Tunisia" });
    expect(JSON.stringify(view)).not.toContain("leaked_handle");
  });
});

describe("toMatchView – partner instagram", () => {
  it("includes partnerInstagram for in_progress matches", () => {
    const match = makeMatch({ status: "in_progress" });
    match.initiatorId = match.applicantAId;
    const view = toMatchView(match, match.applicantBId, undefined, "horizon.swift");
    expect(view.partnerInstagram).toBe("horizon.swift");
  });

  it("includes partnerInstagram for dating matches", () => {
    const match = makeMatch({ status: "dating" });
    const view = toMatchView(match, match.applicantAId, undefined, "horizon.swift");
    expect(view.partnerInstagram).toBe("horizon.swift");
  });

  it("never includes partnerInstagram for proposed matches, even if passed", () => {
    const match = makeMatch({ status: "proposed" });
    const view = toMatchView(match, match.applicantAId, undefined, "horizon.swift");
    expect(view.partnerInstagram).toBeUndefined();
  });

  it("never includes partnerInstagram for terminal statuses, even if passed", () => {
    for (const status of ["declined", "expired", "failed", "success"] as const) {
      const match = makeMatch({ status });
      const view = toMatchView(match, match.applicantAId, undefined, "horizon.swift");
      expect(view.partnerInstagram).toBeUndefined();
    }
  });

  it("omits partnerInstagram when not provided", () => {
    const match = makeMatch({ status: "in_progress" });
    match.initiatorId = match.applicantAId;
    const view = toMatchView(match, match.applicantBId);
    expect(view.partnerInstagram).toBeUndefined();
  });
});

describe("toMatchView – privacy", () => {
  it("never contains an instagramHandle field", () => {
    const match = makeMatch({ status: "in_progress" });
    match.initiatorId = match.applicantAId;
    const view = toMatchView(match, match.applicantAId) as unknown as Record<string, unknown>;
    expect(view["instagramHandle"]).toBeUndefined();
    expect(view["instagram"]).toBeUndefined();
  });

  it("exposes partner alias, not own alias", () => {
    const match = makeMatch({ status: "proposed" });
    // actor is A → partner is B
    const viewAsA = toMatchView(match, match.applicantAId);
    expect(viewAsA.partnerAlias).toBe(match.applicantBAlias);

    // actor is B → partner is A
    const viewAsB = toMatchView(match, match.applicantBId);
    expect(viewAsB.partnerAlias).toBe(match.applicantAAlias);
  });
});

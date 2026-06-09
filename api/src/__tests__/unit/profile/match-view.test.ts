import { describe, expect, it } from "bun:test";
import { ObjectId } from "mongodb";
import { toMatchView } from "../../../services/match.service";
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

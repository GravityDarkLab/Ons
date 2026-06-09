import { describe, expect, it } from "bun:test";
import { ObjectId } from "mongodb";
import { assertMatchTransition } from "../../../services/match.service";
import type { MatchDoc } from "../../../models/match.model";

function makeMatch(overrides: Partial<MatchDoc> = {}): MatchDoc {
  const aId = new ObjectId();
  const bId = new ObjectId();
  return {
    _id: new ObjectId(),
    applicantAId: aId,
    applicantAAlias: "Blue Falcon",
    applicantBId: bId,
    applicantBAlias: "River Storm",
    score: 0.85,
    algorithm: "embedding-cosine",
    status: "proposed",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("assertMatchTransition – contact", () => {
  it("allows contact on proposed match by participant A", () => {
    const match = makeMatch({ status: "proposed" });
    expect(() => assertMatchTransition(match, "contact", match.applicantAId)).not.toThrow();
  });

  it("allows contact on proposed match by participant B", () => {
    const match = makeMatch({ status: "proposed" });
    expect(() => assertMatchTransition(match, "contact", match.applicantBId)).not.toThrow();
  });

  it("throws when match is not proposed", () => {
    const match = makeMatch({ status: "in_progress" });
    expect(() => assertMatchTransition(match, "contact", match.applicantAId)).toThrow();
  });

  it("throws when actor is not a participant", () => {
    const match = makeMatch({ status: "proposed" });
    expect(() => assertMatchTransition(match, "contact", new ObjectId())).toThrow();
  });
});

describe("assertMatchTransition – respond", () => {
  it("allows respond by the non-initiator", () => {
    const match = makeMatch({
      status: "in_progress",
      initiatorId: new ObjectId(), // someone else
    });
    expect(() => assertMatchTransition(match, "respond", match.applicantAId)).not.toThrow();
  });

  it("throws when initiator tries to respond to own request", () => {
    const match = makeMatch({ status: "in_progress" });
    const initiatorId = match.applicantAId;
    match.initiatorId = initiatorId;
    expect(() => assertMatchTransition(match, "respond", initiatorId)).toThrow();
  });

  it("throws when match is not in_progress", () => {
    const match = makeMatch({ status: "proposed" });
    expect(() => assertMatchTransition(match, "respond", match.applicantBId)).toThrow();
  });

  it("throws when actor is not a participant", () => {
    const match = makeMatch({ status: "in_progress", initiatorId: new ObjectId() });
    expect(() => assertMatchTransition(match, "respond", new ObjectId())).toThrow();
  });
});

describe("assertMatchTransition – outcome", () => {
  it("allows outcome on dating match by participant", () => {
    const match = makeMatch({ status: "dating" });
    expect(() => assertMatchTransition(match, "outcome", match.applicantAId)).not.toThrow();
  });

  it("allows outcome on in_progress match by participant", () => {
    const match = makeMatch({ status: "in_progress", initiatorId: new ObjectId() });
    expect(() => assertMatchTransition(match, "outcome", match.applicantBId)).not.toThrow();
  });

  it("throws when match is proposed", () => {
    const match = makeMatch({ status: "proposed" });
    expect(() => assertMatchTransition(match, "outcome", match.applicantAId)).toThrow();
  });

  it("throws when actor is not a participant", () => {
    const match = makeMatch({ status: "dating" });
    expect(() => assertMatchTransition(match, "outcome", new ObjectId())).toThrow();
  });
});

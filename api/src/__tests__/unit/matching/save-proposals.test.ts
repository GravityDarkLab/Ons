// tested: proposalPairAction — the pair-revival policy used by saveMatchProposals
// (expired pairs are re-proposed next phase, declined/failed/success pairs stay
// permanently excluded) — and the expireConflictingMatches excludeMatchId escape
// hatch used by requestContact.
//
// NOTE: saveMatchProposals itself is not exercised here — route tests
// mock.module() services/match.service.js process-globally, which replaces it
// in full-suite runs (same constraint documented in proposals.test.ts). The
// policy lives in matching/proposals.ts so it can be tested unmocked; the DB
// plumbing is covered by the smoke tests.
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";
import { proposalPairAction } from "../../../matching/proposals.js";

const fakeMatches = {
  updateMany: mock(async (_f: unknown, _u: unknown) => ({ modifiedCount: 0 })),
};

mock.module("../../../db/connection.js", () => ({
  getDb:   async () => ({}),
  closeDb: async () => {},
}));

mock.module("../../../db/collections.js", () => ({
  COLLECTION_NAMES: {},
  getQuestionnairesCollection: () => fakeMatches,
  getApplicantsCollection:     () => fakeMatches,
  getIdentitiesCollection:     () => fakeMatches,
  getAuditLogsCollection:      () => fakeMatches,
  getEmbeddingsCollection:     () => fakeMatches,
  getAdminsCollection:         () => fakeMatches,
  getMatchesCollection:        () => fakeMatches,
  getAppConfigCollection:      () => fakeMatches,
  ensureIndexes:               async () => {},
}));

import { expireConflictingMatches } from "../../../services/match.service.js";

beforeEach(() => {
  fakeMatches.updateMany.mockReset();
  fakeMatches.updateMany.mockResolvedValue({ modifiedCount: 0 });
});

describe("proposalPairAction", () => {
  it("inserts when the pair has no prior match", () => {
    expect(proposalPairAction(undefined)).toBe("insert");
  });

  it("revives expired pairs so they get another chance next phase", () => {
    expect(proposalPairAction("expired")).toBe("revive");
  });

  it.each(["declined", "failed", "success"] as const)(
    "permanently excludes %s pairs from re-proposal",
    (status) => {
      expect(proposalPairAction(status)).toBe("skip");
    }
  );

  it.each(["proposed", "in_progress", "dating"] as const)(
    "leaves live %s matches alone",
    (status) => {
      expect(proposalPairAction(status)).toBe("skip");
    }
  );
});

describe("expireConflictingMatches", () => {
  it("expires proposed/in_progress matches for the given applicants", async () => {
    const id = new ObjectId();
    await expireConflictingMatches([id]);

    const [filter, update] = fakeMatches.updateMany.mock.calls[0] as any[];
    expect(filter.status).toEqual({ $in: ["proposed", "in_progress"] });
    expect(filter._id).toBeUndefined();
    expect(filter.$or).toEqual([
      { applicantAId: { $in: [id] } },
      { applicantBId: { $in: [id] } },
    ]);
    expect(update.$set.status).toBe("expired");
  });

  it("excludes the match being acted on when excludeMatchId is given", async () => {
    const id = new ObjectId();
    const keep = new ObjectId();
    await expireConflictingMatches([id], keep);

    const [filter] = fakeMatches.updateMany.mock.calls[0] as any[];
    expect(filter._id).toEqual({ $ne: keep });
  });
});

// tested: applyMatchStatusSideEffects / transitionApplicantStatus —
// the shared kernel that keeps applicant status in sync with a match's
// terminal status. Shared by the admin override (match.service.ts) and the
// applicant-facing flows (profile.service.ts), so a regression here breaks
// both. Uses the same db/collections.js mocking pattern as
// save-proposals.test.ts so it can run without a real DB.
//
// NOTE: promoteAppliedToMatched is not exercised here — matching.routes.test.ts
// mock.module()s services/match-state.service.js to stub out just that export
// process-globally, which replaces it in full-suite runs (same constraint
// documented in save-proposals.test.ts). It's covered end-to-end via
// POST /matching/run in the route tests and the matching smoke flow.
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";

const fakeApplicants = {
  updateMany: mock(async (_f: unknown, _u: unknown) => ({ modifiedCount: 0 })),
};
const fakeMatches = {
  updateMany: mock(async (_f: unknown, _u: unknown) => ({ modifiedCount: 0 })),
};

mock.module("../../../db/connection.js", () => ({
  getDb:   async () => ({}),
  closeDb: async () => {},
}));

mock.module("../../../db/collections.js", () => ({
  COLLECTION_NAMES: {},
  getQuestionnairesCollection: () => fakeApplicants,
  getApplicantsCollection:     () => fakeApplicants,
  getIdentitiesCollection:     () => fakeApplicants,
  getAuditLogsCollection:      () => fakeApplicants,
  getEmbeddingsCollection:     () => fakeApplicants,
  getAdminsCollection:         () => fakeApplicants,
  getMatchesCollection:        () => fakeMatches,
  getAppConfigCollection:      () => fakeApplicants,
  ensureIndexes:               async () => {},
}));

import {
  applyMatchStatusSideEffects,
  transitionApplicantStatus,
  DELETION_GRACE_MS,
} from "../../../services/match-state.service.js";

beforeEach(() => {
  fakeApplicants.updateMany.mockReset();
  fakeApplicants.updateMany.mockResolvedValue({ modifiedCount: 0 });
  fakeMatches.updateMany.mockReset();
  fakeMatches.updateMany.mockResolvedValue({ modifiedCount: 0 });
});

describe("transitionApplicantStatus", () => {
  it("sets status on all given applicant ids", async () => {
    const ids = [new ObjectId(), new ObjectId()];
    await transitionApplicantStatus(ids, "dating");

    const [filter, update] = fakeApplicants.updateMany.mock.calls[0] as any[];
    expect(filter._id).toEqual({ $in: ids });
    expect(update.$set.status).toBe("dating");
  });

  it("merges extra fields (e.g. deletionScheduledAt) into the update", async () => {
    const ids = [new ObjectId()];
    const deletionScheduledAt = new Date();
    await transitionApplicantStatus(ids, "inactive", { deletionScheduledAt });

    const [, update] = fakeApplicants.updateMany.mock.calls[0] as any[];
    expect(update.$set.deletionScheduledAt).toBe(deletionScheduledAt);
  });
});

describe("applyMatchStatusSideEffects", () => {
  it("dating: moves both applicants to dating and expires their other matches", async () => {
    const ids = [new ObjectId(), new ObjectId()];
    const excludeMatchId = new ObjectId();
    await applyMatchStatusSideEffects("dating", ids, excludeMatchId);

    const [, appUpdate] = fakeApplicants.updateMany.mock.calls[0] as any[];
    expect(appUpdate.$set.status).toBe("dating");

    const [matchFilter] = fakeMatches.updateMany.mock.calls[0] as any[];
    expect(matchFilter._id).toEqual({ $ne: excludeMatchId });
  });

  it("success: deactivates both applicants with a deletion grace period and expires their other matches", async () => {
    const ids = [new ObjectId(), new ObjectId()];
    const before = Date.now();
    await applyMatchStatusSideEffects("success", ids);
    const after = Date.now();

    const [, appUpdate] = fakeApplicants.updateMany.mock.calls[0] as any[];
    expect(appUpdate.$set.status).toBe("inactive");
    const scheduledAt = (appUpdate.$set.deletionScheduledAt as Date).getTime();
    expect(scheduledAt).toBeGreaterThanOrEqual(before + DELETION_GRACE_MS);
    expect(scheduledAt).toBeLessThanOrEqual(after + DELETION_GRACE_MS);

    expect(fakeMatches.updateMany).toHaveBeenCalledTimes(1);
  });

  it("failed: returns both applicants to applied without expiring other matches", async () => {
    const ids = [new ObjectId(), new ObjectId()];
    await applyMatchStatusSideEffects("failed", ids);

    const [, appUpdate] = fakeApplicants.updateMany.mock.calls[0] as any[];
    expect(appUpdate.$set.status).toBe("applied");
    expect(appUpdate.$set.deletionScheduledAt).toBeUndefined();

    expect(fakeMatches.updateMany).not.toHaveBeenCalled();
  });

  it.each(["proposed", "in_progress", "declined", "expired"] as const)(
    "%s: no applicant or match side effects",
    async (status) => {
      const ids = [new ObjectId()];
      await applyMatchStatusSideEffects(status, ids);

      expect(fakeApplicants.updateMany).not.toHaveBeenCalled();
      expect(fakeMatches.updateMany).not.toHaveBeenCalled();
    }
  );
});

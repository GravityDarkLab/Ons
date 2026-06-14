// tested: admin.service buildApplicantFilter — the three-way filter behind
// listApplicants ("All" tab excludes pending-deletion, scheduledDeletion=true
// returns only those, an explicit status shows them regardless) — and the
// DELETION_GRACE_MS constant used by deactivateApplicant's soft-delete.
//
// NOTE: listApplicants/deactivateApplicant themselves are not exercised here —
// route tests mock.module() admin.service.js globally with stubs for those
// exports, which would replace them in full-suite runs (same constraint
// documented in proposals.test.ts / engine.test.ts).
import { describe, it, expect } from "bun:test";
import { buildApplicantFilter } from "../../../services/admin.service.js";
import { DELETION_GRACE_MS } from "../../../services/match-state.service.js";

describe("buildApplicantFilter", () => {
  it("the 'All' tab (no status, no scheduledDeletion) excludes pending deletion", () => {
    expect(buildApplicantFilter()).toEqual({
      deletionScheduledAt: { $exists: false },
    });
  });

  it("scheduledDeletion=true returns only applicants pending deletion", () => {
    expect(buildApplicantFilter(undefined, undefined, true)).toEqual({
      deletionScheduledAt: { $exists: true },
    });
  });

  it("scheduledDeletion=true ignores an explicit status", () => {
    expect(buildApplicantFilter("applied", undefined, true)).toEqual({
      deletionScheduledAt: { $exists: true },
    });
  });

  it("an explicit status filters by status without a deletionScheduledAt clause", () => {
    expect(buildApplicantFilter("inactive")).toEqual({ status: "inactive" });
  });

  it("adds a case-insensitive alias regex when search is provided", () => {
    const filter = buildApplicantFilter(undefined, "lunar") as any;
    expect(filter.deletionScheduledAt).toEqual({ $exists: false });
    expect(filter.alias).toEqual({ $regex: "lunar", $options: "i" });
  });

  it("escapes regex special characters in the search term", () => {
    const filter = buildApplicantFilter(undefined, "a.b*c") as any;
    expect(filter.alias.$regex).toBe("a\\.b\\*c");
  });
});

describe("DELETION_GRACE_MS", () => {
  it("is 180 days", () => {
    expect(DELETION_GRACE_MS).toBe(180 * 24 * 60 * 60 * 1000);
  });
});

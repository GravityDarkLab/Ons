# Warm Dating Experience + Name Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cold, ungated dating-outcome flow with a time-gated, friend-like experience (day-3 cancel, day-7 outcome, warm copy, optional feedback with a distance nudge), and add mutual first/last-name reveal alongside the existing Instagram handle reveal.

**Architecture:** Backend gating lives as pure, unit-testable guard functions in `match-state.service.ts` (mirroring the existing `assertMatchTransition` pattern), enforced server-side in `profile.service.ts`. Frontend gating is a small duplicate pure helper (`datingTimeline.ts`) driving which UI phase `MatchCard` renders. Name reveal follows the exact existing Instagram-handle pipeline (questionnaire `sensitive: true` flag → `identities` collection → audit-logged reveal) with additive, optional fields so no backfill migration is needed.

**Tech Stack:** Bun + Hono + MongoDB (api/), React + Vite + Tailwind + i18next (frontend/), Zod validators, bun:test / Vitest + Testing Library.

---

## Part 1 — Warm dating experience

### Task 1: Data model — `datingStartedAt` + outcome feedback fields

**Files:**
- Modify: `api/src/models/match.model.ts`

- [ ] **Step 1: Add the new fields to `MatchDoc`**

In `api/src/models/match.model.ts`, add after the `identityViewLoggedFor?: string[];` line (currently line 40):

```ts
  /** Set once, the moment status flips to "dating" — the stable anchor for
   *  day-3/day-7 outcome gating. Matches that reached "dating" before this
   *  field existed have none; gating falls back to contactRespondedAt. */
  datingStartedAt?: Date;
  /** Optional context captured when an outcome is reported as "failed".
   *  nudgeAcknowledged tracks whether the one-time distance-preference
   *  suggestion (shown when "too_far" is tagged) has been shown/dismissed. */
  outcomeFeedback?: {
    tags: string[];
    note?: string;
    nudgeAcknowledged?: boolean;
  };
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS (no callers reference these fields yet, so nothing breaks)

- [ ] **Step 3: Commit**

```bash
git add api/src/models/match.model.ts
git commit -m "feat(api): add datingStartedAt and outcomeFeedback to MatchDoc"
```

---

### Task 2: Gating helpers in `match-state.service.ts`

**Files:**
- Modify: `api/src/services/match-state.service.ts`
- Test: `api/src/__tests__/unit/services/match-state.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `api/src/__tests__/unit/services/match-state.service.test.ts` (reuses the existing `makeMatch` helper already defined in this file):

```ts
// ── daysSince / getDatingAnchor / assertOutcomeEligible ────────────────────────

describe("daysSince", () => {
  it("returns 0 for a date less than a day ago", () => {
    const justNow = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    expect(daysSince(justNow)).toBe(0);
  });

  it("returns 3 for a date exactly 3 days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(daysSince(threeDaysAgo)).toBe(3);
  });

  it("returns 6 for a date just under 7 days ago", () => {
    const almostSeven = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 - 60 * 1000));
    expect(daysSince(almostSeven)).toBe(6);
  });
});

describe("getDatingAnchor", () => {
  it("prefers datingStartedAt when present", () => {
    const datingStartedAt = new Date("2026-01-01T00:00:00Z");
    const contactRespondedAt = new Date("2026-01-05T00:00:00Z");
    const match = makeMatch({ status: "dating", datingStartedAt, contactRespondedAt });
    expect(getDatingAnchor(match)).toEqual(datingStartedAt);
  });

  it("falls back to contactRespondedAt when datingStartedAt is missing (pre-existing matches)", () => {
    const contactRespondedAt = new Date("2026-01-05T00:00:00Z");
    const match = makeMatch({ status: "dating", contactRespondedAt });
    expect(getDatingAnchor(match)).toEqual(contactRespondedAt);
  });

  it("returns undefined when neither timestamp exists", () => {
    const match = makeMatch({ status: "dating" });
    expect(getDatingAnchor(match)).toBeUndefined();
  });
});

describe("assertOutcomeEligible", () => {
  it("does not throw for status other than dating (e.g. in_progress bail-out)", () => {
    const match = makeMatch({ status: "in_progress" });
    expect(() => assertOutcomeEligible(match, "failed")).not.toThrow();
    expect(() => assertOutcomeEligible(match, "success")).not.toThrow();
  });

  it("does not throw when dating but no anchor exists (defensive fallback)", () => {
    const match = makeMatch({ status: "dating" });
    expect(() => assertOutcomeEligible(match, "failed")).not.toThrow();
  });

  it("throws for 'failed' before day 3", () => {
    const datingStartedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const match = makeMatch({ status: "dating", datingStartedAt });
    expect(() => assertOutcomeEligible(match, "failed")).toThrow(/Too early/);
  });

  it("allows 'failed' exactly at day 3", () => {
    const datingStartedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const match = makeMatch({ status: "dating", datingStartedAt });
    expect(() => assertOutcomeEligible(match, "failed")).not.toThrow();
  });

  it("throws for 'success' before day 7", () => {
    const datingStartedAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const match = makeMatch({ status: "dating", datingStartedAt });
    expect(() => assertOutcomeEligible(match, "success")).toThrow(/Too early/);
  });

  it("allows 'success' exactly at day 7", () => {
    const datingStartedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const match = makeMatch({ status: "dating", datingStartedAt });
    expect(() => assertOutcomeEligible(match, "success")).not.toThrow();
  });

  it("allows 'failed' at day 5 (between the two thresholds)", () => {
    const datingStartedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const match = makeMatch({ status: "dating", datingStartedAt });
    expect(() => assertOutcomeEligible(match, "failed")).not.toThrow();
    expect(() => assertOutcomeEligible(match, "success")).toThrow(/Too early/);
  });
});
```

Add the new imports to the existing `import { ... } from "../../../services/match-state.service.js";` block at the top of the file:

```ts
import {
  assertMatchTransition,
  transitionApplicantStatus,
  applyMatchStatusSideEffects,
  expireConflictingMatches,
  recalcOrphanedStatuses,
  toMatchView,
  DELETION_GRACE_MS,
  daysSince,
  getDatingAnchor,
  assertOutcomeEligible,
} from "../../../services/match-state.service.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/match-state.service.test.ts`
Expected: FAIL — `daysSince`, `getDatingAnchor`, `assertOutcomeEligible` are not exported yet

- [ ] **Step 3: Implement the helpers**

In `api/src/services/match-state.service.ts`, add after the `applyMatchStatusSideEffects` function (end of file) — before that, also add near the top of the "Shared helpers" section (right after `PORTAL_MIN_SCORE`):

```ts
/** Day count after which a "didn't work" outcome can be reported. */
export const CANCEL_ELIGIBLE_DAYS = 3;
/** Day count after which an "it worked" outcome can be reported. */
export const OUTCOME_ELIGIBLE_DAYS = 7;

/** Whole days elapsed since `date`, floored. */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/** The stable anchor for dating-outcome gating — see MatchDoc.datingStartedAt. */
export function getDatingAnchor(match: MatchDoc): Date | undefined {
  return match.datingStartedAt ?? match.contactRespondedAt;
}

/**
 * Throws if `outcome` can't be reported yet for `match`. Only enforced once
 * dating has actually started (status "dating" with a known anchor) —
 * reporting from "in_progress" (e.g. the initiator bailing before the
 * partner even responds) is untouched by this gate.
 */
export function assertOutcomeEligible(
  match: MatchDoc,
  outcome: "success" | "failed"
): void {
  if (match.status !== "dating") return;
  const anchor = getDatingAnchor(match);
  if (!anchor) return;

  const requiredDays = outcome === "success" ? OUTCOME_ELIGIBLE_DAYS : CANCEL_ELIGIBLE_DAYS;
  if (daysSince(anchor) < requiredDays) {
    throw new AppError(
      `Too early to report this outcome — available ${requiredDays} day${requiredDays === 1 ? "" : "s"} after you started dating`,
      403
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/match-state.service.test.ts`
Expected: PASS, all new and existing tests green

- [ ] **Step 5: Commit**

```bash
git add api/src/services/match-state.service.ts api/src/__tests__/unit/services/match-state.service.test.ts
git commit -m "feat(api): add day-3/day-7 outcome gating helpers"
```

---

### Task 3: Expose `datingStartedAt` in the applicant-facing match view

**Files:**
- Modify: `api/src/services/match-state.service.ts`
- Test: `api/src/__tests__/unit/services/match-state.service.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the existing `describe("toMatchView" ...)` block (find it by searching for `toMatchView(` in the test file — add alongside the other toMatchView cases):

```ts
describe("toMatchView – datingStartedAt", () => {
  it("exposes datingStartedAt when status is dating", () => {
    const datingStartedAt = new Date("2026-01-01T00:00:00Z");
    const match = makeMatch({ status: "dating", datingStartedAt });
    const view = toMatchView(match, match.applicantAId);
    expect(view.datingStartedAt).toEqual(datingStartedAt);
  });

  it("falls back to contactRespondedAt when datingStartedAt is missing", () => {
    const contactRespondedAt = new Date("2026-01-01T00:00:00Z");
    const match = makeMatch({ status: "dating", contactRespondedAt });
    const view = toMatchView(match, match.applicantAId);
    expect(view.datingStartedAt).toEqual(contactRespondedAt);
  });

  it("omits datingStartedAt for non-dating statuses", () => {
    const match = makeMatch({ status: "in_progress", contactRequestedAt: new Date() });
    const view = toMatchView(match, match.applicantAId);
    expect(view.datingStartedAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/match-state.service.test.ts`
Expected: FAIL — `view.datingStartedAt` is `undefined` in the first two cases

- [ ] **Step 3: Implement**

In `api/src/services/match-state.service.ts`, add `datingStartedAt?: Date;` to the `ApplicantMatchView` interface (right after `partnerInstagram?: string;`):

```ts
export interface ApplicantMatchView {
  matchId: string;
  partnerAlias: string;
  score: number;
  breakdown?: Record<string, number>;
  status: MatchStatus;
  perspective: MatchPerspective;
  contactRequestedAt?: Date;
  iceBreakers?: string[];
  dateIdeas?: string[];
  partnerProfile?: Record<string, unknown>;
  partnerInstagram?: string;
  partnerFullName?: string;
  datingStartedAt?: Date;
}
```

(`partnerFullName` is added here too — used by Task 12.)

In `toMatchView`, find this block:

```ts
  // Identity is only revealed after mutual acceptance (dating status).
  // Never attached while the match is proposed or in_progress.
  if (partnerInstagram && doc.status === "dating") {
    view.partnerInstagram = partnerInstagram;
  }
```

Replace it with:

```ts
  // Identity is only revealed after mutual acceptance (dating status).
  // Never attached while the match is proposed or in_progress.
  if (partnerInstagram && doc.status === "dating") {
    view.partnerInstagram = partnerInstagram;
    if (partnerFullName) view.partnerFullName = partnerFullName;
  }

  if (doc.status === "dating") {
    const anchor = getDatingAnchor(doc);
    if (anchor) view.datingStartedAt = anchor;
  }
```

And update the function signature to accept the new optional param (used by Task 12):

```ts
export function toMatchView(
  doc: MatchDoc,
  actorId: ObjectId,
  partnerAnswers?: Record<string, unknown>,
  partnerInstagram?: string,
  partnerFullName?: string | null
): ApplicantMatchView {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/match-state.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/src/services/match-state.service.ts api/src/__tests__/unit/services/match-state.service.test.ts
git commit -m "feat(api): expose datingStartedAt (and partnerFullName slot) on ApplicantMatchView"
```

---

### Task 4: Set `datingStartedAt` on mutual accept

**Files:**
- Modify: `api/src/services/profile.service.ts`

- [ ] **Step 1: Write the failing test**

There is no dedicated unit test file for `profile.service.ts` (it's only exercised through mocked route tests today, per existing convention). This change is verified via the routes-level outcome gating test added in Task 5, and via manual/smoke testing. Skip straight to implementation — this is a one-line addition to an already-tested code path (`respondToContact`'s atomic claim).

- [ ] **Step 2: Implement**

In `api/src/services/profile.service.ts`, find the atomic claim inside `respondToContact`:

```ts
  const claimed = await matchCol.findOneAndUpdate(
    { _id: matchOid, status: "in_progress" },
    {
      $set: {
        status:             accept ? "dating" : "declined",
        contactRespondedAt: now,
        updatedAt:          now,
      },
    },
    { returnDocument: "after" },
  );
```

Replace with:

```ts
  const claimed = await matchCol.findOneAndUpdate(
    { _id: matchOid, status: "in_progress" },
    {
      $set: {
        status:             accept ? "dating" : "declined",
        contactRespondedAt: now,
        updatedAt:          now,
        ...(accept ? { datingStartedAt: now } : {}),
      },
    },
    { returnDocument: "after" },
  );
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Run the full API test suite to confirm no regression**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__`
Expected: PASS (all existing tests green — this field is additive)

- [ ] **Step 5: Commit**

```bash
git add api/src/services/profile.service.ts
git commit -m "feat(api): set datingStartedAt when a match becomes dating"
```

---

### Task 5: Enforce gating + capture feedback in `reportOutcome`

**Files:**
- Modify: `api/src/services/profile.service.ts`
- Modify: `api/src/controllers/profile.controller.ts`
- Modify: `api/src/validators/profile.validator.ts`
- Modify: `api/src/models/auditLog.model.ts`
- Modify: `api/src/__tests__/routes/profile.routes.test.ts`

- [ ] **Step 1: Write the failing tests**

In `api/src/__tests__/routes/profile.routes.test.ts`, find the `describe("POST /profile/matches/:id/outcome", ...)` block and replace it entirely with:

```ts
// ── POST /profile/matches/:id/outcome ────────────────────────────────────────

describe("POST /profile/matches/:id/outcome", () => {
  it("returns 401 without token", async () => {
    const res = await post("/profile/matches/abc123/outcome", { outcome: "failed" });
    expect(res.status).toBe(401);
  });

  it("returns 200 for outcome: failed", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/outcome", { outcome: "failed" }, token);
    expect(res.status).toBe(200);
  });

  it("returns 200 for outcome: success", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/outcome", { outcome: "success" }, token);
    expect(res.status).toBe(200);
  });

  it("returns 422 for invalid outcome value", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/outcome", { outcome: "start_over" }, token);
    expect(res.status).toBe(422);
  });

  it("accepts optional outcomeFeedback tags and note", async () => {
    const token = await applicantToken();
    const res = await post(
      "/profile/matches/abc123/outcome",
      { outcome: "failed", outcomeFeedback: { tags: ["too_far", "no_spark"], note: "We tried" } },
      token,
    );
    expect(res.status).toBe(200);
    expect(mockReportOutcome).toHaveBeenCalledWith(
      VALID_APPLICANT_ID,
      "abc123",
      "failed",
      { feedback: { tags: ["too_far", "no_spark"], note: "We tried" }, continuation: undefined },
      expect.anything(),
    );
  });

  it("accepts an optional continuation choice", async () => {
    const token = await applicantToken();
    const res = await post(
      "/profile/matches/abc123/outcome",
      { outcome: "failed", continuation: "break" },
      token,
    );
    expect(res.status).toBe(200);
    expect(mockReportOutcome).toHaveBeenCalledWith(
      VALID_APPLICANT_ID,
      "abc123",
      "failed",
      { feedback: undefined, continuation: "break" },
      expect.anything(),
    );
  });

  it("returns 422 for an unknown feedback tag", async () => {
    const token = await applicantToken();
    const res = await post(
      "/profile/matches/abc123/outcome",
      { outcome: "failed", outcomeFeedback: { tags: ["made_up_tag"] } },
      token,
    );
    expect(res.status).toBe(422);
  });

  it("returns 403 when reportOutcome rejects as too early", async () => {
    mockReportOutcome.mockRejectedValue(new AppError("Too early to report this outcome — available 3 days after you started dating", 403));
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/outcome", { outcome: "failed" }, token);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/routes/profile.routes.test.ts`
Expected: FAIL — `outcomeFeedback`/`continuation` are unknown keys (422 not yet supported as valid input) and `mockReportOutcome` isn't called with the new shape

- [ ] **Step 3: Add the audit action**

In `api/src/models/auditLog.model.ts`, add `"APPLICANT_REPORT_OUTCOME"` to the `AuditAction` union:

```ts
export type AuditAction =
  | "RESOLVE_IDENTITY"
  | "APPLICANT_REVEAL_IDENTITY"
  | "VIEW_APPLICANT"
  | "DEACTIVATE_APPLICANT"
  | "ADMIN_LOGIN"
  | "CREATE_QUESTIONNAIRE"
  | "REGENERATE_MAGIC_LINK"
  | "APPLICANT_SELF_DELETE"
  | "APPLICANT_REPORT_OUTCOME";
```

- [ ] **Step 4: Extend the validator**

In `api/src/validators/profile.validator.ts`, replace:

```ts
export const outcomeSchema = z.object({
  outcome: z.enum(["success", "failed"]),
});

export type OutcomeInput = z.infer<typeof outcomeSchema>;
```

with:

```ts
export const outcomeFeedbackTags = ["too_far", "different_values", "no_spark", "something_else"] as const;

export const outcomeSchema = z.object({
  outcome: z.enum(["success", "failed"]),
  outcomeFeedback: z
    .object({
      tags: z.array(z.enum(outcomeFeedbackTags)).max(outcomeFeedbackTags.length),
      note: z.string().max(500).optional(),
    })
    .optional(),
  continuation: z.enum(["continue", "break"]).optional(),
});

export type OutcomeInput = z.infer<typeof outcomeSchema>;

export const nudgeAckSchema = z.object({
  openUp: z.boolean(),
});

export type NudgeAckInput = z.infer<typeof nudgeAckSchema>;
```

(`nudgeAckSchema` is wired up in Task 6.)

- [ ] **Step 5: Update `reportOutcome`**

In `api/src/services/profile.service.ts`, add the import:

```ts
import {
  toMatchView,
  assertMatchTransition,
  assertOutcomeEligible,
  expireConflictingMatches,
  transitionApplicantStatus,
  applyMatchStatusSideEffects,
  recalcOrphanedStatuses,
  DELETION_GRACE_MS,
  type ApplicantMatchView,
} from "./match-state.service.js";
```

Replace the whole `reportOutcome` function with:

```ts
export interface ReportOutcomeOptions {
  feedback?: { tags: string[]; note?: string };
  continuation?: "continue" | "break";
}

export async function reportOutcome(
  applicantId: string,
  matchId: string,
  outcome: "success" | "failed",
  options?: ReportOutcomeOptions,
  audit: { ipAddress: string; userAgent: string } = { ipAddress: "unknown", userAgent: "unknown" },
): Promise<void> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);

  const actorId = new ObjectId(applicantId);

  let matchOid: ObjectId;
  try { matchOid = new ObjectId(matchId); } catch {
    throw new AppError("Match not found", 404);
  }

  const match = await matchCol.findOne({ _id: matchOid });
  if (!match) throw new AppError("Match not found", 404);

  assertMatchTransition(match, "outcome", actorId);
  assertOutcomeEligible(match, outcome);

  const now = new Date();
  const ids = [match.applicantAId, match.applicantBId];

  const setFields: Record<string, unknown> = {
    status: outcome === "success" ? "success" : "failed",
    updatedAt: now,
  };
  if (outcome === "failed" && options?.feedback) {
    setFields.outcomeFeedback = {
      tags: options.feedback.tags,
      ...(options.feedback.note ? { note: options.feedback.note } : {}),
    };
  }

  // Atomic claim — only one partner's outcome report wins; a concurrent
  // conflicting report gets 409 instead of silently overwriting state
  const claimed = await matchCol.findOneAndUpdate(
    { _id: matchOid, status: { $in: ["dating", "in_progress"] } },
    { $set: setFields },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw new AppError("Outcome was already reported for this match", 409);
  }

  if (outcome === "failed" && options?.feedback) {
    await writeAuditLog(
      { actorId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
      "APPLICANT_REPORT_OUTCOME",
      { targetApplicantId: actorId, metadata: { matchId, tags: options.feedback.tags } },
    );
  }

  if (outcome === "success") {
    // Mirror deactivateMyAccount: a partner heading toward deletion shouldn't
    // leave other proposed/in_progress matches around for someone else to contact.
    await applyMatchStatusSideEffects("success", ids);
    return;
  }

  // "failed": default to "continue" (today's behavior) unless the reporter
  // explicitly chose to take a break — see the warm-dating-experience design
  // doc for why this stays a single shared choice rather than per-applicant.
  if (options?.continuation === "break") {
    const deletionScheduledAt = new Date(Date.now() + DELETION_GRACE_MS);
    await transitionApplicantStatus(ids, "inactive", { deletionScheduledAt });
    await expireConflictingMatches(ids);
  } else {
    await applyMatchStatusSideEffects("failed", ids);
  }
}
```

- [ ] **Step 6: Update the controller**

In `api/src/controllers/profile.controller.ts`, replace the `outcome` handler:

```ts
export async function outcome(c: ValidatedContext<{ json: OutcomeInput }>): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const matchId     = c.req.param("id") as string;
  const { outcome: out, outcomeFeedback, continuation } = c.req.valid("json");

  try {
    await reportOutcome(
      applicantId,
      matchId,
      out,
      { feedback: outcomeFeedback, continuation },
      getRequestMeta(c),
    );
    return c.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(c, err);
  }
}
```

- [ ] **Step 7: Update the route-test mock signature**

In `api/src/__tests__/routes/profile.routes.test.ts`, the `mockReportOutcome` declaration stays `mock(async () => {})` — no change needed there since it's reset to a resolved no-op in `beforeEach` already. Just confirm `AppError` is imported (it already is, per the existing top-of-file import).

- [ ] **Step 8: Run tests to verify they pass**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/routes/profile.routes.test.ts`
Expected: PASS

- [ ] **Step 9: Run the full API suite + typecheck**

Run: `bun run typecheck && bun test --preload ./src/__tests__/setup.ts ./src/__tests__`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add api/src/services/profile.service.ts api/src/controllers/profile.controller.ts \
  api/src/validators/profile.validator.ts api/src/models/auditLog.model.ts \
  api/src/__tests__/routes/profile.routes.test.ts
git commit -m "feat(api): gate outcome reporting by day, accept feedback + continuation choice"
```

---

### Task 6: Distance nudge — compute on profile load, acknowledge endpoint

**Files:**
- Modify: `api/src/services/profile.service.ts`
- Modify: `api/src/controllers/profile.controller.ts`
- Modify: `api/src/routes/profile.routes.ts`
- Modify: `api/src/__tests__/routes/profile.routes.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `api/src/__tests__/routes/profile.routes.test.ts`. First add a new mock next to the others near the top of the file:

```ts
const mockGetDistanceNudge        = mock(async () => null as { matchId: string } | null);
const mockAcknowledgeDistanceNudge = mock(async () => {});
```

Add both to the `mock.module("../../services/profile.service.js", () => ({ ... }))` object (alongside `getMyMatches`, etc.):

```ts
  getDistanceNudge:         mockGetDistanceNudge,
  acknowledgeDistanceNudge: mockAcknowledgeDistanceNudge,
```

Add resets in `beforeEach`:

```ts
  mockGetDistanceNudge.mockReset();
  mockAcknowledgeDistanceNudge.mockReset();
  mockGetDistanceNudge.mockResolvedValue(null);
```

And `mockGetMyProfile.mockResolvedValue` already defaults to `null` — leave as is; the `/me` tests below set their own return value.

Add a new describe block, near the existing `/profile/me` tests:

```ts
// ── POST /profile/matches/:id/nudge-ack ──────────────────────────────────────

describe("POST /profile/matches/:id/nudge-ack", () => {
  it("returns 401 without token", async () => {
    const res = await post("/profile/matches/abc123/nudge-ack", { openUp: true });
    expect(res.status).toBe(401);
  });

  it("returns 200 and forwards openUp", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/nudge-ack", { openUp: true }, token);
    expect(res.status).toBe(200);
    expect(mockAcknowledgeDistanceNudge).toHaveBeenCalledWith(VALID_APPLICANT_ID, "abc123", true);
  });

  it("returns 422 when openUp is missing", async () => {
    const token = await applicantToken();
    const res = await post("/profile/matches/abc123/nudge-ack", {}, token);
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/routes/profile.routes.test.ts`
Expected: FAIL — route doesn't exist yet (404), mocks unused

- [ ] **Step 3: Implement the service functions**

In `api/src/services/profile.service.ts`, add `distanceNudge: { matchId: string } | null;` to `ApplicantProfileView`:

```ts
export interface ApplicantProfileView {
  applicantId: string;
  alias: string;
  status: ApplicantDoc["status"];
  scoreThreshold: number;
  createdAt: Date;
  deletionScheduledAt: Date | null;
  distanceNudge: { matchId: string } | null;
}
```

Update `getMyProfile` to populate it:

```ts
export async function getMyProfile(applicantId: string): Promise<ApplicantProfileView | null> {
  const db  = await getDb();
  const col = getApplicantsCollection(db);

  const doc = await col.findOne({ _id: new ObjectId(applicantId) });
  if (!doc) return null;

  return {
    applicantId: doc._id.toHexString(),
    alias:          doc.alias,
    status:         doc.status,
    scoreThreshold: doc.scoreThreshold ?? 0.8,
    createdAt:      doc.createdAt,
    deletionScheduledAt: doc.deletionScheduledAt ?? null,
    distanceNudge: await getDistanceNudge(applicantId),
  };
}
```

Add the two new functions (near `reportOutcome`):

```ts
/**
 * Surfaces a one-time, dismissible suggestion when the applicant's most
 * recent failed match was tagged "too_far" and they're not already open to
 * long-distance matches. Returns null once acknowledged (see
 * acknowledgeDistanceNudge) or when no qualifying match exists.
 */
export async function getDistanceNudge(applicantId: string): Promise<{ matchId: string } | null> {
  const db       = await getDb();
  const appCol   = getApplicantsCollection(db);
  const matchCol = getMatchesCollection(db);
  const oid      = new ObjectId(applicantId);

  const applicant = await appCol.findOne({ _id: oid }, { projection: { answers: 1 } });
  if (!applicant || applicant.answers?.["open_to_long_distance"] !== false) return null;

  const match = await matchCol.findOne(
    {
      $or: [{ applicantAId: oid }, { applicantBId: oid }],
      status: "failed",
      "outcomeFeedback.tags": "too_far",
      "outcomeFeedback.nudgeAcknowledged": { $ne: true },
    },
    { sort: { updatedAt: -1 }, projection: { _id: 1 } },
  );

  return match ? { matchId: match._id.toHexString() } : null;
}

/**
 * Marks the distance nudge as acknowledged for a match (shown at most once),
 * and — only if the applicant opted in — opens them up to long-distance
 * matches. Declining still acknowledges the nudge so it doesn't reappear.
 */
export async function acknowledgeDistanceNudge(
  applicantId: string,
  matchId: string,
  openUp: boolean,
): Promise<void> {
  const db       = await getDb();
  const matchCol = getMatchesCollection(db);
  const appCol   = getApplicantsCollection(db);
  const oid      = new ObjectId(applicantId);

  let matchOid: ObjectId;
  try { matchOid = new ObjectId(matchId); } catch {
    throw new AppError("Match not found", 404);
  }

  const result = await matchCol.updateOne(
    {
      _id: matchOid,
      $or: [{ applicantAId: oid }, { applicantBId: oid }],
      "outcomeFeedback.tags": "too_far",
    },
    { $set: { "outcomeFeedback.nudgeAcknowledged": true } },
  );
  if (result.matchedCount === 0) throw new AppError("Match not found", 404);

  if (openUp) {
    await appCol.updateOne(
      { _id: oid },
      { $set: { "answers.open_to_long_distance": true, updatedAt: new Date() } },
    );
  }
}
```

- [ ] **Step 4: Wire the controller and route**

In `api/src/controllers/profile.controller.ts`, add the import and handler:

```ts
import {
  // ...existing imports...
  acknowledgeDistanceNudge,
} from "../services/profile.service.js";
```

```ts
export async function nudgeAck(c: ValidatedContext<{ json: NudgeAckInput }>): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const matchId     = c.req.param("id") as string;
  const { openUp }  = c.req.valid("json");

  try {
    await acknowledgeDistanceNudge(applicantId, matchId, openUp);
    return c.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(c, err);
  }
}
```

Add `NudgeAckInput` to the existing type-only import from `../validators/profile.validator.js`.

In `api/src/routes/profile.routes.ts`, add the import (`nudgeAckSchema` from the validator, `nudgeAck` from the controller) and register the route after `/matches/:id/outcome`:

```ts
profileRoutes.post(
  "/matches/:id/nudge-ack",
  requireApplicant,
  zValidator("json", nudgeAckSchema, validationHook),
  nudgeAck
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/routes/profile.routes.test.ts`
Expected: PASS

- [ ] **Step 6: Run full suite + typecheck**

Run: `bun run typecheck && bun test --preload ./src/__tests__/setup.ts ./src/__tests__`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/src/services/profile.service.ts api/src/controllers/profile.controller.ts \
  api/src/routes/profile.routes.ts api/src/__tests__/routes/profile.routes.test.ts
git commit -m "feat(api): add distance-preference nudge and acknowledgement endpoint"
```

---

### Task 7: CSS animations — confetti drift + heart pulse

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add the keyframes and component classes**

In `frontend/src/index.css`, add after the existing `@keyframes home-rise { ... }` block (around line 138):

```css
@keyframes confetti-drift {
  0%   { opacity: 0; transform: translateY(0) rotate(0deg); }
  15%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-40px) rotate(180deg); }
}

@keyframes heart-pulse {
  0%   { opacity: 0; transform: scale(0.85); }
  40%  { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
```

Inside the existing `@layer components { ... }` block, add alongside `.home-rise`:

```css
  .animate-confetti-drift {
    animation: confetti-drift 1.6s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  }

  .animate-heart-pulse {
    animation: heart-pulse 1.2s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  }
```

- [ ] **Step 2: Visual sanity check**

Run: `bun run dev:frontend`, navigate to the profile portal in a browser, confirm no CSS errors in the console. (Full wiring happens in Task 9 — this step only confirms the keyframes parse.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(frontend): add confetti-drift and heart-pulse keyframes"
```

---

### Task 8: i18n copy — check-in messages, outcome moment, distance nudge, warm deletion copy

**Files:**
- Modify: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/i18n/locales/fr.json`
- Modify: `frontend/src/i18n/locales/de.json`
- Modify: `frontend/src/i18n/locales/ar.json`

- [ ] **Step 1: Add English keys**

In `frontend/src/i18n/locales/en.json`, inside the existing `portal.matches` object, add (alongside `howDidItGo`/`workedOut`/`didntWork`):

```json
"checkIn": {
  "message1": "Hey, how's it going with {{alias}}? Did you two end up grabbing that coffee we suggested?",
  "message2": "No pressure at all — just checking in. How are things with {{alias}} so far?",
  "message3": "A little nudge from us: how did your first date with {{alias}} go?",
  "message4": "Take your time getting to know {{alias}}. We're just cheering quietly from the sidelines.",
  "message5": "Curious how it's going with {{alias}}? There's no rush to tell us anything yet.",
  "message6": "Hope you're enjoying getting to know {{alias}}. We'll check back in a few days."
},
"outcome": {
  "notWorkingOutLink": "Things aren't working out?",
  "feedbackPrompt": "No worries — want to tell us a little more? (optional)",
  "feedbackTags": {
    "too_far": "We live too far apart",
    "different_values": "Different lifestyles / values",
    "no_spark": "No romantic spark",
    "something_else": "Something else"
  },
  "feedbackNotePlaceholder": "Anything else you'd like to add? (optional)",
  "feedbackContinue": "Continue",
  "failedTitle": "That's okay — not every match is the one",
  "failedBody": "Thank you for giving it a real shot. Finding the right person takes time, and we're glad you're still here.",
  "keepLooking": "Keep looking now",
  "takeABreak": "Take a break for a while",
  "successTitle": "That's wonderful news!",
  "successBody": "We're so happy it worked out with {{alias}}. We'll step back now and let you two enjoy this — but we're always here if you ever need us again."
}
```

In the same file, inside `portal.dashboard`, add a sibling `distanceNudge` object next to `deletion`:

```json
"distanceNudge": {
  "title": "Distance came up last time",
  "body": "Want to open yourself up to long-distance matches going forward?",
  "yes": "Yes, open me up",
  "no": "No, keep as is"
}
```

Rewrite the existing `portal.dashboard.deletion` object's `title`, `body`, `cancelTitle`, and `cancelConfirm` keys (keep `days`/`hours`/`minutes`/`seconds`/`cancelButton`/`cancelYes`/`cancelFailed`/`deleteNowButton`/`deleteNowTitle`/`deleteNowConfirm`/`deleteNowYes`/`deleteNowFailed` exactly as they are — the irreversible-delete copy stays clear and serious on purpose):

```json
"title": "Taking some time away",
"body": "We're here whenever you're ready to come back — no rush. If we don't hear from you, we'll clear your data after this countdown, just to keep things tidy.",
"cancelTitle": "Welcome back",
"cancelConfirm": "We'll bring your profile back into the matching pool whenever you're ready — there's no pressure.",
```

- [ ] **Step 2: Add French translations**

In `frontend/src/i18n/locales/fr.json`, mirror the same key structure under `portal.matches.checkIn`, `portal.matches.outcome`, and `portal.dashboard.distanceNudge`:

```json
"checkIn": {
  "message1": "Hé, comment ça se passe avec {{alias}} ? Avez-vous fini par prendre ce café qu'on vous a suggéré ?",
  "message2": "Aucune pression — on prend juste des nouvelles. Comment ça va avec {{alias}} jusqu'à présent ?",
  "message3": "Un petit mot de notre part : comment s'est passé votre premier rendez-vous avec {{alias}} ?",
  "message4": "Prenez le temps de connaître {{alias}}. On vous encourage discrètement depuis les coulisses.",
  "message5": "Curieux de savoir comment ça avance avec {{alias}} ? Rien ne presse pour nous le dire.",
  "message6": "On espère que vous prenez plaisir à connaître {{alias}}. On revient vous voir dans quelques jours."
},
"outcome": {
  "notWorkingOutLink": "Ça ne fonctionne pas ?",
  "feedbackPrompt": "Pas de souci — voulez-vous nous en dire un peu plus ? (facultatif)",
  "feedbackTags": {
    "too_far": "On vit trop loin l'un de l'autre",
    "different_values": "Modes de vie / valeurs différents",
    "no_spark": "Pas d'étincelle amoureuse",
    "something_else": "Autre chose"
  },
  "feedbackNotePlaceholder": "Autre chose à ajouter ? (facultatif)",
  "feedbackContinue": "Continuer",
  "failedTitle": "Ce n'est pas grave — ce n'était pas la bonne personne, cette fois",
  "failedBody": "Merci d'avoir vraiment essayé. Trouver la bonne personne prend du temps, et on est content(e) que vous soyez encore là.",
  "keepLooking": "Continuer à chercher maintenant",
  "takeABreak": "Faire une pause pour un moment",
  "successTitle": "C'est une merveilleuse nouvelle !",
  "successBody": "On est tellement content(e) que ça ait fonctionné avec {{alias}}. On se met en retrait pour vous laisser profiter de ce moment — mais on est toujours là si vous avez besoin de nous à nouveau."
}
```

```json
"distanceNudge": {
  "title": "La distance est revenue la dernière fois",
  "body": "Voulez-vous vous ouvrir aux rencontres à distance à l'avenir ?",
  "yes": "Oui, ouvrez-moi à ça",
  "no": "Non, laissez comme c'est"
}
```

And rewrite `portal.dashboard.deletion.title`/`body`/`cancelTitle`/`cancelConfirm`:

```json
"title": "Une pause, le temps qu'il faudra",
"body": "On est là quand vous serez prêt(e) à revenir — rien ne presse. Si on n'a pas de nouvelles, on supprimera vos données à la fin de ce compte à rebours, simplement pour garder les choses en ordre.",
"cancelTitle": "Bon retour",
"cancelConfirm": "On remet votre profil dans le bassin de rencontres dès que vous êtes prêt(e) — sans aucune pression.",
```

- [ ] **Step 3: Add German translations**

In `frontend/src/i18n/locales/de.json`:

```json
"checkIn": {
  "message1": "Hey, wie läuft's mit {{alias}}? Habt ihr den vorgeschlagenen Kaffee schon getrunken?",
  "message2": "Kein Druck — wir wollten nur kurz nachfragen. Wie läuft es bisher mit {{alias}}?",
  "message3": "Eine kleine Nachfrage von uns: Wie war euer erstes Date mit {{alias}}?",
  "message4": "Lasst euch Zeit, {{alias}} kennenzulernen. Wir drücken still die Daumen.",
  "message5": "Neugierig, wie es mit {{alias}} läuft? Es gibt keine Eile, uns etwas zu erzählen.",
  "message6": "Wir hoffen, ihr genießt es, {{alias}} kennenzulernen. Wir schauen in ein paar Tagen wieder vorbei."
},
"outcome": {
  "notWorkingOutLink": "Klappt es nicht?",
  "feedbackPrompt": "Kein Problem — möchtest du uns ein bisschen mehr erzählen? (optional)",
  "feedbackTags": {
    "too_far": "Wir leben zu weit voneinander entfernt",
    "different_values": "Unterschiedliche Lebensstile / Werte",
    "no_spark": "Keine romantische Funken",
    "something_else": "Etwas anderes"
  },
  "feedbackNotePlaceholder": "Möchtest du noch etwas hinzufügen? (optional)",
  "feedbackContinue": "Weiter",
  "failedTitle": "Das ist okay — nicht jedes Match ist der richtige Treffer",
  "failedBody": "Danke, dass du es wirklich versucht hast. Die richtige Person zu finden, braucht Zeit, und wir freuen uns, dass du noch hier bist.",
  "keepLooking": "Jetzt weitersuchen",
  "takeABreak": "Eine Zeit lang Pause machen",
  "successTitle": "Das sind wunderbare Neuigkeiten!",
  "successBody": "Wir freuen uns so, dass es mit {{alias}} geklappt hat. Wir ziehen uns jetzt zurück, damit ihr das genießen könnt — aber wir sind immer da, falls du uns wieder brauchst."
}
```

```json
"distanceNudge": {
  "title": "Entfernung war letztes Mal ein Thema",
  "body": "Möchtest du dich künftig für Fernbeziehungen öffnen?",
  "yes": "Ja, öffne mich dafür",
  "no": "Nein, so lassen"
}
```

And rewrite `portal.dashboard.deletion.title`/`body`/`cancelTitle`/`cancelConfirm`:

```json
"title": "Eine Auszeit nehmen",
"body": "Wir sind da, wann immer du bereit bist zurückzukommen — ganz ohne Eile. Falls wir nichts von dir hören, löschen wir deine Daten nach Ablauf dieses Countdowns, einfach um alles ordentlich zu halten.",
"cancelTitle": "Willkommen zurück",
"cancelConfirm": "Wir bringen dein Profil zurück in den Matching-Pool, wann immer du bereit bist — ganz ohne Druck.",
```

- [ ] **Step 4: Add Arabic translations**

In `frontend/src/i18n/locales/ar.json` (RTL — no layout changes needed here, just translated strings):

```json
"checkIn": {
  "message1": "أهلاً، كيف تسير الأمور مع {{alias}}؟ هل ذهبتما لتناول القهوة التي اقترحناها؟",
  "message2": "لا ضغط أبداً — فقط نسأل عن أحوالك. كيف تسير الأمور مع {{alias}} حتى الآن؟",
  "message3": "تذكير لطيف منا: كيف كان أول موعد لك مع {{alias}}؟",
  "message4": "خذ وقتك في التعرف على {{alias}}. نحن نشجعك بهدوء من الخلف.",
  "message5": "متحمس لمعرفة كيف تسير الأمور مع {{alias}}؟ لا داعي للعجلة لإخبارنا بأي شيء.",
  "message6": "نأمل أن تستمتع بالتعرف على {{alias}}. سنتابع معك خلال أيام قليلة."
},
"outcome": {
  "notWorkingOutLink": "الأمور لا تسير كما ينبغي؟",
  "feedbackPrompt": "لا بأس — هل تود أن تخبرنا بمزيد من التفاصيل؟ (اختياري)",
  "feedbackTags": {
    "too_far": "نعيش في مكانين بعيدين عن بعضهما",
    "different_values": "أنماط حياة / قيم مختلفة",
    "no_spark": "لا توجد شرارة عاطفية",
    "something_else": "شيء آخر"
  },
  "feedbackNotePlaceholder": "هل تود إضافة أي شيء آخر؟ (اختياري)",
  "feedbackContinue": "متابعة",
  "failedTitle": "لا بأس — ليس كل تطابق هو الشخص المناسب",
  "failedBody": "شكراً لإعطاء هذه التجربة فرصة حقيقية. إيجاد الشخص المناسب يستغرق وقتاً، ونحن سعداء بأنك ما زلت هنا.",
  "keepLooking": "متابعة البحث الآن",
  "takeABreak": "أخذ استراحة لبعض الوقت",
  "successTitle": "هذا خبر رائع!",
  "successBody": "نحن سعيدون جداً أن الأمور نجحت مع {{alias}}. سنتراجع الآن لنترككما تستمتعان بهذا — ولكننا دائماً هنا إذا احتجت إلينا مجدداً."
}
```

```json
"distanceNudge": {
  "title": "المسافة كانت سبباً في المرة الأخيرة",
  "body": "هل تود أن تفتح نفسك لمطابقات بعيدة المسافة في المستقبل؟",
  "yes": "نعم، افتح لي هذا الخيار",
  "no": "لا، اتركه كما هو"
}
```

And rewrite `portal.dashboard.deletion.title`/`body`/`cancelTitle`/`cancelConfirm`:

```json
"title": "أخذ بعض الوقت بعيداً",
"body": "نحن هنا في أي وقت تكون جاهزاً للعودة — لا داعي للعجلة. إذا لم نسمع منك، سنحذف بياناتك بعد انتهاء هذا العد التنازلي، فقط للحفاظ على الأمور منظمة.",
"cancelTitle": "أهلاً بعودتك",
"cancelConfirm": "سنعيد ملفك الشخصي إلى مجموعة المطابقة في أي وقت تكون جاهزاً — دون أي ضغط.",
```

- [ ] **Step 5: Validate JSON and run frontend tests**

Run: `bun run --cwd frontend vitest run`
Expected: PASS (no test depends on exact copy text yet — Task 9 adds those)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/i18n/locales/en.json frontend/src/i18n/locales/fr.json \
  frontend/src/i18n/locales/de.json frontend/src/i18n/locales/ar.json
git commit -m "feat(frontend): add warm check-in/outcome/distance-nudge copy, soften deletion copy"
```

---

### Task 9: `MatchCard` day-gated dating UI (check-in, cancel link, outcome moment)

**Files:**
- Create: `frontend/src/pages/profile/datingTimeline.ts`
- Modify: `frontend/src/pages/profile/MatchCard.tsx`
- Modify: `frontend/src/pages/profile/MatchList.tsx`
- Modify: `frontend/src/api/profile.client.ts`
- Test: `frontend/src/__tests__/unit/MatchCard.vitest.tsx`
- Test: `frontend/src/__tests__/unit/datingTimeline.vitest.ts`

- [ ] **Step 1: Write the failing test for the pure timeline helper**

Create `frontend/src/__tests__/unit/datingTimeline.vitest.ts`:

```ts
import { daysSince, CANCEL_ELIGIBLE_DAYS, OUTCOME_ELIGIBLE_DAYS } from '../../pages/profile/datingTimeline'

describe('daysSince', () => {
  it('returns 0 for a timestamp less than a day ago', () => {
    const justNow = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(daysSince(justNow)).toBe(0)
  })

  it('returns 3 for a timestamp exactly 3 days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysSince(threeDaysAgo)).toBe(3)
  })
})

describe('eligibility constants', () => {
  it('cancel unlocks before outcome', () => {
    expect(CANCEL_ELIGIBLE_DAYS).toBeLessThan(OUTCOME_ELIGIBLE_DAYS)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `bun run vitest run src/__tests__/unit/datingTimeline.vitest.ts`
Expected: FAIL — module `datingTimeline` doesn't exist

- [ ] **Step 3: Implement `datingTimeline.ts`**

Create `frontend/src/pages/profile/datingTimeline.ts`:

```ts
// Mirrors api/src/services/match-state.service.ts's daysSince/eligibility
// constants — duplicated client-side on purpose since it's display-only
// gating; the server is the actual authority (see profile.service.ts
// reportOutcome's assertOutcomeEligible call).

/** Day count after which a "didn't work" outcome can be reported. */
export const CANCEL_ELIGIBLE_DAYS = 3
/** Day count after which an "it worked" outcome can be reported. */
export const OUTCOME_ELIGIBLE_DAYS = 7

/** Whole days elapsed since an ISO timestamp, floored. */
export function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000))
}

export const CHECK_IN_MESSAGE_KEYS = [
  'portal.matches.checkIn.message1',
  'portal.matches.checkIn.message2',
  'portal.matches.checkIn.message3',
  'portal.matches.checkIn.message4',
  'portal.matches.checkIn.message5',
  'portal.matches.checkIn.message6',
] as const

export const OUTCOME_FEEDBACK_TAGS = ['too_far', 'different_values', 'no_spark', 'something_else'] as const
export type OutcomeFeedbackTag = (typeof OUTCOME_FEEDBACK_TAGS)[number]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run vitest run src/__tests__/unit/datingTimeline.vitest.ts`
Expected: PASS

- [ ] **Step 5: Update `profile.client.ts` types and functions**

In `frontend/src/api/profile.client.ts`:

Add `partnerFullName?: string` and `datingStartedAt?: string` to `MatchView`:

```ts
export interface MatchView {
  matchId: string
  partnerAlias: string
  score: number
  breakdown?: Record<string, number>
  status: MatchStatus
  perspective: MatchPerspective
  contactRequestedAt?: string
  iceBreakers?: string[]
  dateIdeas?: string[]
  partnerProfile?: Record<string, unknown>
  partnerInstagram?: string
  partnerFullName?: string
  datingStartedAt?: string
}
```

Add `distanceNudge: { matchId: string } | null` to `ProfileView`:

```ts
export interface ProfileView {
  applicantId: string
  alias: string
  status: ApplicantStatus
  scoreThreshold: number
  createdAt: string
  deletionScheduledAt: string | null
  distanceNudge: { matchId: string } | null
}
```

Replace `respondToContact`'s return type to include the name, and `reportOutcome` to accept the new options:

```ts
export async function respondToContact(
  matchId: string,
  accept: boolean,
): Promise<{ partnerInstagram: string | null; partnerFullName: string | null }> {
  const body = await profileRequest<{ data: { partnerInstagram: string | null; partnerFullName: string | null } }>(
    `/profile/matches/${matchId}/respond`,
    { method: 'POST', body: JSON.stringify({ accept }) },
  )
  return body.data
}
```

```ts
export interface OutcomeFeedback {
  tags: string[]
  note?: string
}

export async function reportOutcome(
  matchId: string,
  outcome: 'success' | 'failed',
  options?: { feedback?: OutcomeFeedback; continuation?: 'continue' | 'break' },
): Promise<void> {
  await profileRequest<unknown>(
    `/profile/matches/${matchId}/outcome`,
    {
      method: 'POST',
      body: JSON.stringify({
        outcome,
        outcomeFeedback: options?.feedback,
        continuation: options?.continuation,
      }),
    },
  )
}
```

Add the nudge-acknowledgement client function near `cancelAccountDeletion`:

```ts
export async function acknowledgeDistanceNudge(matchId: string, openUp: boolean): Promise<void> {
  await profileRequest<unknown>(
    `/profile/matches/${matchId}/nudge-ack`,
    { method: 'POST', body: JSON.stringify({ openUp }) },
  )
}
```

- [ ] **Step 6: Update existing MatchCard tests that assumed ungated outcome buttons**

In `frontend/src/__tests__/unit/MatchCard.vitest.tsx`, every fixture with `status: 'dating'` that expects the outcome buttons to be visible needs an 8-day-old `datingStartedAt` (otherwise the new gating now correctly hides them). Update these specific tests:

`'renders outcome buttons for dating status'`:

```ts
  it('renders outcome buttons for dating status', () => {
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
      datingStartedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    }
    render(<MatchCard match={match} />)
    expect(screen.getByRole('button', { name: /portal\.matches\.workedOut/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.matches\.didntWork/i })).toBeInTheDocument()
  })
```

`'shows an error when outcome reporting fails'`:

```ts
  it('shows an error when outcome reporting fails', async () => {
    const onOutcome = vi.fn().mockRejectedValue(new Error('Outcome was already reported for this match'))
    const match: MatchView = {
      ...base,
      status: 'dating',
      perspective: 'none',
      datingStartedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    }
    render(<MatchCard match={match} onOutcome={onOutcome} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.workedOut/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Outcome was already reported')
    expect(screen.getByRole('button', { name: /portal\.matches\.workedOut/i })).toBeEnabled()
  })
```

`'shows the breakdown toggle for dating cards too'`, `'shows the partner profile on dating cards too'`, and `'shows partnerInstagram on dating cards'` (in the `describe('MatchCard mutual identity reveal', ...)` block) each need `datingStartedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()` added to their `match` object so the header/details/instagram link still render above the now-gated outcome section (these tests don't assert on the outcome buttons, so only the fixture needs the added field, no assertion changes).

- [ ] **Step 7: Write the new failing tests for gated states**

Add a new `describe` block to `MatchCard.vitest.tsx`:

```ts
describe('MatchCard dating-phase gating', () => {
  function datingMatch(daysAgo: number): MatchView {
    return {
      ...base,
      status: 'dating',
      perspective: 'none',
      datingStartedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  it('shows a check-in message and no action buttons before day 3', () => {
    render(<MatchCard match={datingMatch(1)} />)
    expect(screen.queryByRole('button', { name: /portal\.matches\.workedOut/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/portal\.matches\.outcome\.notWorkingOutLink/)).not.toBeInTheDocument()
    expect(screen.getByText(/portal\.matches\.checkIn\.message/)).toBeInTheDocument()
  })

  it('shows the quiet cancel link (but not full outcome buttons) between day 3 and day 7', () => {
    render(<MatchCard match={datingMatch(4)} />)
    expect(screen.queryByRole('button', { name: /portal\.matches\.workedOut/i })).not.toBeInTheDocument()
    expect(screen.getByText(/portal\.matches\.outcome\.notWorkingOutLink/)).toBeInTheDocument()
  })

  it('shows full outcome buttons at day 7+', () => {
    render(<MatchCard match={datingMatch(7)} />)
    expect(screen.getByRole('button', { name: /portal\.matches\.workedOut/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.matches\.didntWork/i })).toBeInTheDocument()
  })

  it('clicking "didn\'t work" shows the optional feedback tags before submitting', async () => {
    render(<MatchCard match={datingMatch(7)} />)
    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.didntWork/i }))
    expect(screen.getByText(/portal\.matches\.outcome\.feedbackPrompt/)).toBeInTheDocument()
    expect(screen.getByText(/portal\.matches\.outcome\.feedbackTags\.too_far/)).toBeInTheDocument()
  })

  it('continuing past feedback shows the keep-looking/take-a-break choice, and submits on click', async () => {
    const onOutcome = vi.fn().mockResolvedValue(undefined)
    render(<MatchCard match={datingMatch(7)} onOutcome={onOutcome} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.didntWork/i }))
    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.outcome\.feedbackContinue/i }))

    expect(screen.getByRole('button', { name: /portal\.matches\.outcome\.keepLooking/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.matches\.outcome\.takeABreak/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.outcome\.takeABreak/i }))

    expect(onOutcome).toHaveBeenCalledWith('m1', 'failed', {
      feedback: undefined,
      continuation: 'break',
    })
  })

  it('clicking "it worked" submits immediately with no feedback step', async () => {
    const onOutcome = vi.fn().mockResolvedValue(undefined)
    render(<MatchCard match={datingMatch(7)} onOutcome={onOutcome} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.matches\.workedOut/i }))

    expect(onOutcome).toHaveBeenCalledWith('m1', 'success', undefined)
    expect(screen.getByText(/portal\.matches\.outcome\.successTitle/)).toBeInTheDocument()
  })

  it('shows the full name above the Instagram handle when revealed', () => {
    const match: MatchView = {
      ...datingMatch(7),
      partnerInstagram: 'cres.river',
      partnerFullName: 'Crescent River',
    }
    render(<MatchCard match={match} />)
    expect(screen.getByText('Crescent River')).toBeInTheDocument()
    expect(screen.getByText('@cres.river')).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `bun run vitest run src/__tests__/unit/MatchCard.vitest.tsx`
Expected: FAIL — gating doesn't exist yet, all dating-status tests currently show the old ungated buttons

- [ ] **Step 9: Rewrite the `dating` branch in `MatchCard.tsx`**

In `frontend/src/pages/profile/MatchCard.tsx`, add the import:

```ts
import {
  daysSince,
  CANCEL_ELIGIBLE_DAYS,
  OUTCOME_ELIGIBLE_DAYS,
  CHECK_IN_MESSAGE_KEYS,
  OUTCOME_FEEDBACK_TAGS,
  type OutcomeFeedbackTag,
} from './datingTimeline'
```

Update the `MatchCardProps` interface's `onOutcome` signature:

```ts
interface MatchCardProps {
  match: MatchView
  onContactRequest?: (matchId: string) => Promise<ContactResult>
  onRespond?: (matchId: string, accept: boolean) => Promise<void>
  onWithdraw?: (matchId: string) => Promise<void>
  onOutcome?: (
    matchId: string,
    outcome: 'success' | 'failed',
    options?: { feedback?: { tags: string[]; note?: string }; continuation?: 'continue' | 'break' },
  ) => Promise<void>
}
```

Add the new local state, alongside the existing `useState` declarations near the top of the component (these must stay unconditional, before any early `return`):

```ts
  const [outcomePhase, setOutcomePhase] = useState<'idle' | 'feedback' | 'choice' | 'done'>('idle')
  const [pendingOutcome, setPendingOutcome] = useState<'success' | 'failed' | null>(null)
  const [selectedTags, setSelectedTags] = useState<OutcomeFeedbackTag[]>([])
  const [feedbackNote, setFeedbackNote] = useState('')
  const [submittingOutcome, setSubmittingOutcome] = useState(false)
  // Re-rolled once per mount (i.e. per page load), stable for the rest of the session
  const [checkInMessageKey] = useState(
    () => CHECK_IN_MESSAGE_KEYS[Math.floor(Math.random() * CHECK_IN_MESSAGE_KEYS.length)],
  )
```

Replace the entire existing `// ── Case 4: dating ──` block (from `if (status === 'dating') {` through its closing `}` before `// ── Case 1: proposed + none ──`) with:

```tsx
  // ── Case 4: dating ────────────────────────────────────────────────────────
  if (status === 'dating') {
    const elapsedDays = displayMatch.datingStartedAt ? daysSince(displayMatch.datingStartedAt) : 0
    const cancelUnlocked = elapsedDays >= CANCEL_ELIGIBLE_DAYS
    const outcomeUnlocked = elapsedDays >= OUTCOME_ELIGIBLE_DAYS

    function toggleTag(tag: OutcomeFeedbackTag) {
      setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t2 => t2 !== tag) : [...prev, tag]))
    }

    function buildFeedback(): { tags: string[]; note?: string } | undefined {
      if (selectedTags.length === 0 && !feedbackNote.trim()) return undefined
      return { tags: selectedTags, note: feedbackNote.trim() || undefined }
    }

    async function submitOutcome(outcome: 'success' | 'failed', continuation?: 'continue' | 'break') {
      if (!onOutcome) return
      setActionError('')
      setSubmittingOutcome(true)
      try {
        await onOutcome(
          matchId,
          outcome,
          outcome === 'failed' ? { feedback: buildFeedback(), continuation } : undefined,
        )
        setOutcomePhase('done')
      } catch (err) {
        failAction(err)
      } finally {
        setSubmittingOutcome(false)
      }
    }

    const header = (
      <ExpandableHeader
        expanded={expanded}
        onToggle={toggleExpanded}
        hasDetails={hasDetails}
        left={
          <span className="text-base font-medium text-primary">
            {t('portal.matches.dating', { alias: partnerAlias })}
          </span>
        }
        right={<span className="text-sm text-muted">{t('portal.matches.matchScore', { percent: Math.round(score * 100) })}</span>}
      />
    )

    const sharedSections = (
      <>
        {displayMatch.partnerFullName && (
          <p className="text-base font-medium text-primary mt-1">{displayMatch.partnerFullName}</p>
        )}
        {partnerHandle && <InstagramLink handle={partnerHandle} />}
        {detailsSection}
        {perspective === 'initiator' && (
          <IceBreakersSection iceBreakers={displayMatch.iceBreakers} dateIdeas={displayMatch.dateIdeas} />
        )}
      </>
    )

    if (outcomePhase === 'done' && pendingOutcome === 'success') {
      return (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
          {header}
          {sharedSections}
          <div className="mt-5 text-center animate-confetti-drift">
            <p className="text-2xl">🎉💛</p>
            <p className="text-base font-medium text-primary mt-2">{t('portal.matches.outcome.successTitle')}</p>
            <p className="text-sm text-muted mt-1">{t('portal.matches.outcome.successBody', { alias: partnerAlias })}</p>
          </div>
        </div>
      )
    }

    if (outcomePhase === 'choice' || (outcomePhase === 'done' && pendingOutcome === 'failed')) {
      return (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
          {header}
          {sharedSections}
          <div className="mt-5 text-center animate-heart-pulse">
            <p className="text-2xl">🤍</p>
            <p className="text-base font-medium text-primary mt-2">{t('portal.matches.outcome.failedTitle')}</p>
            <p className="text-sm text-muted mt-1">{t('portal.matches.outcome.failedBody')}</p>
          </div>
          {outcomePhase === 'choice' && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => void submitOutcome('failed', 'continue')}
                disabled={submittingOutcome}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-accent text-bg rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              >
                {submittingOutcome ? <Spinner /> : null}
                {t('portal.matches.outcome.keepLooking')}
              </button>
              <button
                onClick={() => void submitOutcome('failed', 'break')}
                disabled={submittingOutcome}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-surface border border-border text-muted rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-bg disabled:opacity-50"
              >
                {submittingOutcome ? <Spinner /> : null}
                {t('portal.matches.outcome.takeABreak')}
              </button>
            </div>
          )}
          {actionError && <p role="alert" className="text-sm text-error mt-3">{actionError}</p>}
        </div>
      )
    }

    if (outcomePhase === 'feedback') {
      return (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
          {header}
          {sharedSections}
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted">{t('portal.matches.outcome.feedbackPrompt')}</p>
            <div className="space-y-2">
              {OUTCOME_FEEDBACK_TAGS.map(tag => (
                <label key={tag} className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                    className="rounded border-border"
                  />
                  {t(`portal.matches.outcome.feedbackTags.${tag}`)}
                </label>
              ))}
            </div>
            <textarea
              value={feedbackNote}
              onChange={e => setFeedbackNote(e.target.value)}
              placeholder={t('portal.matches.outcome.feedbackNotePlaceholder')}
              maxLength={500}
              rows={2}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-primary placeholder:text-muted"
            />
            <button
              onClick={() => setOutcomePhase('choice')}
              className="inline-flex items-center justify-center gap-2 bg-accent text-bg rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90"
            >
              {t('portal.matches.outcome.feedbackContinue')}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
        {header}
        {sharedSections}
        {outcomeUnlocked ? (
          <div className="mt-4">
            <p className="text-sm text-muted mb-3">{t('portal.matches.howDidItGo')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setPendingOutcome('success'); void submitOutcome('success') }}
                disabled={submittingOutcome}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-success text-bg rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              >
                {submittingOutcome ? <Spinner /> : null}
                {t('portal.matches.workedOut')}
              </button>
              <button
                onClick={() => { setPendingOutcome('failed'); setOutcomePhase('feedback') }}
                disabled={submittingOutcome}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-surface border border-border text-muted rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-bg disabled:opacity-50"
              >
                {t('portal.matches.didntWork')}
              </button>
            </div>
            {actionError && <p role="alert" className="text-sm text-error mt-3">{actionError}</p>}
          </div>
        ) : (
          <div className="mt-4 bg-accent-light border border-accent/20 rounded-xl p-4">
            <p className="text-sm text-primary">{t(checkInMessageKey, { alias: partnerAlias })}</p>
            {cancelUnlocked && (
              <button
                onClick={() => { setPendingOutcome('failed'); setOutcomePhase('feedback') }}
                className="text-xs text-muted underline mt-2 hover:text-primary"
              >
                {t('portal.matches.outcome.notWorkingOutLink')}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
```

- [ ] **Step 10: Stop `MatchList` from racing the celebratory view**

In `frontend/src/pages/profile/MatchList.tsx`, replace `handleOutcome`:

```ts
  async function handleOutcome(
    matchId: string,
    outcome: 'success' | 'failed',
    options?: { feedback?: { tags: string[]; note?: string }; continuation?: 'continue' | 'break' },
  ): Promise<void> {
    await reportOutcome(matchId, outcome, options)
    // MatchCard renders its own post-outcome celebratory/encouraging view
    // locally (outcomePhase state) — the match stays in this list until the
    // next full reload picks up the real terminal status from the server.
  }
```

(`reportOutcome` import already exists in this file; its signature change from Task 9 Step 5 covers the new `options` param.)

- [ ] **Step 11: Run tests to verify they pass**

Run: `bun run --cwd frontend vitest run src/__tests__/unit/MatchCard.vitest.tsx src/__tests__/unit/datingTimeline.vitest.ts`
Expected: PASS

- [ ] **Step 12: Run the full frontend suite + typecheck**

Run: `bun run --cwd frontend vitest run && bun run typecheck`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add frontend/src/pages/profile/datingTimeline.ts frontend/src/pages/profile/MatchCard.tsx \
  frontend/src/pages/profile/MatchList.tsx frontend/src/api/profile.client.ts \
  frontend/src/__tests__/unit/MatchCard.vitest.tsx frontend/src/__tests__/unit/datingTimeline.vitest.ts
git commit -m "feat(frontend): gate MatchCard's dating outcome UI by day, add feedback + continuation flow"
```

---

### Task 10: Distance nudge card + `ProfileDashboard` wiring

**Files:**
- Create: `frontend/src/pages/profile/DistanceNudgeCard.tsx`
- Modify: `frontend/src/pages/profile/ProfileDashboard.tsx`
- Test: `frontend/src/__tests__/unit/DistanceNudgeCard.vitest.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/unit/DistanceNudgeCard.vitest.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import DistanceNudgeCard from '../../pages/profile/DistanceNudgeCard'

vi.mock('../../api/profile.client', () => ({
  acknowledgeDistanceNudge: vi.fn(),
}))
import * as profileClient from '../../api/profile.client'
const mockAck = vi.mocked(profileClient.acknowledgeDistanceNudge)

describe('DistanceNudgeCard', () => {
  beforeEach(() => mockAck.mockReset())

  it('renders the prompt and both choices', () => {
    render(<DistanceNudgeCard matchId="m1" onDismissed={vi.fn()} />)
    expect(screen.getByText(/portal\.dashboard\.distanceNudge\.title/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.dashboard\.distanceNudge\.yes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /portal\.dashboard\.distanceNudge\.no/i })).toBeInTheDocument()
  })

  it('clicking Yes acknowledges with openUp true and calls onDismissed', async () => {
    mockAck.mockResolvedValue(undefined)
    const onDismissed = vi.fn()
    render(<DistanceNudgeCard matchId="m1" onDismissed={onDismissed} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.dashboard\.distanceNudge\.yes/i }))

    expect(mockAck).toHaveBeenCalledWith('m1', true)
    expect(onDismissed).toHaveBeenCalled()
  })

  it('clicking No acknowledges with openUp false and calls onDismissed', async () => {
    mockAck.mockResolvedValue(undefined)
    const onDismissed = vi.fn()
    render(<DistanceNudgeCard matchId="m1" onDismissed={onDismissed} />)

    await userEvent.click(screen.getByRole('button', { name: /portal\.dashboard\.distanceNudge\.no/i }))

    expect(mockAck).toHaveBeenCalledWith('m1', false)
    expect(onDismissed).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --cwd frontend vitest run src/__tests__/unit/DistanceNudgeCard.vitest.tsx`
Expected: FAIL — component doesn't exist

- [ ] **Step 3: Implement `DistanceNudgeCard.tsx`**

Create `frontend/src/pages/profile/DistanceNudgeCard.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { acknowledgeDistanceNudge } from '../../api/profile.client'

interface Props {
  matchId: string
  onDismissed: () => void
}

export default function DistanceNudgeCard({ matchId, onDismissed }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function respond(openUp: boolean) {
    setLoading(true)
    try {
      await acknowledgeDistanceNudge(matchId, openUp)
    } finally {
      setLoading(false)
      onDismissed()
    }
  }

  return (
    <div className="bg-accent-light border border-accent/20 rounded-2xl p-5">
      <p className="text-base font-medium text-primary">{t('portal.dashboard.distanceNudge.title')}</p>
      <p className="text-sm text-muted mt-1">{t('portal.dashboard.distanceNudge.body')}</p>
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => void respond(true)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-accent text-bg rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
        >
          {t('portal.dashboard.distanceNudge.yes')}
        </button>
        <button
          onClick={() => void respond(false)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-surface border border-border text-muted rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-bg disabled:opacity-50"
        >
          {t('portal.dashboard.distanceNudge.no')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run --cwd frontend vitest run src/__tests__/unit/DistanceNudgeCard.vitest.tsx`
Expected: PASS

- [ ] **Step 5: Wire it into `ProfileDashboard.tsx`**

In `frontend/src/pages/profile/ProfileDashboard.tsx`, add the import:

```ts
import DistanceNudgeCard from './DistanceNudgeCard'
```

Add right after the `{/* Status-aware content */}` `<main>` opening tag, before the existing tab-bar block:

```tsx
        {profile?.distanceNudge && profile.status !== 'inactive' && (
          <div className="max-w-2xl mx-auto px-6 pt-6">
            <DistanceNudgeCard
              matchId={profile.distanceNudge.matchId}
              onDismissed={() => void load()}
            />
          </div>
        )}
```

- [ ] **Step 6: Run the full frontend suite + typecheck**

Run: `bun run --cwd frontend vitest run && bun run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/profile/DistanceNudgeCard.tsx frontend/src/pages/profile/ProfileDashboard.tsx \
  frontend/src/__tests__/unit/DistanceNudgeCard.vitest.tsx
git commit -m "feat(frontend): show distance-preference nudge card on the dashboard"
```

---

## Part 2 — First/last name capture & reveal

### Task 11: Questionnaire seed bump + form validator + identity model fields

**Files:**
- Modify: `api/src/seeds/questionnaire.seed.ts`
- Modify: `api/src/validators/form.validator.ts`
- Modify: `api/src/validators/profile.validator.ts`
- Modify: `api/src/services/profile.service.ts`
- Modify: `api/src/models/identity.model.ts`

- [ ] **Step 1: Bump the questionnaire version and add the two questions**

In `api/src/seeds/questionnaire.seed.ts`, change `version: "1.1.0"` to `version: "1.2.0"`, and add two new questions to the `"identity"` section, before `instagram_handle`:

```ts
{
  id: "identity",
  title: "Your Identity",
  order: 1,
  questions: [
    {
      id: "first_name",
      label: "First name",
      type: "text",
      sensitive: true,
      required: true,
      order: 1,
      placeholder: "Your first name",
    },
    {
      id: "last_name",
      label: "Last name",
      type: "text",
      sensitive: true,
      required: true,
      order: 2,
      placeholder: "Your last name",
    },
    {
      id: "instagram_handle",
      label: "Instagram Handle",
      type: "text",
      sensitive: true,
      required: true,
      order: 3,
      placeholder: "@yourhandle",
    },
  ],
},
```

(Renumber `instagram_handle`'s `order` from 1 to 3 as shown — the other sections are unaffected.)

- [ ] **Step 2: Re-run the seed against the dev database**

Run (from `api/`): `bun run src/seeds/questionnaire.seed.ts`
Expected: `[SEED] Created questionnaire v1.2.0 ...` (v1.1.0 is deactivated automatically, not deleted — existing submissions under it stay intact)

- [ ] **Step 3: Extend the form validator**

In `api/src/validators/form.validator.ts`, add `first_name` and `last_name` to the `answers` object, right before `instagram_handle`:

```ts
      // Identity (sensitive)
      first_name: z
        .string()
        .min(1, "first_name is required")
        .max(50)
        .regex(/^[\p{L}\p{M}'\- ]+$/u, "first_name contains invalid characters"),
      last_name: z
        .string()
        .min(1, "last_name is required")
        .max(50)
        .regex(/^[\p{L}\p{M}'\- ]+$/u, "last_name contains invalid characters"),
      instagram_handle: z
        .string()
        .min(1, "instagram_handle is required")
        .max(31)
        .regex(/^@?[\w.]+$/, "Invalid Instagram handle format"),
```

- [ ] **Step 4: Exclude the new fields from self-service answer edits**

In `api/src/validators/profile.validator.ts`, add `first_name: true, last_name: true` to the existing `.omit({...})` call in `updateAnswersSchema`:

```ts
export const updateAnswersSchema = z.object({
  answers: formSubmissionSchema.shape.answers
    .omit({
      instagram_handle: true,
      first_name: true,
      last_name: true,
      disclaimer_agreed: true,
      birth_date: true,
      gender_identity: true,
    })
    .strict(),
});
```

In `api/src/services/profile.service.ts`, add the same two keys to `HIDDEN_ANSWER_KEYS` (defense-in-depth, mirroring the existing `instagram_handle` comment — these never actually reach `applicants.answers` since the questionnaire marks them `sensitive: true`, but the filter stays consistent if that ever changes):

```ts
const HIDDEN_ANSWER_KEYS = new Set([
  "instagram_handle",
  "first_name",
  "last_name",
  "disclaimer_agreed",
]);
```

- [ ] **Step 5: Add the additive identity fields**

In `api/src/models/identity.model.ts`:

```ts
import { ObjectId } from "mongodb";

export interface IdentityDoc {
  _id: ObjectId;
  applicantId: ObjectId;
  alias: string;
  encryptedInstagram: string;
  encryptionIv: string;
  encryptionTag: string;
  /** HMAC-SHA256 of normalized handle — enables O(1) duplicate detection without decryption */
  instagramHash: string;
  /** Additive — pre-existing identities have no name on record; reveal falls
   *  back to null for those, no backfill needed. Encrypted with its own
   *  fresh IV, never reusing encryptionIv (AES-GCM nonce reuse breaks
   *  confidentiality guarantees even within the same document). */
  encryptedFullName?: string;
  fullNameIv?: string;
  fullNameTag?: string;
  createdAt: Date;
}
```

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: PASS (form.service.ts not yet updated to pass first_name/last_name through — that's Task 12; the questionnaire cross-check in `processFormSubmission` already accepts any key present in the active questionnaire's question map, so this alone doesn't break existing submission tests since they post against whichever questionnaire fixture the test mocks)

- [ ] **Step 7: Commit**

```bash
git add api/src/seeds/questionnaire.seed.ts api/src/validators/form.validator.ts \
  api/src/validators/profile.validator.ts api/src/services/profile.service.ts \
  api/src/models/identity.model.ts
git commit -m "feat(api): add first_name/last_name to questionnaire v1.2.0 and identity model"
```

---

### Task 12: Encrypt and store the full name alongside the Instagram handle

**Files:**
- Modify: `api/src/privacy/identity.service.ts`
- Modify: `api/src/services/form.service.ts`
- Create: `api/src/__tests__/unit/privacy/identity.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/src/__tests__/unit/privacy/identity.service.test.ts`:

```ts
// tested: privacy/identity.service.ts — encrypted storage and audit-logged
// reveal of an applicant's Instagram handle and (additively) full name.
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";
import type { IdentityDoc } from "../../../models/identity.model.js";

const store = new Map<string, IdentityDoc>();

const fakeIdentities = {
  insertOne: mock(async (doc: IdentityDoc) => {
    store.set(doc.applicantId.toHexString(), doc);
    return { insertedId: doc._id };
  }),
  findOne: mock(async (filter: { applicantId?: ObjectId; alias?: string }) => {
    if (filter.applicantId) return store.get(filter.applicantId.toHexString()) ?? null;
    if (filter.alias) {
      for (const doc of store.values()) if (doc.alias === filter.alias) return doc;
    }
    return null;
  }),
};

mock.module("../../../db/connection.js", () => ({
  getDb: async () => ({}),
  closeDb: async () => {},
}));

mock.module("../../../db/collections.js", () => ({
  getIdentitiesCollection: () => fakeIdentities,
}));

const mockWriteAuditLog = mock(async () => {});
mock.module("../../../middleware/audit.middleware.js", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

import {
  storeIdentity,
  resolveIdentityById,
  revealIdentityById,
} from "../../../privacy/identity.service.js";

beforeEach(() => {
  store.clear();
  fakeIdentities.insertOne.mockClear();
  fakeIdentities.findOne.mockClear();
  mockWriteAuditLog.mockReset();
  mockWriteAuditLog.mockResolvedValue(undefined);
});

describe("storeIdentity + resolveIdentityById", () => {
  it("round-trips the Instagram handle with no full name", async () => {
    const applicantId = new ObjectId();
    await storeIdentity(applicantId, "Blue Falcon", "blue.falcon");

    const resolved = await resolveIdentityById(applicantId);
    expect(resolved).toEqual({ instagram: "blue.falcon", fullName: null });
  });

  it("round-trips both the handle and the full name when provided", async () => {
    const applicantId = new ObjectId();
    await storeIdentity(applicantId, "Blue Falcon", "blue.falcon", "Jane Doe");

    const resolved = await resolveIdentityById(applicantId);
    expect(resolved).toEqual({ instagram: "blue.falcon", fullName: "Jane Doe" });
  });

  it("uses a different IV for the name ciphertext than the handle ciphertext", async () => {
    const applicantId = new ObjectId();
    await storeIdentity(applicantId, "Blue Falcon", "blue.falcon", "Jane Doe");

    const doc = store.get(applicantId.toHexString())!;
    expect(doc.fullNameIv).toBeDefined();
    expect(doc.fullNameIv).not.toEqual(doc.encryptionIv);
  });

  it("returns null for an unknown applicant", async () => {
    const resolved = await resolveIdentityById(new ObjectId());
    expect(resolved).toBeNull();
  });
});

describe("revealIdentityById", () => {
  it("returns the resolved identity and writes one audit log entry", async () => {
    const applicantId = new ObjectId();
    await storeIdentity(applicantId, "Blue Falcon", "blue.falcon", "Jane Doe");

    const result = await revealIdentityById(applicantId, {
      actor: { actorId: "admin1", ipAddress: "127.0.0.1", userAgent: "test" },
      action: "RESOLVE_IDENTITY",
      targetAlias: "Blue Falcon",
    });

    expect(result).toEqual({ instagram: "blue.falcon", fullName: "Jane Doe" });
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns null and does not audit-log for an unknown applicant", async () => {
    const result = await revealIdentityById(new ObjectId(), {
      actor: { actorId: "admin1", ipAddress: "127.0.0.1", userAgent: "test" },
      action: "RESOLVE_IDENTITY",
    });

    expect(result).toBeNull();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/privacy/identity.service.test.ts`
Expected: FAIL — `storeIdentity` doesn't accept a 4th argument yet, `resolveIdentityById`/`revealIdentityById` still return a bare string

- [ ] **Step 3: Implement**

Replace the full contents of `api/src/privacy/identity.service.ts`:

```ts
import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { getIdentitiesCollection } from "../db/collections.js";
import { encrypt, decrypt } from "./encryption.js";
import { hashInstagram } from "./hash.js";
import { writeAuditLog, type AuditContext } from "../middleware/audit.middleware.js";
import type { AuditAction } from "../models/auditLog.model.js";

export async function storeIdentity(
  applicantId: ObjectId,
  alias: string,
  instagramHandle: string,
  fullName?: string,
): Promise<void> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const { encrypted, iv, tag } = encrypt(instagramHandle);

  const doc: Parameters<typeof identities.insertOne>[0] = {
    _id: new ObjectId(),
    applicantId,
    alias,
    encryptedInstagram: encrypted,
    encryptionIv: iv,
    encryptionTag: tag,
    instagramHash: hashInstagram(instagramHandle),
    createdAt: new Date(),
  };

  if (fullName) {
    // A fresh IV per encrypted field, never reusing the handle's — AES-GCM
    // nonce reuse breaks confidentiality even within the same document.
    const { encrypted: encName, iv: ivName, tag: tagName } = encrypt(fullName);
    doc.encryptedFullName = encName;
    doc.fullNameIv = ivName;
    doc.fullNameTag = tagName;
  }

  await identities.insertOne(doc);
}

export async function checkInstagramExists(handle: string): Promise<boolean> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);
  const hash = hashInstagram(handle);
  const doc = await identities.findOne({ instagramHash: hash }, { projection: { _id: 1 } });
  return doc !== null;
}

export async function resolveIdentity(alias: string): Promise<string | null> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const doc = await identities.findOne({ alias });
  if (!doc) return null;

  return decrypt(doc.encryptedInstagram, doc.encryptionIv, doc.encryptionTag);
}

export interface ResolvedIdentity {
  instagram: string;
  fullName: string | null;
}

/**
 * Raw decrypt without an audit log. Only for paths where the reveal has
 * already been logged for this actor (e.g. repeat views of an identity
 * whose first reveal went through revealIdentityById) — every first-time
 * reveal must go through revealIdentityById instead.
 */
export async function resolveIdentityById(
  applicantId: ObjectId
): Promise<ResolvedIdentity | null> {
  const db = await getDb();
  const identities = getIdentitiesCollection(db);

  const doc = await identities.findOne({ applicantId });
  if (!doc) return null;

  const instagram = decrypt(doc.encryptedInstagram, doc.encryptionIv, doc.encryptionTag);
  const fullName =
    doc.encryptedFullName && doc.fullNameIv && doc.fullNameTag
      ? decrypt(doc.encryptedFullName, doc.fullNameIv, doc.fullNameTag)
      : null;

  return { instagram, fullName };
}

export interface IdentityRevealAudit {
  /** Who triggered the decryption — an admin id or an applicant id. */
  actor: AuditContext;
  /** RESOLVE_IDENTITY for admins, APPLICANT_REVEAL_IDENTITY for applicants. */
  action: AuditAction;
  targetAlias?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Decrypts an applicant's identity (Instagram handle + full name, if on
 * record) and writes the mandatory audit log entry before the plaintext is
 * returned. This is the canonical way to reveal an identity — call sites
 * must not decrypt and log separately.
 */
export async function revealIdentityById(
  applicantId: ObjectId,
  audit: IdentityRevealAudit
): Promise<ResolvedIdentity | null> {
  const resolved = await resolveIdentityById(applicantId);
  if (!resolved) return null;

  await writeAuditLog(audit.actor, audit.action, {
    targetAlias: audit.targetAlias,
    targetApplicantId: applicantId,
    metadata: audit.metadata,
  });

  return resolved;
}
```

- [ ] **Step 4: Wire `form.service.ts` to pass the name through**

In `api/src/services/form.service.ts`, replace:

```ts
  const instagramHandle = sensitiveAnswers["instagram_handle"] as string;
```

with:

```ts
  const instagramHandle = sensitiveAnswers["instagram_handle"] as string;
  const firstName = sensitiveAnswers["first_name"] as string | undefined;
  const lastName  = sensitiveAnswers["last_name"] as string | undefined;
  const fullName  = firstName && lastName ? `${firstName} ${lastName}` : undefined;
```

And replace:

```ts
  // 8. Store encrypted identity with hash
  await storeIdentity(applicantId, alias, instagramHandle);
```

with:

```ts
  // 8. Store encrypted identity with hash
  await storeIdentity(applicantId, alias, instagramHandle, fullName);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/privacy/identity.service.test.ts`
Expected: PASS

- [ ] **Step 6: Run full API suite + typecheck**

Run: `bun run typecheck && bun test --preload ./src/__tests__/setup.ts ./src/__tests__`
Expected: FAIL at this point — `admin.service.ts` and `profile.service.ts` still treat `revealIdentityById`/`resolveIdentityById` as returning a bare string; this is expected and fixed in Task 13. Confirm the failures are exactly in those two files (TypeScript errors on `.instagram`/`.fullName` access) and nowhere else before moving on.

- [ ] **Step 7: Commit**

```bash
git add api/src/privacy/identity.service.ts api/src/services/form.service.ts \
  api/src/__tests__/unit/privacy/identity.service.test.ts
git commit -m "feat(api): encrypt and reveal full name alongside the Instagram handle"
```

---

### Task 13: Update all reveal call sites for the new return shape

**Files:**
- Modify: `api/src/services/profile.service.ts`
- Modify: `api/src/controllers/profile.controller.ts`
- Modify: `api/src/services/admin.service.ts`
- Modify: `api/src/controllers/admin.controller.ts`
- Modify: `api/src/__tests__/routes/admin.routes.test.ts`
- Modify: `frontend/src/api/profile.client.ts`
- Modify: `frontend/src/pages/profile/MatchList.tsx`

- [ ] **Step 1: Update `getMyMatches` in `profile.service.ts`**

Replace:

```ts
  const instagramByMatchId = new Map<string, string>();
  for (const d of docs) {
    if (d.status !== "dating") continue;
    const partnerId = d.applicantAId.equals(oid) ? d.applicantBId : d.applicantAId;
    const alreadyLogged = d.identityViewLoggedFor?.includes(applicantId) ?? false;

    const handle = alreadyLogged
      ? await resolveIdentityById(partnerId)
      : await revealIdentityById(partnerId, {
          actor: { actorId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
          action: "APPLICANT_REVEAL_IDENTITY",
          targetAlias: d.applicantAId.equals(oid) ? d.applicantBAlias : d.applicantAAlias,
          metadata: {
            actorType: "applicant",
            matchId: d._id.toHexString(),
            reason: "match_view",
          },
        });
    if (!handle) continue;
    instagramByMatchId.set(d._id.toHexString(), handle);

    if (!alreadyLogged) {
      await matchCol.updateOne(
        { _id: d._id },
        { $addToSet: { identityViewLoggedFor: applicantId } }
      );
    }
  }

  return docs.map((d) => {
    const partnerId = d.applicantAId.equals(oid) ? d.applicantBId : d.applicantAId;
    return toMatchView(
      d,
      oid,
      answersById.get(partnerId.toHexString()),
      instagramByMatchId.get(d._id.toHexString())
    );
  });
```

with:

```ts
  const identityByMatchId = new Map<string, { instagram: string; fullName: string | null }>();
  for (const d of docs) {
    if (d.status !== "dating") continue;
    const partnerId = d.applicantAId.equals(oid) ? d.applicantBId : d.applicantAId;
    const alreadyLogged = d.identityViewLoggedFor?.includes(applicantId) ?? false;

    const identity = alreadyLogged
      ? await resolveIdentityById(partnerId)
      : await revealIdentityById(partnerId, {
          actor: { actorId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
          action: "APPLICANT_REVEAL_IDENTITY",
          targetAlias: d.applicantAId.equals(oid) ? d.applicantBAlias : d.applicantAAlias,
          metadata: {
            actorType: "applicant",
            matchId: d._id.toHexString(),
            reason: "match_view",
          },
        });
    if (!identity) continue;
    identityByMatchId.set(d._id.toHexString(), identity);

    if (!alreadyLogged) {
      await matchCol.updateOne(
        { _id: d._id },
        { $addToSet: { identityViewLoggedFor: applicantId } }
      );
    }
  }

  return docs.map((d) => {
    const partnerId = d.applicantAId.equals(oid) ? d.applicantBId : d.applicantAId;
    const identity  = identityByMatchId.get(d._id.toHexString());
    return toMatchView(
      d,
      oid,
      answersById.get(partnerId.toHexString()),
      identity?.instagram,
      identity?.fullName
    );
  });
```

- [ ] **Step 2: Update `respondToContact` in `profile.service.ts`**

Replace:

```ts
  // initiatorHandle is what the responding applicant (target) now sees —
  // it's the response payload that lets the UI reveal it without a reload.
  const [initiatorHandle] = await Promise.all([
    revealIdentityById(initiatorId, {
      actor: { actorId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
      action: "APPLICANT_REVEAL_IDENTITY",
      targetAlias: initiatorAlias,
      metadata: { actorType: "applicant", matchId, reason: "mutual_accept" },
    }),
    revealIdentityById(targetId, {
      // initiatorId is the one gaining access to this identity, but the
      // actual request — and its real IP/UA — came from the target
      // accepting just now, so log that, not a synthetic "system" actor.
      actor: { actorId: initiatorId.toHexString(), ipAddress: audit.ipAddress, userAgent: audit.userAgent },
      action: "APPLICANT_REVEAL_IDENTITY",
      targetAlias: targetAlias,
      metadata: { actorType: "applicant", matchId, reason: "mutual_accept" },
    }),
  ]);
```

with:

```ts
  // initiatorIdentity is what the responding applicant (target) now sees —
  // it's the response payload that lets the UI reveal it without a reload.
  const [initiatorIdentity] = await Promise.all([
    revealIdentityById(initiatorId, {
      actor: { actorId: applicantId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
      action: "APPLICANT_REVEAL_IDENTITY",
      targetAlias: initiatorAlias,
      metadata: { actorType: "applicant", matchId, reason: "mutual_accept" },
    }),
    revealIdentityById(targetId, {
      // initiatorId is the one gaining access to this identity, but the
      // actual request — and its real IP/UA — came from the target
      // accepting just now, so log that, not a synthetic "system" actor.
      actor: { actorId: initiatorId.toHexString(), ipAddress: audit.ipAddress, userAgent: audit.userAgent },
      action: "APPLICANT_REVEAL_IDENTITY",
      targetAlias: targetAlias,
      metadata: { actorType: "applicant", matchId, reason: "mutual_accept" },
    }),
  ]);
```

And replace the function's return type and final return statement:

```ts
export async function respondToContact(
  applicantId: string,
  matchId: string,
  accept: boolean,
  audit: { ipAddress: string; userAgent: string } = { ipAddress: "unknown", userAgent: "unknown" },
): Promise<{ partnerInstagram: string | null; partnerFullName: string | null }> {
```

```ts
  return {
    partnerInstagram: initiatorIdentity?.instagram ?? null,
    partnerFullName: initiatorIdentity?.fullName ?? null,
  };
```

(The early `if (!accept) return { partnerInstagram: null };` a few lines above also needs the new field: change it to `return { partnerInstagram: null, partnerFullName: null };`.)

- [ ] **Step 3: Update the `respond` controller**

In `api/src/controllers/profile.controller.ts`:

```ts
export async function respond(c: ValidatedContext<{ json: RespondInput }>): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const matchId     = c.req.param("id") as string;
  const { accept }  = c.req.valid("json");

  try {
    const { partnerInstagram, partnerFullName } = await respondToContact(applicantId, matchId, accept, getRequestMeta(c));
    return c.json({ success: true, data: { partnerInstagram, partnerFullName } });
  } catch (err: unknown) {
    return errorResponse(c, err);
  }
}
```

- [ ] **Step 4: Update `admin.service.ts` and its controller**

In `api/src/services/admin.service.ts`, replace `getApplicantIdentity`:

```ts
export async function getApplicantIdentity(
  id: string,
  auditCtx: AuditContext
): Promise<{ alias: string; instagramHandle: string; fullName: string | null } | null> {
  const db = await getDb();
  const col = getApplicantsCollection(db);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return null;
  }

  const applicant = await col.findOne({ _id: objectId });
  if (!applicant) return null;

  const identity = await revealIdentityById(objectId, {
    actor: auditCtx,
    action: "RESOLVE_IDENTITY",
    targetAlias: applicant.alias,
  });
  if (!identity) return null;

  return { alias: applicant.alias, instagramHandle: identity.instagram, fullName: identity.fullName };
}
```

In `api/src/controllers/admin.controller.ts`, update `getApplicantIdentityHandler`'s response:

```ts
    return c.json({
      success: true,
      data: {
        alias: identity.alias,
        instagramHandle: identity.instagramHandle,
        fullName: identity.fullName,
      },
    });
```

- [ ] **Step 5: Update `admin.routes.test.ts`'s mock fixture**

In `api/src/__tests__/routes/admin.routes.test.ts`, find the test `"returns 200 with decrypted handle when identity exists (super_admin)"` and update the mocked resolved value to include `fullName`:

```ts
  mockGetApplicantIdent.mockResolvedValue({
    alias: "Blue Falcon",
    instagramHandle: "@real_handle",
    fullName: "Jane Doe",
  });
```

Add an assertion for the new field in the same test:

```ts
    expect(body.data.fullName).toBe("Jane Doe");
```

- [ ] **Step 6: Update the frontend `respondToContact` caller in `MatchList.tsx`**

In `frontend/src/pages/profile/MatchList.tsx`, update `handleRespond` to also carry through `partnerFullName` (the client function's return type already includes it from Task 9 Step 5):

```ts
  async function handleRespond(matchId: string, accept: boolean): Promise<void> {
    const { partnerInstagram, partnerFullName } = await respondToContact(matchId, accept)
    onMatchesChange(
      matches.map(m =>
        m.matchId === matchId
          ? {
              ...m,
              status: accept ? ('dating' as const) : ('declined' as const),
              partnerInstagram: partnerInstagram ?? m.partnerInstagram,
              partnerFullName: partnerFullName ?? m.partnerFullName,
            }
          : m,
      ),
    )
  }
```

- [ ] **Step 7: Run the full API and frontend suites + typecheck**

Run: `bun run typecheck && bun test --preload ./src/__tests__/setup.ts ./src/__tests__ && bun run --cwd frontend vitest run`
Expected: PASS — this closes out the type errors deferred from Task 12 Step 6

- [ ] **Step 8: Commit**

```bash
git add api/src/services/profile.service.ts api/src/controllers/profile.controller.ts \
  api/src/services/admin.service.ts api/src/controllers/admin.controller.ts \
  api/src/__tests__/routes/admin.routes.test.ts frontend/src/pages/profile/MatchList.tsx
git commit -m "feat(api,frontend): thread full name through every identity reveal call site"
```

---

### Task 14: Collect first/last name in the public application form

**Files:**
- Modify: `frontend/src/types/form.ts`
- Modify: `frontend/src/steps/Step1Identity.tsx`
- Modify: `frontend/src/pages/Apply.tsx`
- Modify: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/i18n/locales/fr.json`
- Modify: `frontend/src/i18n/locales/de.json`
- Modify: `frontend/src/i18n/locales/ar.json`
- Test: `frontend/src/__tests__/unit/Step1Identity.vitest.tsx` (new, if no existing per-step test file pattern is found — see Step 1)

- [ ] **Step 1: Check for an existing Step-component test pattern**

Run: `find frontend/src/__tests__ -iname "*Step*"` from the repo root. If a `Step1Identity`-equivalent test file convention already exists for another step, mirror it; otherwise this task's only verification is the full `Apply` integration flow (covered by existing `frontend/src/__tests__/integration/` tests, which are not expected to break since they fill every required field generically) plus the manual smoke-test in Step 7 below. Either way, do not skip Steps 2–6.

- [ ] **Step 2: Add the fields to `step1Schema`**

In `frontend/src/types/form.ts`, replace:

```ts
export const step1Schema = z.object({
  instagram_handle: z
    .string()
    .min(1, 'Instagram handle is required')
    .regex(/^[a-zA-Z0-9._]+$/, 'Only letters, numbers, dots and underscores'),
  location: z.string().min(1, 'Location is required'),
})
```

with:

```ts
export const step1Schema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .regex(/^[\p{L}\p{M}'\- ]+$/u, 'Only letters, spaces, hyphens and apostrophes'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .regex(/^[\p{L}\p{M}'\- ]+$/u, 'Only letters, spaces, hyphens and apostrophes'),
  instagram_handle: z
    .string()
    .min(1, 'Instagram handle is required')
    .regex(/^[a-zA-Z0-9._]+$/, 'Only letters, numbers, dots and underscores'),
  location: z.string().min(1, 'Location is required'),
})
```

Add `first_name: string` and `last_name: string` to the `FormPayload.answers` interface, right above `instagram_handle`:

```ts
export interface FormPayload {
  questionnaireVersion: '1.2.0'
  answers: {
    first_name: string
    last_name: string
    instagram_handle: string
    location: string
    // ...rest unchanged...
```

(Bump the literal from `'1.1.0'` to `'1.2.0'` to match the seed version from Task 11.)

- [ ] **Step 3: Add the inputs to `Step1Identity.tsx`**

Replace the full contents of `frontend/src/steps/Step1Identity.tsx`:

```tsx
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Control, FieldErrors } from 'react-hook-form'
import type { FormValues } from '../types/form'
import Input from '../components/ui/Input'
import Autocomplete from '../components/ui/Autocomplete'
import { CITIES } from '../data/cities'

interface Props { control: Control<FormValues>; errors: FieldErrors<FormValues> }
export const FIELDS: (keyof FormValues)[] = ['first_name', 'last_name', 'instagram_handle', 'location']

export default function Step1Identity({ control, errors }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('steps.s1.title')}</h2>
        <p className="text-sm text-muted leading-relaxed">{t('steps.s1.subtitle')}</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Controller
            name="first_name"
            control={control}
            render={({ field }) => (
              <Input label={t('steps.s1.firstName')} placeholder={t('steps.s1.firstNamePlaceholder')}
                error={errors.first_name?.message} required {...field} />
            )}
          />
          <Controller
            name="last_name"
            control={control}
            render={({ field }) => (
              <Input label={t('steps.s1.lastName')} placeholder={t('steps.s1.lastNamePlaceholder')}
                error={errors.last_name?.message} required {...field} />
            )}
          />
        </div>
        <Controller
          name="instagram_handle"
          control={control}
          render={({ field }) => (
            <Input label={t('steps.s1.instagram')} prefix="@" placeholder="yourhandle"
              error={errors.instagram_handle?.message} required {...field} />
          )}
        />
        <Controller
          name="location"
          control={control}
          render={({ field }) => (
            <Autocomplete label={t('steps.s1.location')} placeholder={t('steps.s1.locationPlaceholder')}
              error={errors.location?.message} required suggestions={CITIES} {...field} />
          )}
        />
      </div>
      <div className="flex items-start gap-3 rounded-xl bg-accent-light border border-accent/20 px-4 py-3.5">
        <svg className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-xs text-accent leading-relaxed">{t('steps.s1.privacy')}</p>
      </div>
    </div>
  )
}
```

(`t('steps.s1.privacy')` already explains that identity fields are kept private — no copy change needed there since first/last name follow the exact same storage path as the Instagram handle.)

- [ ] **Step 4: Add the new i18n keys to all four locales**

In `frontend/src/i18n/locales/en.json`, inside `steps.s1`, add alongside the existing `instagram`/`location` keys:

```json
"firstName": "First name",
"firstNamePlaceholder": "Your first name",
"lastName": "Last name",
"lastNamePlaceholder": "Your last name",
```

In `frontend/src/i18n/locales/fr.json`:

```json
"firstName": "Prénom",
"firstNamePlaceholder": "Votre prénom",
"lastName": "Nom de famille",
"lastNamePlaceholder": "Votre nom de famille",
```

In `frontend/src/i18n/locales/de.json`:

```json
"firstName": "Vorname",
"firstNamePlaceholder": "Dein Vorname",
"lastName": "Nachname",
"lastNamePlaceholder": "Dein Nachname",
```

In `frontend/src/i18n/locales/ar.json`:

```json
"firstName": "الاسم الأول",
"firstNamePlaceholder": "اسمك الأول",
"lastName": "اسم العائلة",
"lastNamePlaceholder": "اسم عائلتك",
```

- [ ] **Step 5: Wire the submission payload in `Apply.tsx`**

In `frontend/src/pages/Apply.tsx`:

Add `first_name: '', last_name: '',` to the `useForm` `defaultValues` object, alongside `instagram_handle: ''`:

```ts
    defaultValues: {
      first_name: '',
      last_name: '',
      instagram_handle: '',
      location: '',
      // ...rest unchanged...
```

Change `const [questionnaireVersion, setQuestionnaireVersion] = useState('1.1.0')` to:

```ts
  const [questionnaireVersion, setQuestionnaireVersion] = useState('1.2.0')
```

In `handleSubmit`, change the cast and add the two fields to the submitted `answers`:

```ts
      const result = await submitForm({
        questionnaireVersion: questionnaireVersion as '1.2.0',
        answers: {
          first_name: values.first_name,
          last_name: values.last_name,
          instagram_handle: values.instagram_handle,
          location: values.location,
          // ...rest unchanged...
```

- [ ] **Step 6: Run the frontend suite + typecheck**

Run: `bun run --cwd frontend vitest run && bun run typecheck`
Expected: PASS

- [ ] **Step 7: Manual smoke check**

Run: `bun run dev` (API + frontend). Submit a full application through `/apply` in the browser, confirm the new First name / Last name inputs appear on step 1 and the submission succeeds. Then, as an admin, confirm `GET /api/v1/admin/applicants/:id/identity` (via the ApplicantDetail "reveal" button — wired in Task 15) shows the name.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/form.ts frontend/src/steps/Step1Identity.tsx frontend/src/pages/Apply.tsx \
  frontend/src/i18n/locales/en.json frontend/src/i18n/locales/fr.json \
  frontend/src/i18n/locales/de.json frontend/src/i18n/locales/ar.json
git commit -m "feat(frontend): collect first/last name on the application form"
```

---

### Task 15: Display the revealed name in the admin panel + final verification

**Files:**
- Modify: `frontend/src/admin/pages/ApplicantDetail.tsx`
- Modify: `frontend/src/__tests__/integration/ApplicantDetail.vitest.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/__tests__/integration/ApplicantDetail.vitest.tsx`, find the test(s) that mock `fetchIdentity`'s resolved value (search for `instagramHandle`) and add `fullName` to the mocked response, plus a new assertion. For example, if the existing test reads:

```ts
mockFetchIdentity.mockResolvedValue({ instagramHandle: '@real_handle' })
```

change it to:

```ts
mockFetchIdentity.mockResolvedValue({ instagramHandle: '@real_handle', fullName: 'Jane Doe' })
```

and add, after the reveal button is clicked and the handle assertion:

```ts
expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run --cwd frontend vitest run src/__tests__/integration/ApplicantDetail.vitest.tsx`
Expected: FAIL — `fullName` isn't rendered yet

- [ ] **Step 3: Update the admin API client and `IdentityCard`**

In `frontend/src/admin/api/client.ts`, update `fetchIdentity`'s return type to include `fullName: string | null`, mirroring the `instagramHandle: string` field already there.

In `frontend/src/admin/pages/ApplicantDetail.tsx`'s `IdentityCard` component, update the revealed-state branch:

```tsx
        {identity ? (
          <div className="bg-warning-light border border-warning/30 rounded-xl p-4">
            {identity.fullName && <p className="text-sm font-medium text-primary">{identity.fullName}</p>}
            <p className="font-mono text-sm text-warning">{identity.instagramHandle}</p>
            <p className="text-xs text-muted mt-1.5">{t('admin.detail.auditNote')}</p>
          </div>
        ) : (
```

This requires changing the `identity` prop/state from `string | null` to `{ instagramHandle: string; fullName: string | null } | null` throughout `IdentityCard` and its parent — update `setIdentity(res.instagramHandle)` (in `handleReveal`) to `setIdentity(res)`, and the `identity` prop type and all its usages (`{identity}` text interpolation becomes `{identity.instagramHandle}`) accordingly. Search the file for every other reference to the `identity` state to catch all of them.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run --cwd frontend vitest run src/__tests__/integration/ApplicantDetail.vitest.tsx`
Expected: PASS

- [ ] **Step 5: Full-repo verification**

Run, from the repo root:

```bash
bun run typecheck
bun run test
```

Expected: both PASS — this is the final check across everything touched by both Part 1 and Part 2.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/admin/pages/ApplicantDetail.tsx frontend/src/admin/api/client.ts \
  frontend/src/__tests__/integration/ApplicantDetail.vitest.tsx
git commit -m "feat(frontend): show revealed full name in the admin identity card"
```

---

## Final checklist before handoff

- [ ] `bun run typecheck` passes at the repo root
- [ ] `bun run test` (API + frontend) passes at the repo root
- [ ] Manual smoke test: submit a new application, run a matching pass, accept a contact request, confirm the name + handle both reveal, wait (or fast-forward a test match's `datingStartedAt` directly in MongoDB) to confirm the day-3 cancel link and day-7 outcome buttons unlock on schedule
- [ ] Re-run `bun run --cwd api src/seeds/questionnaire.seed.ts` against every environment (`.env.dev`, `.env.test`, `.env.prod` as applicable) so the new questionnaire version is live everywhere this ships


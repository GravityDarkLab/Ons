# Warm dating experience + name reveal — design

## Problem

The post-match "dating" experience today is mechanically correct but emotionally cold:

- The outcome buttons ("It worked out ✓" / "It didn't") appear immediately once status is `dating`, with no time gating — nothing stops someone from bailing on day one.
- The account-deactivation copy (`DeletionCountdown.tsx`) reads like a countdown to data death, not a "we're here whenever you're ready" message.
- Mutual identity reveal only ever shows an Instagram handle — partners learn `@someones_handle` but never the other person's actual name.

This design covers two related changes:

1. A warmer, time-gated dating-outcome flow that behaves like a friend checking in rather than a status-tracking timer.
2. Capturing and mutually revealing first/last name alongside the Instagram handle, using the same privacy pattern (separate encrypted storage, audit-logged decryption).

## Part 1 — Warm dating experience

### Data model

Add to `MatchDoc` ([api/src/models/match.model.ts](../../../api/src/models/match.model.ts)):

```ts
datingStartedAt?: Date
```

Set once in `respondToContact` ([api/src/services/profile.service.ts](../../../api/src/services/profile.service.ts)) at the same moment `status` flips to `"dating"`. This is a stable anchor — unlike `updatedAt`, which changes for unrelated reasons (e.g. identity-view logging).

**Backward compatibility:** matches already in `"dating"` status predate this field. All gating logic reads `match.datingStartedAt ?? match.contactRespondedAt` (the latter is set at the same transition today, just not under this name) — no backfill migration needed.

### Gating logic

New helper in `match-state.service.ts`:

```ts
function daysSince(d: Date): number
```

- Outcome `"failed"` ("cancel" / "it's not working out"): allowed once `daysSince(anchor) >= 3`.
- Outcome `"success"` ("it worked"): allowed once `daysSince(anchor) >= 7`.

`reportOutcome` in `profile.service.ts` enforces both thresholds server-side (`AppError(..., 403)` if called too early) — the frontend hides ineligible buttons, but the API is the actual authority since it mutates applicant status.

### Frontend states (`MatchCard.tsx`, `status === 'dating'`)

Driven purely by `daysSince(datingStartedAt)`:

- **Day 0–2**: friendly check-in bubble — random pick from a fixed pool of ~6 question/encouragement pairs (style: a casual message from a friend, e.g. "Hey, how's it going with Sarra? Did you two grab that coffee we suggested?"). Re-rolled on each page load; no persistence.
- **Day 3–6**: check-in bubble continues, plus a quiet, low-emphasis "Things aren't working out?" link that reveals the early cancel/outcome-failed flow.
- **Day 7+**: bubble is replaced by both outcome options — "It worked 🎉" / "It's not working out 🤍".

### Outcome moment

- **Success**: celebratory copy + soft confetti-drift animation (CSS-only, gold/cream palette, matching `home-rise`/`shake` keyframe conventions in `index.css`). No further choice — applicant moves to `inactive` as today (warmer copy, see below).
- **Didn't work**: gentle fade-in heart-pulse animation + encouraging copy ("That's okay — not every match is the one. Thank you for giving it a real shot."), then a choice:
  - **Keep looking now** → `applied` (back in the pool immediately, as today).
  - **Take a break for a while** → `inactive` (today's existing deletion-countdown state, but with the rewritten warm copy from Part 1's tone change — not a new status).

This choice only appears on the "didn't work" branch — "it worked" already implies they're off the market, so it just lands on the celebratory copy and proceeds to `inactive` automatically (same as today's behavior).

### Optional outcome feedback ("didn't work" only)

`reportOutcome` accepts an optional payload:

```ts
outcomeFeedback?: { tags: string[]; note?: string }
```

Tags: `too_far`, `different_values`, `no_spark`, `something_else`. Stored on the match document, audit-logged like other writes. Never auto-mutates the applicant's stored answers — see the distance nudge below for the one case where it can lead to a suggested change.

**Distance nudge**: if `too_far` was selected and the applicant's `open_to_long_distance` is currently `false`, the next dashboard load shows a dismissible suggestion card ("Distance came up last time — want to open yourself up to long-distance matches?"). Shown once per qualifying match: `outcomeFeedback` gains a `nudgeAcknowledged?: boolean` field, set `true` as soon as the applicant taps either Yes or No (not just on Yes) — Yes also patches `open_to_long_distance` via the existing edit-answers path. The card's visibility query is "most recent failed match with `too_far` in its tags and `nudgeAcknowledged` not yet true." Nothing changes without an explicit tap; no other tag maps to a safe, concrete preference toggle today (`different_values` and `no_spark` only touch free-text/embedding fields), so no nudge is shown for those.

### Copy & tone

Three places get the friend-not-timer rewrite, in English first then translated to `fr`/`de`/`ar` per the existing i18n convention (all four locale files, every new key):

1. `DeletionCountdown.tsx` copy — replace "deletion in N days" framing with "we're here whenever you're ready, no rush."
2. The new check-in bubble pool (~6 entries).
3. The new outcome-moment copy (success / didn't-work / take-a-break choice).

### Animations

Two new CSS keyframes in `frontend/src/index.css`, following the existing `home-rise`/`shake` pattern — no new dependency:

- `confetti-drift` — a handful of small absolutely-positioned spans drifting upward + fading, gold/cream palette.
- `heart-pulse` — single scale+opacity pulse, ~1.2s, ease-out.

### Testing

- Unit: `daysSince` / gating helper (`match-state.service.test.ts`) — boundary cases at exactly day 3 and day 7, and just-under.
- Route: `profile.routes.test.ts` — `reportOutcome` 403-before-eligible-day cases for both thresholds.
- Frontend: `MatchCard` state selection (bubble / cancel-link / full outcome) as a pure function of `datingStartedAt`; distance-nudge visibility logic.

## Part 2 — First/last name capture & reveal

Same privacy pattern as the Instagram handle: never stored in `applicants`, encrypted separately, decryption audit-logged.

### Form

Add `first_name`, `last_name` to the sensitive (non-`answers`) part of the submit payload in [form.validator.ts](../../../api/src/validators/form.validator.ts), alongside `instagram_handle`. Validation: 1–50 chars, unicode-aware (`/^[\p{L}\p{M}'\- ]+$/u`) — must support accented and Arabic-script names, not just ASCII. Matching inputs added to `Step1Identity.tsx` above the Instagram field, with a parallel schema in `frontend/src/types/form.ts`.

### Storage

Additive, optional fields on `IdentityDoc` ([api/src/models/identity.model.ts](../../../api/src/models/identity.model.ts)):

```ts
encryptedFullName?: string;
fullNameIv?: string;
fullNameTag?: string;
```

Stored as a single `"First Last"` string, encrypted with its own fresh IV (never reusing the Instagram ciphertext's IV/key pair — AES-GCM nonce reuse breaks confidentiality guarantees). All fields optional, so identity records that predate this change simply have no name — reveal returns `fullName: null` for them, no backfill needed.

`storeIdentity` ([api/src/privacy/identity.service.ts](../../../api/src/privacy/identity.service.ts)) takes an additional optional `fullName?: string` parameter and encrypts it in the same write as the handle.

### Reveal

`revealIdentityById` / `resolveIdentityById` change return shape:

```ts
// before
Promise<string | null>
// after
Promise<{ instagram: string; fullName: string | null } | null>
```

Call sites to update (all already in scope for this change):

- `api/src/services/profile.service.ts` — `getMyMatches` (×1 via `resolveIdentityById`, ×1 via `revealIdentityById`), `respondToContact` (×2).
- `api/src/services/admin.service.ts` — `getApplicantIdentity` (×1).
- `api/src/controllers/admin.controller.ts` — response shape for the identity endpoint.

### Display

- `MatchView.partnerInstagram` (frontend) gains a sibling `partnerFullName?: string`.
- `MatchCard.tsx` shows the name as the primary label (e.g. "Sarra") with the Instagram handle as a secondary link, instead of just `@handle`.
- Admin's `IdentityCard` (`ApplicantDetail.tsx`) shows both name and handle once revealed.

### Testing

- Unit: `identity.service.test.ts` — encrypt/decrypt round-trip for `fullName`, `null` fallback for pre-existing records without one.
- Route/unit: update existing reveal-path tests in `profile.service` / `admin.service` test files for the new return shape.
- Frontend: `MatchCard` / `IdentityCard` render name + handle together once revealed.

## Out of scope (explicitly deferred)

- NLP-based parsing of the optional free-text feedback note — it's stored for human/admin context only, not auto-categorized.
- Auto-adjusting `different_values` or `no_spark` feedback into any preference field — no safe, concrete mapping exists today.
- A distinct "paused, will return" applicant status — "take a break" reuses the existing `inactive` state with rewritten copy, not a new status value.

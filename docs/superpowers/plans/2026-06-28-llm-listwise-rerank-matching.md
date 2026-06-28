# LLM Listwise-Rerank Matching Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the displayed compatibility score with an LLM-judged, listwise-reranked number, so the score people actually see stops being structurally capped by embedding-cosine geometry (see [design doc](../specs/2026-06-28-llm-listwise-rerank-matching-design.md)).

**Architecture:** The existing embedding+cosine pipeline (`scorer.ts`) is untouched and keeps doing what it's good at — cheap O(N) shortlisting across the whole applicant pool. A new service, `match-rerank.service.ts`, makes one LLM call per applicant covering that applicant's whole shortlist at once (listwise, not pairwise — per RankGPT/PRP), with a structured-output schema and an anchored 0–100 rubric, and that becomes the score actually shown. `engine.ts` wires the two stages together. No frontend changes are needed: `RankedCandidate.score` keeps its existing meaning and wire shape all the way through `proposals.ts` → `match.service.ts` → `MatchDoc.score` → the admin/applicant UI, which already renders that field — only what populates it changes.

**Tech Stack:** Bun, TypeScript, MongoDB, the `generateChatCompletion`/Structured Outputs pattern already built in `ai.service.ts` this session.

---

## File structure

| File | Responsibility |
|---|---|
| `api/src/services/profile-snippet.util.ts` (new) | Shared free-text profile summary builder — extracted from `match-summary.service.ts` so it isn't duplicated a third time in `match-rerank.service.ts` |
| `api/src/models/match-rerank.model.ts` (new) | `MatchRerankDoc` — the per-applicant rerank cache document shape |
| `api/src/services/match-rerank.service.ts` (new) | The listwise LLM call: prompt building, shortlist hashing, response parsing/validation, per-candidate fallback, caching |
| `api/src/db/collections.ts` (modify) | Register the new `match_reranks` collection + index |
| `api/src/matching/engine.ts` (modify) | `RankedCandidate` gains `embeddingScore`/`llmReasoning`; `getCandidates()`/`runFullMatchingPass()` call the new rerank stage before returning |
| `api/src/services/match-summary.service.ts` (modify) | Use the extracted `buildProfileSnippet` instead of its own local copy |
| `api/src/__tests__/unit/matching/proposals.test.ts` (modify) | Its `RankedCandidate` test fixture needs the two new required fields |
| `api/src/__tests__/unit/matching/engine.test.ts` (modify) | Its `db/collections.js` mock needs the new collection getter added |

---

### Task 1: Extract shared `buildProfileSnippet` helper

**Files:**
- Create: `api/src/services/profile-snippet.util.ts`
- Test: `api/src/__tests__/unit/services/profile-snippet.util.test.ts`
- Modify: `api/src/services/match-summary.service.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/src/__tests__/unit/services/profile-snippet.util.test.ts
//
// tested: profile-snippet.util buildProfileSnippet — the shared free-text
// profile summary used by match-summary.service.ts and (after Task 3)
// match-rerank.service.ts when building LLM prompts.
import { describe, it, expect } from "bun:test";
import { ObjectId } from "mongodb";
import { buildProfileSnippet } from "../../../services/profile-snippet.util.js";
import type { ApplicantDoc } from "../../../models/applicant.model.js";

function makeApplicant(answers: Record<string, unknown>): ApplicantDoc {
  return {
    _id: new ObjectId(),
    alias: "Test",
    questionnaireVersion: "1.2.0",
    answers,
    status: "applied",
    magicToken: "a".repeat(64),
    passwordHash: null,
    scoreThreshold: 0.8,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("buildProfileSnippet", () => {
  it("joins present fields with '. '", () => {
    const doc = makeApplicant({ location: "Paris, France", work: "Engineer" });
    expect(buildProfileSnippet(doc)).toBe("Location: Paris, France. Work: Engineer");
  });

  it("skips fields that are absent", () => {
    const doc = makeApplicant({ lifestyle: "Active and outdoorsy" });
    expect(buildProfileSnippet(doc)).toBe("Lifestyle: Active and outdoorsy");
  });

  it("returns a fallback string when no relevant fields are present", () => {
    const doc = makeApplicant({});
    expect(buildProfileSnippet(doc)).toBe("No profile details available.");
  });

  it("truncates a long field via truncateForPrompt", () => {
    const longText = "word ".repeat(100).trim();
    const doc = makeApplicant({ deal_breakers: longText });
    const result = buildProfileSnippet(doc);
    expect(result.startsWith("Deal breakers: ")).toBe(true);
    expect(result.length).toBeLessThan(longText.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `api/`): `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/profile-snippet.util.test.ts`
Expected: FAIL — `Cannot find module '../../../services/profile-snippet.util.js'`

- [ ] **Step 3: Implement `profile-snippet.util.ts`**

```ts
// api/src/services/profile-snippet.util.ts
import { truncateForPrompt } from "./ai.service.js";
import type { ApplicantDoc } from "../models/applicant.model.js";

/**
 * Builds a free-text summary of an applicant's answers for use in an LLM
 * prompt (match-summary, match-rerank). Shared so the field selection and
 * truncation behavior can't drift between callers.
 */
export function buildProfileSnippet(doc: ApplicantDoc): string {
  const a = doc.answers as Record<string, unknown>;
  const t = (v: unknown) => truncateForPrompt(String(v));
  const parts: string[] = [];
  if (a.location)                   parts.push(`Location: ${t(a.location)}`);
  if (a.work)                       parts.push(`Work: ${t(a.work)}`);
  if (a.religion)                   parts.push(`Religion: ${t(a.religion)}`);
  if (a.relationship_type)          parts.push(`Looking for: ${t(a.relationship_type)}`);
  if (a.vibe_words)                 parts.push(`Describes themselves as: ${t(a.vibe_words)}`);
  if (a.lifestyle)                  parts.push(`Lifestyle: ${t(a.lifestyle)}`);
  if (a.preferred_character_traits) parts.push(`Seeks in partner: ${t(a.preferred_character_traits)}`);
  if (a.deal_breakers)              parts.push(`Deal breakers: ${t(a.deal_breakers)}`);
  if (a.dream_first_date)           parts.push(`Dream first date: ${t(a.dream_first_date)}`);
  return parts.join(". ") || "No profile details available.";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/profile-snippet.util.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Update `match-summary.service.ts` to use the shared helper**

In `api/src/services/match-summary.service.ts`, replace the import line and delete the local `profileSnippet` function:

```ts
// Replace this line:
import { generateChatCompletion, truncateForPrompt } from "./ai.service.js";
// With:
import { generateChatCompletion } from "./ai.service.js";
import { buildProfileSnippet } from "./profile-snippet.util.js";
```

Delete the local function entirely:

```ts
function profileSnippet(doc: ApplicantDoc): string {
  const a = doc.answers as Record<string, unknown>;
  const t = (v: unknown) => truncateForPrompt(String(v));
  const parts: string[] = [];
  if (a.location)                  parts.push(`Location: ${t(a.location)}`);
  if (a.work)                      parts.push(`Work: ${t(a.work)}`);
  if (a.religion)                  parts.push(`Religion: ${t(a.religion)}`);
  if (a.relationship_type)         parts.push(`Looking for: ${t(a.relationship_type)}`);
  if (a.vibe_words)                parts.push(`Describes themselves as: ${t(a.vibe_words)}`);
  if (a.lifestyle)                 parts.push(`Lifestyle: ${t(a.lifestyle)}`);
  if (a.preferred_character_traits) parts.push(`Seeks in partner: ${t(a.preferred_character_traits)}`);
  if (a.deal_breakers)             parts.push(`Deal breakers: ${t(a.deal_breakers)}`);
  if (a.dream_first_date)          parts.push(`Dream first date: ${t(a.dream_first_date)}`);
  return parts.join(". ") || "No profile details available.";
}
```

And update its two call sites in the prompt template:

```ts
// Replace:
Person A: ${profileSnippet(a)}

Person B: ${profileSnippet(b)}
// With:
Person A: ${buildProfileSnippet(a)}

Person B: ${buildProfileSnippet(b)}
```

The `import type { ApplicantDoc } from "../models/applicant.model.js";` line in `match-summary.service.ts` stays — it's still used by the function signature of `getOrGenerateMatchSummary`'s internals (the `a`/`b` variables come from `applicantsCol.findOne`, typed via `ApplicantDoc | null`).

- [ ] **Step 6: Run the full relevant test suite + typecheck**

Run (from `api/`):
```bash
bun test --preload ./src/__tests__/setup.ts ./src/__tests__
bun run typecheck
```
Expected: all tests pass (4 new + every pre-existing test), `tsc --noEmit` exits 0, no unused-import warnings.

- [ ] **Step 7: Commit**

```bash
git add api/src/services/profile-snippet.util.ts api/src/__tests__/unit/services/profile-snippet.util.test.ts api/src/services/match-summary.service.ts
git commit -m "refactor(api): extract shared buildProfileSnippet helper for LLM prompts"
```

---

### Task 2: `MatchRerankDoc` model + collection plumbing

**Files:**
- Create: `api/src/models/match-rerank.model.ts`
- Modify: `api/src/db/collections.ts`

- [ ] **Step 1: Create the model**

```ts
// api/src/models/match-rerank.model.ts
import { ObjectId } from "mongodb";

/**
 * Caches the LLM listwise-rerank result for one applicant's shortlist, so
 * repeated admin views of GET /matching/candidates/:id don't re-call the LLM
 * every page load. Keyed by applicantId (one row per applicant, upserted);
 * shortlistHash + model detect staleness — see match-rerank.service.ts.
 */
export interface MatchRerankDoc {
  _id: ObjectId;
  applicantId: ObjectId;
  shortlistHash: string;
  model: string;
  rankings: { applicantId: string; score: number; reasoning: string }[];
  createdAt: Date;
}
```

- [ ] **Step 2: Register the collection in `db/collections.ts`**

Add the import at the top:

```ts
import type { MatchRerankDoc } from "../models/match-rerank.model.js";
```

Add to `COLLECTION_NAMES`:

```ts
export const COLLECTION_NAMES = {
  questionnaires: "questionnaires",
  applicants:     "applicants",
  identities:     "identities",
  auditLogs:      "audit_logs",
  embeddings:     "embeddings",
  admins:         "admins",
  matches:        "matches",
  appConfig:      "app_config",
  matchReranks:   "match_reranks",
} as const;
```

Add the getter (after `getAppConfigCollection`):

```ts
export function getMatchReranksCollection(db: Db): Collection<MatchRerankDoc> {
  return db.collection<MatchRerankDoc>(COLLECTION_NAMES.matchReranks);
}
```

Add the index in `ensureIndexes`, after the `matches` index block:

```ts
  const matchReranks = getMatchReranksCollection(db);
  await _createIndexIfNotExists(matchReranks, { applicantId: 1 }, { unique: true });
```

- [ ] **Step 3: Typecheck**

Run (from `api/`): `bun run typecheck`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add api/src/models/match-rerank.model.ts api/src/db/collections.ts
git commit -m "feat(api): add MatchRerankDoc model and match_reranks collection"
```

---

### Task 3: `match-rerank.service.ts`

**Files:**
- Create: `api/src/services/match-rerank.service.ts`
- Test: `api/src/__tests__/unit/services/match-rerank.service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// api/src/__tests__/unit/services/match-rerank.service.test.ts
//
// tested: match-rerank.service — buildRerankPrompt, computeShortlistHash, and
// rerankCandidates' caching/parsing/fallback behavior. The LLM call
// (generateChatCompletion) and the cache collection are both mocked.
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";
import type { ApplicantDoc } from "../../../models/applicant.model.js";
import type { MatchRerankDoc } from "../../../models/match-rerank.model.js";

let cachedDoc: MatchRerankDoc | null = null;
const fakeRerankCol = {
  findOne:  mock(async (_f: unknown) => cachedDoc),
  updateOne: mock(async (_f: unknown, _u: unknown, _o: unknown) => ({})),
};

mock.module("../../../db/connection.js", () => ({
  getDb:   async () => ({}),
  closeDb: async () => {},
}));

mock.module("../../../db/collections.js", () => ({
  COLLECTION_NAMES: {},
  getMatchReranksCollection: () => fakeRerankCol,
}));

let chatResponse = "";
const mockGenerateChatCompletion = mock(async (_prompt: string, _opts?: unknown) => chatResponse);
mock.module("../../../services/ai.service.js", () => ({
  generateChatCompletion: mockGenerateChatCompletion,
  truncateForPrompt: (s: string) => s,
}));

import {
  rerankCandidates,
  buildRerankPrompt,
  computeShortlistHash,
  type RerankCandidateInput,
} from "../../../services/match-rerank.service.js";

function makeApplicant(answers: Record<string, unknown> = {}): ApplicantDoc {
  return {
    _id: new ObjectId(),
    alias: "Test",
    questionnaireVersion: "1.2.0",
    answers,
    status: "applied",
    magicToken: "a".repeat(64),
    passwordHash: null,
    scoreThreshold: 0.8,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  cachedDoc = null;
  chatResponse = "";
  fakeRerankCol.findOne.mockClear();
  fakeRerankCol.updateOne.mockClear();
  mockGenerateChatCompletion.mockClear();
});

describe("buildRerankPrompt", () => {
  it("includes the target's snippet, each candidate's id and snippet, and the rubric bands", () => {
    const target = makeApplicant({ lifestyle: "Quiet homebody" });
    const candidate = makeApplicant({ lifestyle: "Loves the outdoors" });
    const prompt = buildRerankPrompt(target, [{ id: candidate._id.toHexString(), doc: candidate }]);

    expect(prompt).toContain("Quiet homebody");
    expect(prompt).toContain(candidate._id.toHexString());
    expect(prompt).toContain("Loves the outdoors");
    expect(prompt).toContain("90-100");
    expect(prompt).toContain("0-29");
  });
});

describe("computeShortlistHash", () => {
  it("is stable regardless of input order", () => {
    const a = { id: "a", embeddingScore: 0.5 };
    const b = { id: "b", embeddingScore: 0.7 };
    expect(computeShortlistHash([a, b])).toBe(computeShortlistHash([b, a]));
  });

  it("changes when a score changes", () => {
    const h1 = computeShortlistHash([{ id: "a", embeddingScore: 0.5 }]);
    const h2 = computeShortlistHash([{ id: "a", embeddingScore: 0.51 }]);
    expect(h1).not.toBe(h2);
  });

  it("changes when membership changes", () => {
    const h1 = computeShortlistHash([{ id: "a", embeddingScore: 0.5 }]);
    const h2 = computeShortlistHash([{ id: "a", embeddingScore: 0.5 }, { id: "b", embeddingScore: 0.5 }]);
    expect(h1).not.toBe(h2);
  });
});

describe("rerankCandidates", () => {
  it("returns an empty array without calling the LLM when there are no candidates", async () => {
    const target = makeApplicant();
    const result = await rerankCandidates(target, []);
    expect(result).toEqual([]);
    expect(mockGenerateChatCompletion).not.toHaveBeenCalled();
  });

  it("returns the embedding score as a fallback when the LLM call fails (empty response)", async () => {
    chatResponse = "";
    const target = makeApplicant();
    const candidate = makeApplicant();
    const input: RerankCandidateInput[] = [{ doc: candidate, embeddingScore: 0.42 }];

    const result = await rerankCandidates(target, input);
    expect(result).toEqual([
      { applicantId: candidate._id.toHexString(), score: 0.42, reasoning: "" },
    ]);
  });

  it("returns the embedding score as a fallback when the LLM response is malformed JSON", async () => {
    chatResponse = "not json";
    const target = makeApplicant();
    const candidate = makeApplicant();
    const result = await rerankCandidates(target, [{ doc: candidate, embeddingScore: 0.3 }]);
    expect(result).toEqual([
      { applicantId: candidate._id.toHexString(), score: 0.3, reasoning: "" },
    ]);
  });

  it("converts a valid LLM score (0-100) to the 0-1 scale and keeps its reasoning", async () => {
    const target = makeApplicant();
    const candidate = makeApplicant();
    const id = candidate._id.toHexString();
    chatResponse = JSON.stringify({
      rankings: [{ candidateId: id, score: 82, reasoning: "Strong lifestyle overlap." }],
    });

    const result = await rerankCandidates(target, [{ doc: candidate, embeddingScore: 0.3 }]);
    expect(result).toEqual([{ applicantId: id, score: 0.82, reasoning: "Strong lifestyle overlap." }]);
  });

  it("falls back to the embedding score for only the candidate missing from a partial LLM response", async () => {
    const target = makeApplicant();
    const present = makeApplicant();
    const missing = makeApplicant();
    chatResponse = JSON.stringify({
      rankings: [{ candidateId: present._id.toHexString(), score: 70, reasoning: "Good fit." }],
    });

    const result = await rerankCandidates(target, [
      { doc: present, embeddingScore: 0.2 },
      { doc: missing, embeddingScore: 0.55 },
    ]);

    expect(result).toEqual([
      { applicantId: present._id.toHexString(), score: 0.7, reasoning: "Good fit." },
      { applicantId: missing._id.toHexString(), score: 0.55, reasoning: "" },
    ]);
  });

  it("falls back to the embedding score for a candidate whose LLM score isn't a finite number", async () => {
    const target = makeApplicant();
    const candidate = makeApplicant();
    const id = candidate._id.toHexString();
    chatResponse = JSON.stringify({
      rankings: [{ candidateId: id, score: "not a number", reasoning: "irrelevant" }],
    });

    const result = await rerankCandidates(target, [{ doc: candidate, embeddingScore: 0.6 }]);
    expect(result).toEqual([{ applicantId: id, score: 0.6, reasoning: "" }]);
  });

  it("clamps an out-of-range LLM score into [0, 100] before converting", async () => {
    const target = makeApplicant();
    const candidate = makeApplicant();
    const id = candidate._id.toHexString();
    chatResponse = JSON.stringify({ rankings: [{ candidateId: id, score: 140, reasoning: "x" }] });

    const result = await rerankCandidates(target, [{ doc: candidate, embeddingScore: 0.1 }]);
    expect(result[0].score).toBe(1);
  });

  it("returns a cached result without calling the LLM when the shortlist hash and model match", async () => {
    const target = makeApplicant();
    const candidate = makeApplicant();
    const id = candidate._id.toHexString();
    const input: RerankCandidateInput[] = [{ doc: candidate, embeddingScore: 0.4 }];
    const hash = computeShortlistHash([{ id, embeddingScore: 0.4 }]);

    cachedDoc = {
      _id: new ObjectId(),
      applicantId: target._id,
      shortlistHash: hash,
      model: "local:gpt-4o-mini", // matches RERANK_MODEL in test env (see setup.ts)
      rankings: [{ applicantId: id, score: 0.91, reasoning: "cached" }],
      createdAt: new Date(),
    };

    const result = await rerankCandidates(target, input);
    expect(result).toEqual([{ applicantId: id, score: 0.91, reasoning: "cached" }]);
    expect(mockGenerateChatCompletion).not.toHaveBeenCalled();
  });

  it("ignores a cache entry whose shortlist hash doesn't match and calls the LLM", async () => {
    const target = makeApplicant();
    const candidate = makeApplicant();
    const id = candidate._id.toHexString();
    cachedDoc = {
      _id: new ObjectId(),
      applicantId: target._id,
      shortlistHash: "stale-hash",
      model: "local:gpt-4o-mini",
      rankings: [{ applicantId: id, score: 0.91, reasoning: "stale" }],
      createdAt: new Date(),
    };
    chatResponse = JSON.stringify({ rankings: [{ candidateId: id, score: 60, reasoning: "fresh" }] });

    const result = await rerankCandidates(target, [{ doc: candidate, embeddingScore: 0.4 }]);
    expect(result).toEqual([{ applicantId: id, score: 0.6, reasoning: "fresh" }]);
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("still returns a result when the cache read throws", async () => {
    fakeRerankCol.findOne.mockImplementation(async () => {
      throw new Error("connection reset");
    });
    const target = makeApplicant();
    const candidate = makeApplicant();
    const id = candidate._id.toHexString();
    chatResponse = JSON.stringify({ rankings: [{ candidateId: id, score: 55, reasoning: "ok" }] });

    const result = await rerankCandidates(target, [{ doc: candidate, embeddingScore: 0.4 }]);
    expect(result).toEqual([{ applicantId: id, score: 0.55, reasoning: "ok" }]);
  });

  it("still returns a result when the cache write throws", async () => {
    fakeRerankCol.updateOne.mockImplementation(async () => {
      throw new Error("write conflict");
    });
    const target = makeApplicant();
    const candidate = makeApplicant();
    const id = candidate._id.toHexString();
    chatResponse = JSON.stringify({ rankings: [{ candidateId: id, score: 55, reasoning: "ok" }] });

    const result = await rerankCandidates(target, [{ doc: candidate, embeddingScore: 0.4 }]);
    expect(result).toEqual([{ applicantId: id, score: 0.55, reasoning: "ok" }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `api/`): `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/match-rerank.service.test.ts`
Expected: FAIL — `Cannot find module '../../../services/match-rerank.service.js'`

- [ ] **Step 3: Implement `match-rerank.service.ts`**

```ts
// api/src/services/match-rerank.service.ts
import { createHash } from "crypto";
import { getDb } from "../db/connection.js";
import { getMatchReranksCollection } from "../db/collections.js";
import { generateChatCompletion } from "./ai.service.js";
import { buildProfileSnippet } from "./profile-snippet.util.js";
import { env } from "../config/env.js";
import type { ApplicantDoc } from "../models/applicant.model.js";

const RERANK_MODEL = `${env.embeddingProvider}:${env.openaiChatModel}`;

export interface RerankCandidateInput {
  doc: ApplicantDoc;
  /** 0-1, the pre-rerank embedding-stage score — used as this candidate's fallback. */
  embeddingScore: number;
}

export interface RerankResult {
  applicantId: string;
  /** 0-1, same scale as the rest of the codebase. */
  score: number;
  reasoning: string;
}

const RUBRIC = `  90-100: rare, near-ideal overlap across values, lifestyle, and what each person is looking for
  70-89:  strong compatibility with minor differences
  50-69:  average — some genuine alignment, some real friction
  30-49:  significant mismatches in core preferences or lifestyle
  0-29:   fundamental incompatibility`;

/**
 * Builds the listwise rerank prompt: one target, the whole shortlist at
 * once — see docs/superpowers/specs/2026-06-28-llm-listwise-rerank-matching-design.md
 * for why listwise (not pairwise/pointwise) framing is used.
 */
export function buildRerankPrompt(
  target: ApplicantDoc,
  candidates: { id: string; doc: ApplicantDoc }[],
): string {
  const candidateLines = candidates
    .map((c, i) => `${i + 1}. id="${c.id}": ${buildProfileSnippet(c.doc)}`)
    .join("\n");

  return `You are an expert matchmaker. Score how compatible each candidate below is with the target person, grounded only in what's stated — do not invent details. Use the full range; a shortlist usually spans several bands:

${RUBRIC}

Target: ${buildProfileSnippet(target)}

Candidates:
${candidateLines}

Respond with a ranking entry for every candidate listed above, using their exact id.`;
}

/**
 * Hashes the shortlist's composition (which candidates, at what embedding
 * score) so a cached rerank result can be invalidated automatically when
 * the underlying pool or ranking shifts. Order-independent.
 */
export function computeShortlistHash(
  candidates: { id: string; embeddingScore: number }[],
): string {
  const normalized = candidates
    .map((c) => `${c.id}:${c.embeddingScore.toFixed(4)}`)
    .sort()
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value)) / 100;
}

/**
 * Scores a target applicant's embedding-stage shortlist with a single LLM
 * call covering the whole list at once. Never throws — on any failure (LLM
 * call, parsing, cache I/O) falls back to each candidate's embeddingScore
 * with empty reasoning, per-candidate where possible. The matching pipeline
 * must never block on this.
 */
export async function rerankCandidates(
  target: ApplicantDoc,
  candidates: RerankCandidateInput[],
): Promise<RerankResult[]> {
  if (candidates.length === 0) return [];

  const entries = candidates.map((c) => ({
    id:             c.doc._id.toHexString(),
    embeddingScore: c.embeddingScore,
  }));
  const shortlistHash = computeShortlistHash(entries);
  const fallback = (): RerankResult[] =>
    candidates.map((c) => ({
      applicantId: c.doc._id.toHexString(),
      score:       c.embeddingScore,
      reasoning:   "",
    }));

  const db = await getDb();
  const col = getMatchReranksCollection(db);
  const targetOid = target._id;

  try {
    const cached = await col.findOne({ applicantId: targetOid });
    if (cached && cached.shortlistHash === shortlistHash && cached.model === RERANK_MODEL) {
      return cached.rankings;
    }
  } catch (err) {
    console.error("[match-rerank] Cache read failed, proceeding without it:", err);
  }

  const prompt = buildRerankPrompt(
    target,
    candidates.map((c) => ({ id: c.doc._id.toHexString(), doc: c.doc })),
  );

  const raw = await generateChatCompletion(prompt, {
    temperature: 0.3, // grounded judgment, not creative writing
    responseSchema: {
      name: "match_rerank",
      schema: {
        type: "object",
        properties: {
          rankings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                candidateId: { type: "string" },
                score:       { type: "number" },
                reasoning:   { type: "string" },
              },
              required: ["candidateId", "score", "reasoning"],
              additionalProperties: false,
            },
          },
        },
        required: ["rankings"],
        additionalProperties: false,
      },
    },
  });

  if (!raw) return fallback();

  let rankings: RerankResult[];
  try {
    const parsed = JSON.parse(raw) as {
      rankings?: { candidateId?: unknown; score?: unknown; reasoning?: unknown }[];
    };
    if (!Array.isArray(parsed.rankings)) return fallback();

    const byId = new Map(
      parsed.rankings
        .filter((r): r is { candidateId: string; score: unknown; reasoning: unknown } =>
          typeof r.candidateId === "string")
        .map((r) => [r.candidateId, r]),
    );

    rankings = candidates.map((c) => {
      const id = c.doc._id.toHexString();
      const r = byId.get(id);
      const score = r ? clampScore(r.score) : null;
      const reasoning = score !== null && r && typeof r.reasoning === "string" ? r.reasoning.trim() : "";
      return {
        applicantId: id,
        score:       score ?? c.embeddingScore,
        reasoning,
      };
    });
  } catch {
    return fallback();
  }

  try {
    await col.updateOne(
      { applicantId: targetOid },
      { $set: { applicantId: targetOid, shortlistHash, model: RERANK_MODEL, rankings, createdAt: new Date() } },
      { upsert: true },
    );
  } catch (err) {
    console.error("[match-rerank] Cache write failed:", err);
  }

  return rankings;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test --preload ./src/__tests__/setup.ts ./src/__tests__/unit/services/match-rerank.service.test.ts`
Expected: PASS — 15 tests

- [ ] **Step 5: Typecheck**

Run (from `api/`): `bun run typecheck`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add api/src/services/match-rerank.service.ts api/src/__tests__/unit/services/match-rerank.service.test.ts
git commit -m "feat(api): add LLM listwise-rerank service for match scoring"
```

---

### Task 4: Wire reranking into `engine.ts`

**Files:**
- Modify: `api/src/matching/engine.ts`
- Modify: `api/src/__tests__/unit/matching/proposals.test.ts`
- Modify: `api/src/__tests__/unit/matching/engine.test.ts`

- [ ] **Step 1: Update `RankedCandidate` and add the rerank-application helper**

In `api/src/matching/engine.ts`, add the import (after the existing `scorer.js` import):

```ts
import { rerankCandidates } from "../services/match-rerank.service.js";
```

Replace the `RankedCandidate` interface:

```ts
export interface RankedCandidate {
  alias: string;
  applicantId: string;
  /** The displayed score (0-1) — from the LLM rerank stage, or the embedding
   *  score unchanged if reranking failed/was skipped. */
  score: number;
  breakdown: Record<string, number>;
  /** The pre-rerank embedding-cosine score (0-1) — kept for debugging/transparency. */
  embeddingScore: number;
  /** Short grounded explanation from the LLM rerank stage; "" if unavailable. */
  llmReasoning: string;
}
```

Add this helper after `applyFilters` and before `getCandidates`:

```ts
const SHORTLIST_SIZE = 15;

interface EmbeddingRanked {
  alias: string;
  applicantId: string;
  score: number;
  breakdown: Record<string, number>;
}

/**
 * Takes the embedding-ranked list (already sorted desc), shortlists it,
 * reranks the shortlist with the LLM, and returns the final topN sorted by
 * the (now LLM-derived) displayed score. Never throws — falls back to the
 * embedding order/score if the rerank call itself errors.
 */
async function applyRerank(
  target: ApplicantDoc,
  embeddingRanked: EmbeddingRanked[],
  docsById: Map<string, ApplicantDoc>,
  topN: number,
): Promise<RankedCandidate[]> {
  const shortlist = embeddingRanked.slice(0, Math.max(topN, SHORTLIST_SIZE));
  if (shortlist.length === 0) return [];

  let results: { applicantId: string; score: number; reasoning: string }[];
  try {
    results = await rerankCandidates(
      target,
      shortlist.map((c) => ({ doc: docsById.get(c.applicantId)!, embeddingScore: c.score })),
    );
  } catch (err) {
    console.error("[engine] Rerank failed, falling back to embedding order:", err);
    results = [];
  }
  const byId = new Map(results.map((r) => [r.applicantId, r]));

  const reranked: RankedCandidate[] = shortlist.map((c) => {
    const r = byId.get(c.applicantId);
    return {
      alias:          c.alias,
      applicantId:    c.applicantId,
      breakdown:      c.breakdown,
      embeddingScore: c.score,
      score:          r ? r.score : c.score,
      llmReasoning:   r ? r.reasoning : "",
    };
  });

  return reranked.sort((a, b) => b.score - a.score).slice(0, topN);
}
```

- [ ] **Step 2: Use it in `getCandidates`**

Replace:

```ts
  await prepare([target, ...compatible], questionnaire);

  const scored: RankedCandidate[] = compatible.map((other) => {
    const result = score(target, other, questionnaire);
    return {
      alias:       other.alias,
      applicantId: other._id.toHexString(),
      score:       result.score,
      breakdown:   result.breakdown,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}
```

With:

```ts
  await prepare([target, ...compatible], questionnaire);

  const embeddingRanked: EmbeddingRanked[] = compatible
    .map((other) => {
      const result = score(target, other, questionnaire);
      return {
        alias:       other.alias,
        applicantId: other._id.toHexString(),
        score:       result.score,
        breakdown:   result.breakdown,
      };
    })
    .sort((a, b) => b.score - a.score);

  const docsById = new Map(compatible.map((d) => [d._id.toHexString(), d]));
  return applyRerank(target, embeddingRanked, docsById, topN);
}
```

- [ ] **Step 3: Use it in `runFullMatchingPass`**

Replace the per-applicant loop body:

```ts
  for (const applicant of eligible) {
    const others = eligible.filter((o) => !o._id.equals(applicant._id));
    const compatible = applyFilters(applicant, others);

    const scored: RankedCandidate[] = compatible.map((other) => {
      const result = score(applicant, other, questionnaire);
      return {
        alias:       other.alias,
        applicantId: other._id.toHexString(),
        score:       result.score,
        breakdown:   result.breakdown,
      };
    });

    results[applicant._id.toHexString()] = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
```

With:

```ts
  for (const applicant of eligible) {
    const others = eligible.filter((o) => !o._id.equals(applicant._id));
    const compatible = applyFilters(applicant, others);

    const embeddingRanked: EmbeddingRanked[] = compatible
      .map((other) => {
        const result = score(applicant, other, questionnaire);
        return {
          alias:       other.alias,
          applicantId: other._id.toHexString(),
          score:       result.score,
          breakdown:   result.breakdown,
        };
      })
      .sort((a, b) => b.score - a.score);

    const docsById = new Map(compatible.map((d) => [d._id.toHexString(), d]));
    results[applicant._id.toHexString()] = await applyRerank(applicant, embeddingRanked, docsById, 10);
  }
```

- [ ] **Step 4: Fix the `RankedCandidate` fixture in `proposals.test.ts`**

In `api/src/__tests__/unit/matching/proposals.test.ts`, update the `candidate()` helper to satisfy the two new required fields (proposals.ts itself only reads `score`/`breakdown`/`applicantId`/`alias`, so defaulting these is correct and doesn't change any test's meaning):

```ts
function candidate(of: ApplicantDoc, score: number, breakdown: Record<string, number> = {}): RankedCandidate {
  return {
    alias: of.alias,
    applicantId: of._id.toHexString(),
    score,
    breakdown,
    embeddingScore: score,
    llmReasoning: "",
  };
}
```

- [ ] **Step 5: Add the new collection getter to `engine.test.ts`'s mock**

In `api/src/__tests__/unit/matching/engine.test.ts`, `engine.ts` now imports `match-rerank.service.ts`, which imports `getMatchReranksCollection` from `db/collections.js` — add it to the existing mock so the import chain resolves cleanly (this test only exercises `getActiveContactApplicantIds`, so the function is never called, but the mock object should still expose it):

```ts
mock.module("../../../db/collections.js", () => ({
  COLLECTION_NAMES: {},
  getMatchesCollection:        () => fakeMatchesCol,
  getApplicantsCollection:     () => ({}),
  getQuestionnairesCollection: () => ({}),
  getIdentitiesCollection:     () => ({}),
  getAuditLogsCollection:      () => ({}),
  getEmbeddingsCollection:     () => ({}),
  getAdminsCollection:         () => ({}),
  getAppConfigCollection:      () => ({}),
  getMatchReranksCollection:   () => ({}),
  ensureIndexes:               async () => {},
}));
```

- [ ] **Step 6: Run the full suite + typecheck**

Run (from `api/`):
```bash
bun run typecheck
bun test --preload ./src/__tests__/setup.ts ./src/__tests__
```
Expected: `tsc --noEmit` exits 0; all tests pass.

Note: per the existing convention documented in `engine.test.ts`'s header comment and `proposals.test.ts`'s import comment, `getCandidates`/`runFullMatchingPass` are not unit-tested directly — route tests `mock.module()` the whole `engine.js` facade, which would silently replace these functions in a full-suite run if a test imported the real ones. This wiring is verified by: (a) the type system (Step 6's typecheck), (b) the already-thorough `match-rerank.service.test.ts` coverage of the actual new logic, and (c) the existing `tests/smoke/match-flow.smoke.ts` end-to-end smoke test, which exercises the real `runFullMatchingPass`/`getCandidates` against a live DB.

- [ ] **Step 7: Commit**

```bash
git add api/src/matching/engine.ts api/src/__tests__/unit/matching/proposals.test.ts api/src/__tests__/unit/matching/engine.test.ts
git commit -m "feat(api): rerank embedding shortlist with a listwise LLM call before returning candidates"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full clean-clone simulation (matches this session's earlier CI-discrepancy fix)**

```bash
cd /tmp && rm -rf ons-verify && git clone /Users/achraf.labidi/personal-github/Ons ons-verify && cd ons-verify
bun install
bun run typecheck
bun run test:api
```
Expected: all green, exactly as in the working tree.

- [ ] **Step 2: Report final test count and confirm no stray uncommitted files**

Run (from the original working tree, `api/`): `git status --short`
Expected: clean — nothing untracked or modified outside what was committed in Tasks 1-4.

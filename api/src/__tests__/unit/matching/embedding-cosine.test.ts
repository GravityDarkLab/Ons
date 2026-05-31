import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock only the DB-touching embedding service. The provider singleton is
// never actually called (getOrComputeEmbeddings is fully mocked), so we
// leave provider.ts unmodified to avoid contaminating provider.test.ts.
mock.module("../../../services/embedding.service.js", () => ({
  embedApplicant: mock(async () => {}),
  getOrComputeEmbeddings: mock(async () => new Map()),
}));

import { embeddingCosineAlgorithm } from "../../../matching/algorithms/embedding-cosine.js";
import { getOrComputeEmbeddings } from "../../../services/embedding.service.js";
import { makeApplicant, makeQuestionnaire, FULL_ANSWERS } from "./_fixtures.js";
import { ObjectId } from "mongodb";

const q = makeQuestionnaire();

// Helper to build unit vectors for controlled cosine tests
function unitVec(dim: number, index: number): number[] {
  const v = new Array(dim).fill(0);
  v[index] = 1.0;
  return v;
}

// Helper: populate the embedding cache for given applicants via prepare()
async function prepareWithVecs(
  applicants: ReturnType<typeof makeApplicant>[],
  vecFn: (id: string) => { profile: number[]; preference: number[]; dealBreakers: number[] }
) {
  const embMap = new Map(
    applicants.map((a) => {
      const id = a._id.toHexString();
      return [
        id,
        {
          _id: new ObjectId(),
          applicantId: a._id,
          provider: "test",
          model: "test-model",
          createdAt: new Date(),
          ...vecFn(id),
        },
      ];
    })
  );

  (getOrComputeEmbeddings as ReturnType<typeof mock>).mockImplementation(async () => embMap);
  await embeddingCosineAlgorithm.prepare!(applicants, q);
}

describe("embedding-cosine — score() without prepare()", () => {
  it("throws when embeddings are not in cache", () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    // Don't call prepare() — cache should be empty after module load
    expect(() => embeddingCosineAlgorithm.score(a, b, q)).toThrow(/prepare/i);
  });
});

describe("embedding-cosine — prepare() + score() pipeline", () => {
  it("does not throw after prepare() is called", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);

    await prepareWithVecs([a, b], () => ({
      profile: [1.0, 0.0, 0.0],
      preference: [1.0, 0.0, 0.0],
      dealBreakers: [0.0, 0.0, 1.0],
    }));

    expect(() => embeddingCosineAlgorithm.score(a, b, q)).not.toThrow();
  });

  it("identical embedding vectors → score = 1.0", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);

    const sameVec = { profile: [1.0, 0.0], preference: [1.0, 0.0], dealBreakers: [0.0, 1.0] };
    await prepareWithVecs([a, b], () => sameVec);

    const { score } = embeddingCosineAlgorithm.score(a, b, q);
    expect(score).toBe(1.0);
  });

  it("orthogonal profile vectors → lifestyle_similarity = 0", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    const ids = [a._id.toHexString(), b._id.toHexString()];

    await prepareWithVecs([a, b], (id) => ({
      profile:      id === ids[0] ? unitVec(2, 0) : unitVec(2, 1), // orthogonal
      preference:   [1.0, 0.0],
      dealBreakers: [0.0, 1.0],
    }));

    const { breakdown } = embeddingCosineAlgorithm.score(a, b, q);
    expect(breakdown.lifestyle_similarity).toBe(0);
  });

  it("deal breaker overlapping profile → deal_breaker_penalty < 1", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    const ids = [a._id.toHexString(), b._id.toHexString()];

    // A's deal breakers = same direction as B's profile → high overlap = bad
    await prepareWithVecs([a, b], (id) => ({
      profile:      id === ids[1] ? [1.0, 0.0] : [0.0, 1.0],
      preference:   [1.0, 0.0],
      dealBreakers: id === ids[0] ? [1.0, 0.0] : [0.0, 1.0], // A's breaks = B's profile
    }));

    const { breakdown } = embeddingCosineAlgorithm.score(a, b, q);
    expect(breakdown.deal_breaker_penalty).toBeLessThan(1.0);
  });

  it("score is always in [0, 1]", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant({ relationship_type: "Short Term", open_to_long_distance: false });

    await prepareWithVecs([a, b], (id) => {
      const isA = id === a._id.toHexString();
      return {
        profile:      isA ? [1.0, 0.0] : [0.0, 1.0],
        preference:   isA ? [0.5, 0.5] : [1.0, 0.0],
        dealBreakers: isA ? [1.0, 0.0] : [0.0, 1.0],
      };
    });

    const { score } = embeddingCosineAlgorithm.score(a, b, q);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("score is rounded to 2 decimal places", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    await prepareWithVecs([a, b], () => ({
      profile: [0.6, 0.8],
      preference: [0.3, 0.7],
      dealBreakers: [0.0, 1.0],
    }));

    const { score } = embeddingCosineAlgorithm.score(a, b, q);
    expect(score).toBe(Math.round(score * 100) / 100);
  });

  it("breakdown contains the expected 6 keys", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);
    await prepareWithVecs([a, b], () => ({
      profile: [1.0, 0.0],
      preference: [1.0, 0.0],
      dealBreakers: [0.0, 1.0],
    }));

    const { breakdown } = embeddingCosineAlgorithm.score(a, b, q);
    expect(Object.keys(breakdown)).toEqual(
      expect.arrayContaining([
        "numeric_compatibility",
        "lifestyle_similarity",
        "character_cross_match",
        "character_a_wants_b",
        "character_b_wants_a",
        "deal_breaker_penalty",
      ])
    );
  });
});

describe("embedding-cosine — prepare() internals", () => {
  it("calls getOrComputeEmbeddings with the given applicants", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);

    const spy = getOrComputeEmbeddings as ReturnType<typeof mock>;
    spy.mockClear();
    await prepareWithVecs([a, b], () => ({
      profile: [1.0, 0.0],
      preference: [1.0, 0.0],
      dealBreakers: [0.0, 1.0],
    }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [calledWith] = spy.mock.calls[0] as [typeof a[]];
    expect(calledWith).toHaveLength(2);
  });

  it("applicants with no stored embedding are not scored (cache miss is skipped)", async () => {
    const a = makeApplicant(FULL_ANSWERS);
    const b = makeApplicant(FULL_ANSWERS);

    // Return an empty map → no embeddings stored
    (getOrComputeEmbeddings as ReturnType<typeof mock>).mockResolvedValueOnce(new Map());
    await embeddingCosineAlgorithm.prepare!([a, b], q);

    // Both applicants missing from cache → score() should throw
    expect(() => embeddingCosineAlgorithm.score(a, b, q)).toThrow();
  });
});

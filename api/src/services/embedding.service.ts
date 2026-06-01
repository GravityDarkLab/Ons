/**
 * Embedding Service
 * ==================
 * Handles persisting and loading applicant embedding vectors.
 *
 * ## Lifecycle
 *
 *   1. Applicant submits form → embedApplicant() is called fire-and-forget.
 *      The submission returns immediately; embedding happens in the background.
 *
 *   2. Matching run starts → prepare() calls getOrComputeEmbeddings().
 *      - Applicants whose embeddings are already stored → loaded from DB (no API call).
 *      - Applicants with missing or stale embeddings (model changed) → computed
 *        in a single batch request and saved to DB.
 *
 * ## Stale detection
 *
 *   The `model` field in EmbeddingDoc is compared against the currently
 *   configured EMBEDDING_MODEL. If they differ, the stored vectors are in a
 *   different space and cannot be compared with new ones — they are re-computed
 *   and overwritten automatically.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { getEmbeddingsCollection } from "../db/collections.js";
import { getEmbeddingProvider } from "../matching/embeddings/provider.js";
import type { EmbeddingDoc } from "../models/embedding.model.js";

// ─── Text field extraction ────────────────────────────────────────────────────

function str(answers: Record<string, unknown>, key: string): string {
  const v = answers[key];
  return typeof v === "string" ? v.trim() : "";
}

function buildTexts(answers: Record<string, unknown>): {
  profile: string;
  preference: string;
  dealBreakers: string;
} {
  return {
    profile: [str(answers, "lifestyle"), str(answers, "vibe_words")]
      .filter(Boolean)
      .join(" — "),
    preference: [
      str(answers, "preferred_character_traits"),
      str(answers, "preferred_physical_traits"),
    ]
      .filter(Boolean)
      .join(" — "),
    dealBreakers: str(answers, "deal_breakers"),
  };
}

// ─── Persist ──────────────────────────────────────────────────────────────────

async function saveEmbedding(
  applicantId: ObjectId,
  provider: string,
  model: string,
  vectors: { profile: number[]; preference: number[]; dealBreakers: number[] }
): Promise<void> {
  const db = await getDb();
  const col = getEmbeddingsCollection(db);

  await col.updateOne(
    { applicantId },
    {
      $set: {
        applicantId,
        provider,
        model,
        profile: vectors.profile,
        preference: vectors.preference,
        dealBreakers: vectors.dealBreakers,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes and persists embeddings for a single applicant.
 * Called fire-and-forget from form.service after submission — never throws
 * to the caller.
 */
export async function embedApplicant(
  applicantId: ObjectId,
  answers: Record<string, unknown>
): Promise<void> {
  const provider = getEmbeddingProvider();
  const texts = buildTexts(answers);

  const [profile, preference, dealBreakers] = await provider.embedBatch([
    texts.profile,
    texts.preference,
    texts.dealBreakers,
  ]);

  await saveEmbedding(applicantId, provider.name, provider.model, {
    profile,
    preference,
    dealBreakers,
  });
}

/**
 * Loads stored embeddings for the given applicants.
 * Computes and saves any that are missing or stale (different model).
 * Returns a map of applicantId hex → EmbeddingDoc.
 *
 * Used by the embedding-cosine algorithm's prepare() step.
 */
export async function getOrComputeEmbeddings(
  applicants: { _id: ObjectId; answers: Record<string, unknown> }[]
): Promise<Map<string, EmbeddingDoc>> {
  if (applicants.length === 0) return new Map();

  const provider = getEmbeddingProvider();
  const db = await getDb();
  const col = getEmbeddingsCollection(db);

  // Load whatever is already stored
  const ids = applicants.map((a) => a._id);
  const stored = await col.find({ applicantId: { $in: ids } }).toArray();

  const storedByApplicant = new Map(
    stored.map((d) => [d.applicantId.toHexString(), d])
  );

  // Identify applicants that need (re-)embedding
  const stale = applicants.filter((a) => {
    const existing = storedByApplicant.get(a._id.toHexString());
    return !existing || existing.model !== provider.model;
  });

  if (stale.length > 0) {
    console.log(
      `[embedding] Computing ${stale.length} missing/stale embeddings ` +
      `(model: ${provider.model})...`
    );

    const profileTexts    = stale.map((a) => buildTexts(a.answers).profile);
    const preferenceTexts = stale.map((a) => buildTexts(a.answers).preference);
    const dealBreakerTexts = stale.map((a) => buildTexts(a.answers).dealBreakers);

    const [profileEmbs, preferenceEmbs, dealBreakerEmbs] = await Promise.all([
      provider.embedBatch(profileTexts),
      provider.embedBatch(preferenceTexts),
      provider.embedBatch(dealBreakerTexts),
    ]);

    // Persist and update local map
    await Promise.all(
      stale.map(async (applicant, i) => {
        const vectors = {
          profile:      profileEmbs[i],
          preference:   preferenceEmbs[i],
          dealBreakers: dealBreakerEmbs[i],
        };

        await saveEmbedding(
          applicant._id,
          provider.name,
          provider.model,
          vectors
        );

        const doc: EmbeddingDoc = {
          _id: new ObjectId(),
          applicantId: applicant._id,
          provider: provider.name,
          model: provider.model,
          ...vectors,
          createdAt: new Date(),
        };
        storedByApplicant.set(applicant._id.toHexString(), doc);
      })
    );

    console.log(`[embedding] Done. ${stale.length} embeddings saved.`);
  }

  return storedByApplicant;
}

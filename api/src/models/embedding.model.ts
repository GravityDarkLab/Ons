import { ObjectId } from "mongodb";

/**
 * Stores pre-computed embedding vectors for one applicant.
 *
 * Three vectors are stored per applicant:
 *   profile      — lifestyle + vibe_words  (who they are)
 *   preference   — preferred_character + preferred_physical  (who they want)
 *   dealBreakers — deal_breakers  (what they can't tolerate)
 *
 * provider + model are stored so the matching engine can detect and
 * discard stale embeddings when the configured model changes.
 */
export interface EmbeddingDoc {
  _id: ObjectId;
  applicantId: ObjectId;
  provider: string; // "openai" | "local"
  model: string;    // e.g. "text-embedding-3-small"
  profile: number[];
  preference: number[];
  dealBreakers: number[];
  createdAt: Date;
}

#!/usr/bin/env bun
/**
 * One-time migration: update applicant statuses and backfill instagramHash.
 *
 * Changes:
 *   - applicants: "active"     → "applied"
 *   - applicants: "withdrawn"  → "inactive"
 *   - identities: backfill instagramHash for rows that don't have it yet
 *
 * Usage:
 *   bun run api/src/seeds/migrate-statuses.ts
 *
 * Safe to run multiple times — already-migrated documents are unchanged.
 */

import { getDb, closeDb } from "../db/connection.js";
import { getApplicantsCollection, getIdentitiesCollection } from "../db/collections.js";
import { decrypt } from "../privacy/encryption.js";
import { hashInstagram } from "../privacy/hash.js";
import { hashMagicToken } from "../privacy/magic-token.js";
import { env } from "../config/env.js";

if (env.nodeEnv === "production") {
  // Allow in production but warn — it's a genuine migration, not seed data
  console.warn("[migrate] ⚠️  Running in production — proceed with caution.");
}

async function migrate() {
  console.log("[migrate] Connecting to database...");
  const db = await getDb();

  // ── 1. Applicant status rename ────────────────────────────────────────────
  const appCol = getApplicantsCollection(db);

  const { modifiedCount: activeFixed } = await appCol.updateMany(
    { status: "active" as any },
    { $set: { status: "applied" } }
  );
  console.log(`[migrate] applicants: "active" → "applied": ${activeFixed} updated`);

  const { modifiedCount: withdrawnFixed } = await appCol.updateMany(
    { status: "withdrawn" as any },
    { $set: { status: "inactive" } }
  );
  console.log(`[migrate] applicants: "withdrawn" → "inactive": ${withdrawnFixed} updated`);

  // ── 2. Backfill instagramHash on identities ────────────────────────────────
  const idCol = getIdentitiesCollection(db);

  const missing = await idCol
    .find({ instagramHash: { $exists: false } })
    .toArray();

  console.log(`[migrate] identities: ${missing.length} rows missing instagramHash`);

  let backfilled = 0;
  for (const doc of missing) {
    try {
      const plain = decrypt(doc.encryptedInstagram, doc.encryptionIv, doc.encryptionTag);
      const hash  = hashInstagram(plain);
      await idCol.updateOne({ _id: doc._id }, { $set: { instagramHash: hash } });
      backfilled++;
    } catch (err) {
      console.error(`[migrate] Failed to backfill identity ${doc._id}:`, err);
    }
  }

  console.log(`[migrate] identities: backfilled ${backfilled}/${missing.length} hashes`);

  // ── 3. Backfill magicToken placeholder on applicants that lack it ──────────
  // (seed data and old records won't have it; the real value is set at submission)
  const noToken = await appCol.countDocuments({ magicToken: { $exists: false } });
  if (noToken > 0) {
    // Insert a stub — these users cannot log in until they re-submit or are reset
    const result = await appCol.updateMany(
      { magicToken: { $exists: false } },
      { $set: { magicToken: hashMagicToken(""), passwordHash: "", scoreThreshold: 0.8 } }
    );
    console.log(`[migrate] applicants: backfilled magicToken stub on ${result.modifiedCount} rows`);
  }

  // ── 4. NOTE: plaintext magicToken migration ───────────────────────────────
  // If there are applicants whose magicToken was stored in plaintext (before the
  // hash-on-write change), those tokens cannot be re-hashed here (SHA-256 is
  // one-way). Affected users would need to re-submit the form.
  // This project was not deployed with plaintext tokens in production, so no
  // action is needed. Add logic here if rolling out to a live dataset.

  console.log("[migrate] ✅  Migration complete.");
  await closeDb();
}

migrate().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});

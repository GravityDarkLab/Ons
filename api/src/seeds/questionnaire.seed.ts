/**
 * Seeds the questionnaire into MongoDB.
 * Run with: bun run src/seeds/questionnaire.seed.ts
 *
 * Options:
 *   --clean   drop all existing questionnaires before seeding (full reset)
 *
 * This script is idempotent without --clean — it upserts by version.
 */

import { ObjectId } from "mongodb";
import { getDb, closeDb } from "../db/connection.js";
import { getQuestionnairesCollection } from "../db/collections.js";
import type { QuestionnaireDoc } from "../models/questionnaire.model.js";
import { QUESTIONNAIRE_VERSION, SECTIONS } from "../questionnaire/questions.js";

const CLEAN = process.argv.includes("--clean");

const questionnaire: Omit<QuestionnaireDoc, "_id" | "createdAt" | "updatedAt"> = {
  version: QUESTIONNAIRE_VERSION,
  name: "Matching Form v2",
  isActive: true,
  sections: SECTIONS,
};

async function seed() {
  console.log("[SEED] Starting questionnaire seed...");
  console.log(`[SEED] Clean mode: ${CLEAN}`);

  const db = await getDb();
  const col = getQuestionnairesCollection(db);

  if (CLEAN) {
    const { deletedCount } = await col.deleteMany({});
    console.log(`[SEED] Deleted ${deletedCount} existing questionnaire(s).`);
  } else {
    // Deactivate all existing questionnaires before inserting the new one
    await col.updateMany({}, { $set: { isActive: false, updatedAt: new Date() } });
  }

  const result = await col.updateOne(
    { version: questionnaire.version },
    {
      $set: {
        ...questionnaire,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log(
      `[SEED] Created questionnaire v${questionnaire.version} (id: ${result.upsertedId})`
    );
  } else {
    console.log(
      `[SEED] Updated questionnaire v${questionnaire.version}`
    );
  }

  console.log("[SEED] Done.");
  await closeDb();
}

seed().catch((err) => {
  console.error("[SEED] Fatal error:", err);
  process.exit(1);
});

/**
 * Seeds the initial questionnaire v1.0.0 into MongoDB.
 * Run with: bun run src/seeds/questionnaire.seed.ts
 *
 * This script is idempotent — it upserts by version.
 */

import { ObjectId } from "mongodb";
import { getDb, closeDb } from "../db/connection.js";
import { getQuestionnairesCollection } from "../db/collections.js";
import type { QuestionnaireDoc } from "../models/questionnaire.model.js";

const questionnaire: Omit<QuestionnaireDoc, "_id"> = {
  version: "1.0.0",
  name: "Matching Form v1",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  sections: [
    {
      id: "identity",
      title: "Your Identity",
      order: 1,
      questions: [
        {
          id: "instagram_handle",
          label: "Instagram Handle",
          type: "text",
          sensitive: true,
          required: true,
          order: 1,
          placeholder: "@yourhandle",
        },
      ],
    },
    {
      id: "basics",
      title: "The Basics",
      order: 2,
      questions: [
        {
          id: "location",
          label: "Where are you based?",
          type: "text",
          sensitive: false,
          required: true,
          order: 1,
          placeholder: "City, Country",
        },
        {
          id: "age",
          label: "Age",
          type: "number",
          sensitive: false,
          required: true,
          order: 2,
          min: 18,
          max: 100,
        },
        {
          id: "height_cm",
          label: "Height (cm)",
          type: "number",
          sensitive: false,
          required: false,
          order: 3,
          min: 100,
          max: 250,
        },
        {
          id: "work",
          label: "What do you do for work?",
          type: "text",
          sensitive: false,
          required: true,
          order: 4,
          placeholder: "e.g. Software Engineer, Teacher",
        },
        {
          id: "gender_identity",
          label: "Gender Identity",
          type: "select",
          sensitive: false,
          required: true,
          order: 5,
          options: [
            "Male",
            "Female",
            "Non-binary",
            "Genderqueer",
            "Prefer not to say",
            "Other",
          ],
        },
        {
          id: "sexual_orientation",
          label: "Sexual Orientation",
          type: "select",
          sensitive: false,
          required: true,
          order: 6,
          options: [
            "Straight",
            "Gay",
            "Lesbian",
            "Bisexual",
            "Pansexual",
            "Asexual",
            "Prefer not to say",
            "Other",
          ],
        },
        {
          id: "religion",
          label: "Religion / Spirituality",
          type: "text",
          sensitive: false,
          required: true,
          order: 7,
          placeholder: "e.g. Muslim, Christian, Agnostic, Atheist",
        },
      ],
    },
    {
      id: "about_you",
      title: "About You",
      order: 3,
      questions: [
        {
          id: "vibe_words",
          label: "Describe your vibe in 3 words",
          type: "text",
          sensitive: false,
          required: true,
          order: 1,
          placeholder: "e.g. curious, calm, funny",
        },
        {
          id: "lifestyle",
          label: "Describe your lifestyle",
          type: "text",
          sensitive: false,
          required: true,
          order: 2,
          placeholder: "e.g. Social drinker, non-smoker",
        },
      ],
    },
    {
      id: "relationship_preferences",
      title: "Relationship Preferences",
      order: 4,
      questions: [
        {
          id: "relationship_type",
          label: "What type of relationship are you looking for?",
          type: "select",
          sensitive: false,
          required: true,
          order: 1,
          options: ["Long Term", "Short Term", "Open to Both", "Casual", "Not Sure"],
        },
        {
          id: "open_to_long_distance",
          label: "Are you open to long distance?",
          type: "boolean",
          sensitive: false,
          required: true,
          order: 2,
        },
        {
          id: "preferred_physical_traits",
          label: "Preferred physical traits in a partner",
          type: "textarea",
          sensitive: false,
          required: true,
          order: 3,
          placeholder: "e.g. Athletic, tall",
        },
        {
          id: "preferred_character_traits",
          label: "Preferred character traits in a partner",
          type: "textarea",
          sensitive: false,
          required: true,
          order: 4,
          placeholder: "e.g. Ambitious, kind, funny",
        },
        {
          id: "deal_breakers",
          label: "Deal breakers",
          type: "textarea",
          sensitive: false,
          required: true,
          order: 5,
          placeholder: "e.g. Dishonesty, smoking",
        },
        {
          id: "okay_with_opposite_gender_friends",
          label: "Okay with partner having friends of opposite gender?",
          type: "boolean",
          sensitive: false,
          required: true,
          order: 6,
        },
        {
          id: "religion_deal_breaker",
          label: "Is different religion a deal breaker?",
          type: "boolean",
          sensitive: false,
          required: true,
          order: 7,
        },
        {
          id: "physical_affection_importance",
          label: "How important is physical affection to you? (1–10)",
          type: "range",
          sensitive: false,
          required: true,
          order: 8,
          min: 1,
          max: 10,
        },
        {
          id: "dream_first_date",
          label: "Describe your dream first date",
          type: "textarea",
          sensitive: false,
          required: true,
          order: 9,
          placeholder: "e.g. Coffee at a bookstore, then a walk by the river",
        },
      ],
    },
    {
      id: "disclaimer",
      title: "Disclaimer",
      order: 5,
      questions: [
        {
          id: "disclaimer_agreed",
          label:
            "I agree that my data will be used solely for the purpose of this matching exercise and will be handled with care.",
          type: "boolean",
          sensitive: false,
          required: true,
          order: 1,
        },
      ],
    },
  ],
};

async function seed() {
  console.log("[SEED] Starting questionnaire seed...");

  const db = await getDb();
  const col = getQuestionnairesCollection(db);

  // Deactivate all existing questionnaires before inserting the new one
  await col.updateMany({}, { $set: { isActive: false, updatedAt: new Date() } });

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

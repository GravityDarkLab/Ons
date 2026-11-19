#!/usr/bin/env bun
/**
 * Populates the database with realistic fake applicants for dev/test.
 *
 * Usage (from repo root):
 *   bun run seed:applicants          → dev  (default)
 *   bun run seed:applicants:test     → test
 *
 * Safety: refuses to run against NODE_ENV=production.
 *
 * Options:
 *   --count=<n>   number of applicants to insert (default: 50)
 *   --clear       wipe existing applicants + identities before seeding
 */

import { ObjectId } from "mongodb";
import { getDb, closeDb } from "../db/connection.js";
import {
  getApplicantsCollection,
  getIdentitiesCollection,
  getMatchesCollection,
} from "../db/collections.js";
import { generateUniqueAlias } from "../privacy/alias.generator.js";
import { encrypt } from "../privacy/encryption.js";
import { hashInstagram, normalizeInstagram } from "../privacy/hash.js";
import { hashMagicToken } from "../privacy/magic-token.js";
import { env } from "../config/env.js";
import { QUESTIONNAIRE_VERSION, QUESTIONS } from "../questionnaire/questions.js";
import { DEFAULT_SCORE_THRESHOLD } from "../services/match-state.service.js";

// ─── Safety guard ─────────────────────────────────────────────────────────────

if (env.nodeEnv === "production") {
  console.error("[SEED:applicants] ❌  Refusing to run in production.");
  process.exit(1);
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith("--count="));
const COUNT = countArg ? parseInt(countArg.split("=")[1], 10) : 50;
const CLEAR = args.includes("--clear");

// ─── Data pools ───────────────────────────────────────────────────────────────

const LOCATIONS = [
  "Paris, France",
  "London, UK",
  "New York, USA",
  "Dubai, UAE",
  "München, Germany",
  "Barcelona, Spain",
  "Dresden, Germany",
  "Casablanca, Morocco",
  "Tunis, Tunisia",
  "Montreal, Canada",
  "Lyon, France",
  "Berlin, Germany",
  "Madrid, Spain",
  "Amsterdam, Netherlands",
  "Brussels, Belgium",
  "Toronto, Canada",
  "Rabat, Morocco",
  "Bizerte, Tunisia",
  "Nabeul, Tunisia",
  "Djerba, Tunisia",
  "Marseille, France",
  "Algiers, Algeria",
  "Beirut, Lebanon",
  "Istanbul, Turkey",
  "Stockholm, Sweden",
  "Geneva, Switzerland",
  "Milan, Italy",
];

const INSTAGRAM_PREFIXES = [
  "its", "the", "just", "hey", "hi", "iam", "im", "real", "official",
  "only", "not", "", "", "", "",
];

const FIRST_NAMES = [
  "adam", "sami", "lina", "rania", "karim", "nour", "omar", "sarah",
  "ali", "leila", "youssef", "amira", "ines", "mehdi", "yasmine",
  "emma", "lucas", "sofia", "james", "mia", "noah", "chloe", "leo",
  "julia", "max", "anna", "tom", "nina", "alex", "zara",
];

const LAST_NAMES = [
  "Ben Ali", "Trabelsi", "Haddad", "Khelifi", "Mansour", "Saidi",
  "Martin", "Bernard", "Dubois", "Schmidt", "Weber", "Fischer",
  "Smith", "Johnson", "Garcia", "Lopez", "Hernandez", "Khan",
];

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(randomFloat() * arr.length)];
}

function pickBool(trueChance = 0.5): boolean {
  return randomFloat() < trueChance;
}

function randInt(min: number, max: number): number {
  return Math.floor(randomFloat() * (max - min + 1)) + min;
}

/** YYYY-MM-DD for someone between minAge and maxAge years old today. */
function randomBirthDate(minAge: number, maxAge: number): string {
  const age = randInt(minAge, maxAge);
  const today = new Date();
  const year = today.getUTCFullYear() - age;
  const month = randInt(1, 12);
  const day = randInt(1, 28); // stay safe for February
  // Keep the birthday in the past so the age holds today
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - age, today.getUTCMonth(), today.getUTCDate()));
  const finalDate = candidate > cutoff ? new Date(Date.UTC(year - 1, month - 1, day)) : candidate;
  return finalDate.toISOString().slice(0, 10);
}

/** Picks a value by weight: `[[value, weight], …]`. */
function pickWeighted<T>(choices: readonly (readonly [T, number])[]): T {
  let roll = randomFloat() * choices.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, weight] of choices) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return choices[choices.length - 1]![0];
}

const PARTNER_PREFERENCE = [["fine", 5], ["rather_not", 3], ["deal_breaker", 2]] as const;

/**
 * A complete, valid v2 answer set. Every tap question gets a uniformly random
 * option from the definitions; a few are then re-weighted so the seeded pool
 * looks like a plausible community instead of pure noise.
 */
function randomAnswers(): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  for (const q of QUESTIONS) {
    if (q.type === "select") answers[q.id] = pick(q.options!).value;
    else if (q.type === "range") answers[q.id] = randInt(q.min!, q.max!);
    else if (q.type === "boolean") answers[q.id] = pickBool();
    else if (q.type === "multiselect") {
      const pool = q.options!.map((o) => o.value);
      answers[q.id] = Array.from({ length: q.maxSelect! }, () => pool.splice(randInt(0, pool.length - 1), 1)[0]);
    }
  }

  return {
    ...answers,
    location: pick(LOCATIONS),
    birth_date: randomBirthDate(21, 38),
    gender_identity: pickWeighted([["Male", 48], ["Female", 48], ["Non-binary", 4]]),
    sexual_orientation: pickWeighted([["Straight", 85], ["Gay", 6], ["Bisexual", 7], ["Other", 2]]),
    religion: pickWeighted([
      ["muslim", 55], ["christian", 12], ["not_religious", 12], ["spiritual", 10],
      ["jewish", 3], ["other", 4], ["prefer_not_to_say", 4],
    ]),
    relationship_type: pickWeighted([["Long Term", 55], ["Open to Both", 20], ["Short Term", 8], ["Casual", 7], ["Not Sure", 10]]),
    wants_children: pickWeighted([["want", 45], ["open", 25], ["not_sure", 18], ["dont_want", 12]]),
    smoking: pickWeighted([["never", 65], ["sometimes", 20], ["regularly", 15]]),
    alcohol: pickWeighted([["never", 50], ["sometimes", 38], ["regularly", 12]]),
    partner_smoking: pickWeighted(PARTNER_PREFERENCE),
    partner_alcohol: pickWeighted(PARTNER_PREFERENCE),
    religion_match: pickWeighted([["fine", 4], ["rather_share", 4], ["deal_breaker", 2]]),
    open_to_long_distance: pickBool(0.45),
    age_gap: pickWeighted([["3", 2], ["5", 4], ["10", 3], ["any", 2]]),
    age_direction: pickWeighted([["either", 7], ["older", 2], ["younger", 1]]),
    disclaimer_agreed: true,
  };
}

function fakeInstagram(): string {
  const prefix = pick(INSTAGRAM_PREFIXES);
  const name = pick(FIRST_NAMES);
  const suffix = pickBool(0.4) ? String(randInt(10, 99)) : "";
  return `@${prefix}${name}${suffix}`.replace("@@", "@");
}

function randomCreatedAt(): Date {
  const msAgo = randomFloat() * 90 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - msAgo);
}

type SeedApplicantStatus = "applied" | "matched" | "dating" | "inactive";

// ─── Main ─────────────────────────────────────────────────────────────────────

// All seeded accounts share one login credential for easy local testing.
// Override with SEED_LOGIN env var; default is intentionally trivial (dev only).
const seedLogin = process.env.SEED_LOGIN ?? "ons-dev-seed";

async function seed() {
  console.log(`[SEED:applicants] Environment : ${env.nodeEnv}`);
  console.log(`[SEED:applicants] Target count : ${COUNT}`);
  console.log(`[SEED:applicants] Clear first  : ${CLEAR}\n`);

  const db = await getDb();
  const applicants = getApplicantsCollection(db);
  const identities = getIdentitiesCollection(db);
  const matches    = getMatchesCollection(db);

  // Hash once; reused for every inserted applicant
  const devPasswordHash = await Bun.password.hash(seedLogin);

  if (CLEAR) {
    const { deletedCount: a } = await applicants.deleteMany({});
    const { deletedCount: i } = await identities.deleteMany({});
    const { deletedCount: m } = await matches.deleteMany({});
    console.log(`[SEED:applicants] Cleared ${a} applicants, ${i} identities, ${m} matches.\n`);
  }

  const existingAliases = await applicants
    .find({}, { projection: { alias: 1 } })
    .map((d) => d.alias)
    .toArray();

  // Track used instagram hashes to avoid duplicate key errors within this seed run
  const usedHashes = new Set<string>();

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < COUNT; i++) {
    const alias = generateUniqueAlias(existingAliases);
    existingAliases.push(alias);

    const createdAt = randomCreatedAt();

    // Generate a unique-enough handle for seed data
    let handle: string;
    let instagramHash: string;
    let attempts = 0;
    do {
      handle = fakeInstagram() + (attempts > 0 ? String(randInt(100, 999)) : "");
      instagramHash = hashInstagram(handle);
      attempts++;
    } while (usedHashes.has(instagramHash) && attempts < 20);
    usedHashes.add(instagramHash);

    const fullName = `${capitalize(pick(FIRST_NAMES))} ${pick(LAST_NAMES)}`;

    const answers = randomAnswers();

    const applicantId = new ObjectId();

    try {
      const rawToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
      const status = "applied" as SeedApplicantStatus;
      await applicants.insertOne({
        _id: applicantId,
        alias,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        answers,
        status,
        magicToken: hashMagicToken(rawToken),
        passwordHash: devPasswordHash,
        scoreThreshold: DEFAULT_SCORE_THRESHOLD,
        createdAt,
        updatedAt: createdAt,
      });

      const { encrypted, iv, tag } = encrypt(normalizeInstagram(handle));
      // Fresh IV for the name ciphertext too — never reuse the handle's.
      const { encrypted: encName, iv: ivName, tag: tagName } = encrypt(fullName);
      await identities.insertOne({
        _id: new ObjectId(),
        applicantId,
        alias,
        encryptedInstagram: encrypted,
        encryptionIv: iv,
        encryptionTag: tag,
        instagramHash,
        encryptedFullName: encName,
        fullNameIv: ivName,
        fullNameTag: tagName,
        createdAt,
      });

      inserted++;
      console.log(`[SEED:applicants] ${inserted}/${COUNT}  alias: ${alias}  status: ${status}  token: ${rawToken}`);
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  console.log(`\n[SEED:applicants] ✅  Done — ${inserted} inserted, ${skipped} skipped.`);
  console.log(`[SEED:applicants] Login credential for all accounts: "${seedLogin}"`);
  await closeDb();
}

seed().catch((err) => {
  console.error("\n[SEED:applicants] Fatal error:", err);
  process.exit(1);
});

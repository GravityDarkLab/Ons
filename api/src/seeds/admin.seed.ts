/**
 * Creates a new admin account interactively.
 * Run via: bun run seed admin
 *
 * Prompts for username, password (hidden), and role then upserts the record.
 * Safe to re-run — updating an existing username changes only the fields provided.
 */

import * as readline from "readline";
import { ObjectId } from "mongodb";
import { getDb, closeDb } from "../db/connection.js";
import { getAdminsCollection } from "../db/collections.js";
import { ADMIN_ROLES, type AdminRole } from "../models/admin.model.js";
import { env } from "../config/env.js";

// ─── Safety guard ─────────────────────────────────────────────────────────────

if (env.nodeEnv === "production") {
  console.error("[SEED:admin] ❌  Refusing to run in production.");
  process.exit(1);
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function ask(question: string, hidden = false): Promise<string> {
  // Passing output=undefined suppresses readline's echo — clean way to hide passwords.
  const rl = readline.createInterface({
    input:  process.stdin,
    output: hidden ? undefined : process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) process.stdout.write(question);
    rl.question(hidden ? "" : question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n[SEED:admin] Create / update an admin account\n");

  const username = await ask("Username: ");
  if (!username) {
    console.error("[SEED:admin] Username cannot be empty.");
    process.exit(1);
  }

  const password = await ask("Password (hidden): ", true);
  if (password.length < 8) {
    console.error("[SEED:admin] Password must be at least 8 characters.");
    process.exit(1);
  }

  console.log(`\nRoles: ${ADMIN_ROLES.join(" | ")}`);
  const roleInput = await ask("Role [admin]: ");
  const role: AdminRole = ADMIN_ROLES.includes(roleInput as AdminRole)
    ? (roleInput as AdminRole)
    : "admin";

  const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });
  const now          = new Date();

  const db  = await getDb();
  const col = getAdminsCollection(db);

  const result = await col.updateOne(
    { username },
    {
      $set:         { passwordHash, role, updatedAt: now },
      $setOnInsert: { _id: new ObjectId(), username, createdAt: now },
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log(`\n[SEED:admin] ✅  Created admin "${username}" with role "${role}".`);
  } else {
    console.log(`\n[SEED:admin] ✅  Updated admin "${username}" (role: "${role}").`);
  }

  await closeDb();
}

seed().catch((err) => {
  console.error("[SEED:admin] Fatal error:", err);
  process.exit(1);
});

#!/usr/bin/env bun
/**
 * Seeds the questionnaire into MongoDB.
 * Runs inside the api/ workspace so it has access to api dependencies and env.
 *
 * Usage:
 *   bun run seed
 *   # or directly:
 *   bun run scripts/seed.ts
 *
 * Requires api/.env to be configured (MONGODB_URI etc).
 */

import { resolve } from "path";

const apiDir = resolve(import.meta.dir, "../api");

console.log("[seed] Running questionnaire seed via api workspace…\n");

const proc = Bun.spawn(
  ["bun", "run", "src/seeds/questionnaire.seed.ts"],
  {
    cwd: apiDir,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  }
);

const code = await proc.exited;
process.exit(code);

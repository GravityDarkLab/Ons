#!/usr/bin/env bun
/**
 * Seeds the questionnaire into MongoDB.
 *
 * Usage:
 *   bun run seed              → uses api/.env.dev (default)
 *   bun run seed dev          → api/.env.dev
 *   bun run seed test         → api/.env.test
 *   bun run seed prod         → api/.env.prod
 *
 * Bun's --env-file flag loads the file before running the seed,
 * so no manual dotenv parsing is needed.
 */

const VALID_ENVS = ["dev", "test", "prod"] as const;
type Env = (typeof VALID_ENVS)[number];

const arg = process.argv[2];

if (arg && !VALID_ENVS.includes(arg as Env)) {
  console.error(`[seed] Unknown environment: "${arg}"`);
  console.error(`[seed] Valid options: ${VALID_ENVS.join(", ")}`);
  process.exit(1);
}

const env: Env = (arg as Env) ?? "dev";
const envFile = `.env.${env}`;
const apiDir  = new URL("../api", import.meta.url).pathname;

console.log(`[seed] Environment : ${env}`);
console.log(`[seed] Env file    : api/${envFile}`);
console.log(`[seed] Working dir : ${apiDir}\n`);

const proc = Bun.spawn(
  ["bun", `--env-file=${envFile}`, "run", "src/seeds/questionnaire.seed.ts"],
  {
    cwd: apiDir,
    stdout: "inherit",
    stderr: "inherit",
  }
);

process.exit(await proc.exited);

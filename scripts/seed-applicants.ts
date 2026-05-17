#!/usr/bin/env bun
/**
 * Wrapper that picks the right .env file then runs applicants.seed.ts.
 *
 * Usage:
 *   bun run seed:applicants                     → api/.env.dev  (default)
 *   bun run seed:applicants:test                → api/.env.test
 *
 *   # Extra flags are forwarded to the seed script:
 *   bun run seed:applicants -- --count=200
 *   bun run seed:applicants -- --count=100 --clear
 */

const VALID_ENVS = ["dev", "test"] as const;
type Env = (typeof VALID_ENVS)[number];

const arg = process.argv[2];

// Only treat the first arg as an env name if it matches; otherwise it's a flag
// forwarded to the seed script (e.g. --count=50).
const isEnvArg = arg && !arg.startsWith("--") && VALID_ENVS.includes(arg as Env);

if (arg && !arg.startsWith("--") && !isEnvArg) {
  console.error(`[seed:applicants] Unknown environment: "${arg}"`);
  console.error(`[seed:applicants] Valid options: ${VALID_ENVS.join(", ")}`);
  process.exit(1);
}

const env: Env = isEnvArg ? (arg as Env) : "dev";
const envFile = `.env.${env}`;
const apiDir = new URL("../api", import.meta.url).pathname;

// Extra flags (everything after the optional env arg)
const extraArgs = isEnvArg ? process.argv.slice(3) : process.argv.slice(2);

console.log(`[seed:applicants] Environment : ${env}`);
console.log(`[seed:applicants] Env file    : api/${envFile}`);
if (extraArgs.length) console.log(`[seed:applicants] Flags       : ${extraArgs.join(" ")}`);
console.log();

const proc = Bun.spawn(
  [
    "bun",
    `--env-file=${envFile}`,
    "run",
    "src/seeds/applicants.seed.ts",
    ...extraArgs,
  ],
  {
    cwd: apiDir,
    stdout: "inherit",
    stderr: "inherit",
  }
);

process.exit(await proc.exited);

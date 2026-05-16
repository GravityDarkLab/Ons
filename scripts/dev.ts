#!/usr/bin/env bun
/**
 * Starts api + frontend dev servers in parallel.
 * Each service's output is prefixed with a coloured [label].
 *
 * Usage:
 *   bun run dev              # both
 *   bun run dev:api          # api only (via root package.json)
 *   bun run dev:frontend     # frontend only
 */

// import.meta.dir = .../matching/scripts — no "path" import needed
const ROOT = new URL("..", import.meta.url).pathname;

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";

const SERVICES = [
  { name: "api",      color: "\x1b[36m", cwd: ROOT + "api" },
  { name: "frontend", color: "\x1b[35m", cwd: ROOT + "frontend" },
];

async function pipeWithLabel(
  stream: ReadableStream<Uint8Array>,
  label: string,
  out: NodeJS.WriteStream
) {
  const reader  = stream.getReader();
  const decoder = new TextDecoder();
  let   buf     = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buf) out.write(label + buf + "\n");
      break;
    }
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      out.write(label + line + "\n");
    }
  }
}

console.log(`\n${BOLD}Starting dev servers…${RESET}\n`);

const procs = SERVICES.map(({ name, color, cwd }) => {
  const label = `${BOLD}${color}[${name}]${RESET} `;

  const proc = Bun.spawn(["bun", "run", "dev"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  pipeWithLabel(proc.stdout, label, process.stdout);
  pipeWithLabel(proc.stderr, label, process.stderr);

  return proc;
});

function shutdown() {
  procs.forEach((p) => p.kill());
  process.exit(0);
}

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

const codes = await Promise.all(procs.map((p) => p.exited));
process.exit(Math.max(...codes));

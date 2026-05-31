# Build context: ./api
# docker build -f api/Dockerfile ./api

# ─── Stage 1: install production dependencies ────────────────────────────────
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

# Copy lockfile alongside package.json so Bun resolves the exact dependency
# graph pinned at development time. --frozen is intentionally omitted: Bun's
# lockfile text format can shift between patch releases, causing false
# "lockfile had changes" failures when the image's Bun version differs from
# the one that generated the lockfile locally. The lockfile is still used for
# resolution; it is just not re-serialised to disk for comparison.
COPY package.json bun.lock ./
RUN bun install --production

# ─── Stage 2: lean production image ──────────────────────────────────────────
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

# Copy API source only — no tests, seeds, or dev tooling.
COPY src           ./src
COPY package.json  tsconfig.json ./

EXPOSE 3001

# Bun runs TypeScript directly — no compile step needed.
CMD ["bun", "run", "src/server.ts"]

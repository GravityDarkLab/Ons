# Build context: monorepo root (bun.lock lives there, not in api/).
# docker build -f api/Dockerfile .

# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

# Copy the monorepo lockfile + workspace manifests needed for install.
COPY bun.lock package.json ./
COPY api/package.json ./api/

# --frozen: respect the lockfile exactly (correct flag for text bun.lock).
# --production: skip devDependencies to keep the image lean.
RUN bun install --frozen --production

# ─── Stage 2: production image ────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app/api

ENV NODE_ENV=production

# Bun workspaces hoist all packages to the root node_modules.
COPY --from=deps /app/node_modules ../node_modules

# Copy API source only — no tests, seeds, or dev tooling.
COPY api/src ./src
COPY api/package.json api/tsconfig.json ./

EXPOSE 3001

# Bun runs TypeScript directly — no compile step needed.
CMD ["bun", "run", "src/server.ts"]

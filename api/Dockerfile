# Build context: repo root  (docker build -f api/Dockerfile .)
#
# Root context gives access to the workspace bun.lock — the source of truth
# for pinned versions. Using the api-level bun.lock causes a workspace-name
# mismatch (it records "ons" as the root, but Docker only sees api/package.json
# which is named "ons-api"), forcing Bun to regenerate it and fail frozen mode.

# ─── Stage 1: install production dependencies ────────────────────────────────
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

# Both workspace stubs are needed so Bun's resolver doesn't complain about
# missing members. Only api production deps end up in node_modules.
COPY package.json bun.lock ./
COPY api/package.json      ./api/
COPY frontend/package.json ./frontend/

RUN bun install --frozen --production

# ─── Stage 2: lean production image ──────────────────────────────────────────
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Bun workspaces hoist all packages to the root node_modules.
COPY --from=deps /app/node_modules ./node_modules

# Copy API source only — no tests, seeds, or dev tooling.
COPY api/src           ./api/src
COPY api/package.json  ./api/
COPY api/tsconfig.json ./api/

WORKDIR /app/api

EXPOSE 3001

# Bun runs TypeScript directly — no compile step needed.
CMD ["bun", "run", "src/server.ts"]

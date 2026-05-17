# Build context: monorepo root (bun.lock lives there, not in api/).
# docker build -f api/Dockerfile .

# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

# Install only the API's own production dependencies.
# We don't use workspace mode here — the monorepo root package.json declares
# a "frontend" workspace that doesn't exist in this build context, which
# causes bun install to fail. Installing from api/package.json directly is
# simpler and correct for a single-service Docker image.
COPY api/package.json ./
RUN bun install --production

# ─── Stage 2: production image ────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

# Copy API source only — no tests, seeds, or dev tooling.
COPY api/src ./src
COPY api/package.json api/tsconfig.json ./

EXPOSE 3001

# Bun runs TypeScript directly — no compile step needed.
CMD ["bun", "run", "src/server.ts"]

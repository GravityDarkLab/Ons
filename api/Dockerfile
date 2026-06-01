# Build context: repo root
# docker build -f api/Dockerfile .

# ─── Stage 1: install production dependencies ────────────────────────────────
FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /workspace

# Mirror the workspace structure so the root bun.lock resolves correctly.
# Only api/package.json is present — bun installs api production deps only.
COPY bun.lock package.json ./
COPY api/package.json ./api/package.json
RUN cd api && bun install --frozen --production

# ─── Stage 2: lean production image ──────────────────────────────────────────
FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Workspace installs go to the root node_modules
COPY --from=deps /workspace/node_modules ./node_modules

# Copy API source only — no tests, seeds, or dev tooling
COPY api/src        ./src
COPY api/package.json api/tsconfig.json ./

EXPOSE 3001

CMD ["bun", "run", "src/server.ts"]

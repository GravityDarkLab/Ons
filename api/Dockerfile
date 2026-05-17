# Build context: ./api
# docker build -f api/Dockerfile ./api

# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

COPY package.json ./
RUN bun install --production

# ─── Stage 2: production image ────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

# Copy API source only — no tests, seeds, or dev tooling.
COPY src ./src
COPY package.json tsconfig.json ./

EXPOSE 3001

# Bun runs TypeScript directly — no compile step needed.
CMD ["bun", "run", "src/server.ts"]

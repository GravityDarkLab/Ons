# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ─── Stage 2: production image ────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json tsconfig.json ./

EXPOSE 3001

# Run directly with Bun — no build step needed for TypeScript
CMD ["bun", "run", "src/server.ts"]

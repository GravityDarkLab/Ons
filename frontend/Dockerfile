# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
# --frozen is omitted intentionally — Bun's lockfile text format can shift
# between patch releases, causing false failures when the image Bun version
# differs from the one that generated the lockfile. Resolution still uses the
# lockfile; it is just not re-serialised for comparison.
RUN bun install

COPY . .

# Vite bakes env vars at build time — pass them as build args.
# VITE_INVITE_KEY has no default and is required in production.
ARG VITE_API_URL=http://localhost:3001
ARG VITE_INVITE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_INVITE_KEY=$VITE_INVITE_KEY

RUN bun run build

# ─── Stage 2: serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist  /usr/share/nginx/html
COPY                nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

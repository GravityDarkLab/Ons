# Build context: repo root
# docker build -f frontend/Dockerfile .

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /workspace

# Mirror the workspace structure so the root bun.lock resolves correctly.
COPY bun.lock package.json ./
COPY frontend/package.json ./frontend/package.json
RUN cd frontend && bun install --frozen

COPY frontend/ ./frontend/

WORKDIR /workspace/frontend

# Vite bakes env vars at build time — pass them as build args.
ARG VITE_API_URL=
ARG VITE_INVITE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_INVITE_KEY=$VITE_INVITE_KEY

RUN bun run build

# ─── Stage 2: serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Bun monorepo with two workspaces: `api/` (Hono + MongoDB) and `frontend/` (React + Vite + Tailwind). Runtime is Bun ≥ 1.2 throughout — no Node.js.

## Commands

```bash
# Install (from monorepo root)
bun install

# Development
bun run dev               # API + frontend in parallel (api/.env.dev)
bun run dev:test          # API + frontend in parallel (api/.env.test)
bun run dev:api           # API only (uses api/.env.dev)
bun run dev:api:test      # API only (uses api/.env.test)
bun run dev:api:prod      # API only (uses api/.env.prod)
bun run dev:frontend      # Frontend only

# Build & type-check
bun run build
bun run typecheck

# Tests
bun run test              # API + frontend in parallel
bun run test:api          # API tests only (no DB required)
bun run test:frontend     # Frontend tests only

# API tests with watch mode (from api/)
bun test --watch --preload ./src/__tests__/setup.ts ./src/__tests__

# Seed database
bun run seed              # Interactive: questionnaire / applicants / both
```

API is at `http://localhost:3001`, Swagger UI at `http://localhost:3001/api/v1/docs`, frontend at `http://localhost:5174`.

## Environment setup

Copy and fill in `api/.env.example` → `api/.env.dev`. Required secrets: `ENCRYPTION_KEY` (`openssl rand -hex 32`), `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `FORM_SECRET`, `EMBEDDING_PROVIDER` (`openai` or `local`).

For local MongoDB: `cp .env.mongo.dev.example .env.mongo.dev && docker compose --env-file .env.mongo.dev -f docker-compose-mongo-dev.yml up -d`

## Architecture

### API (`api/src/`)

Thin controllers delegate to services; routes wire validators → controllers:

```
server.ts        ← Hono app, middleware, bootstrap (DB connect + indexes)
config/          ← env loader (throws on misconfiguration), CORS
routes/          ← Hono route definitions (form, admin, matching, match)
controllers/     ← Request handlers, call services
services/        ← Business logic (form, admin, questionnaire, embedding)
models/          ← TypeScript interfaces for MongoDB documents
validators/      ← Zod schemas for all request validation
middleware/      ← JWT auth, rate limiting, audit logging
db/              ← MongoDB connection, collections, index setup
privacy/         ← AES-256-GCM encryption, alias generation, submission keys
matching/        ← Matching pipeline (see below)
seeds/           ← Seed scripts for questionnaire, applicants, admin user
```

The API mounts at `/api/v1`. `form` routes are public; `admin` and `matching` routes require Bearer JWT.

### Matching pipeline (`api/src/matching/`)

Three-stage pipeline: **filter → prepare → score**. All algorithms implement the `Algorithm` interface (`prepare?`, `score`).

- `engine.ts` — orchestrator; loads applicants, runs hard filters, calls `prepare()` once, then `score()` per pair
- `filters.ts` — orientation compatibility (hard exclusion, not low score)
- `algorithms/baseline.ts` — weighted rule-based (6 dimensions)
- `algorithms/cosine.ts` — cosine similarity over encoded feature vectors (bag-of-words)
- `algorithms/embedding-cosine.ts` — same structure but uses dense text embeddings; `prepare()` batch-embeds all applicants before pairwise scoring (O(N) API calls not O(N²))
- `embeddings/provider.ts` — `EmbeddingProvider` interface; OpenAI or any OpenAI-compatible local model (LM Studio, Ollama)
- `scorers/trait.scorer.ts` — shared trait overlap helpers used by baseline

To add a new algorithm: implement `Algorithm` in `algorithms/`, register in `engine.ts`, add to the validator enum and `api/docs/openapi.yaml`.

### Privacy model

Instagram handles are **never stored in `applicants`**. They are AES-256-GCM encrypted with a fresh IV per write, stored in a separate `identities` collection. Every decryption is written to `audit_logs` before plaintext is returned. Submission keys are `HMAC-SHA256(questionnaire_version, FORM_SECRET)` — prevents version enumeration.

### Frontend (`frontend/src/`)

Two independent sections in one React app:

- **Public form** (`pages/`, `steps/`) — invite-gated via `InviteGate`. Multi-step wizard (`Apply.tsx` + `steps/Step1–5`). Questionnaire schema is fetched dynamically; `X-Submission-Key` from `GET /questionnaire` is sent with `POST /submit`.
- **Admin panel** (`admin/`) — JWT session auth via `AuthProvider`. Routes: Dashboard, Applicants, ApplicantDetail, Matching, Matches, AuditLogs. `ProtectedRoute` guards all admin routes except `/admin/login`.

`App.tsx` keeps `AuthProvider` scoped to `/admin/*` — `getMe()` is never called on public pages.

Internationalisation via `i18next` (files in `src/i18n/`).

## Testing

**API tests** use Bun's built-in test runner. `src/__tests__/setup.ts` is preloaded and sets all required env vars — tests run without a real DB or external services. Test files live under `src/__tests__/{unit,integration,routes}/`.

**Frontend tests** use Vitest + jsdom + Testing Library. Setup file is `src/__tests__/setup.ts`; `VITE_INVITE_KEY` is injected via `vitest.config.ts`.

Run a single API test file:
```bash
bun test --preload ./src/__tests__/setup.ts ./src/__tests__/routes/admin.routes.test.ts
```

Run a single frontend test file (from `frontend/`):
```bash
bun run vitest run src/__tests__/unit/ApplicantDetail.vitest.tsx
```

Frontend test files use `.vitest.tsx` / `.vitest.ts` extensions; API test files use `.test.ts`.

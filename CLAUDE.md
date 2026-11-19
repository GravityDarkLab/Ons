# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

**Ons (أنس)** — Arabic/Tunisian for intimacy and closeness — is a privacy-first couple-matching platform: applicants fill out a questionnaire, an admin reviews submissions and runs the matching engine, and compatible pairs are surfaced through an admin panel and an applicant-facing portal with mutual identity reveal. Instagram handles and other identifying details are encrypted separately from `applicants` and only ever revealed mutually, with every decryption audit-logged. See [README.md](README.md) for the full product walkthrough.

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
bun test --isolate --watch --preload ./src/__tests__/setup.ts ./src/__tests__

# Seed database
bun run seed              # Interactive: questionnaire / applicants / both
```

API is at `http://localhost:3001`, Swagger UI at `http://localhost:3001/api/v1/docs`, frontend at `http://localhost:5173`.

## Environment setup

Copy and fill in `api/.env.example` → `api/.env.dev`. Required secrets: `ENCRYPTION_KEY` (`openssl rand -hex 32`), `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `FORM_SECRET`, `OPENAI_API_KEY`.

For local MongoDB: `cp .env.mongo.dev.example .env.mongo.dev && docker compose --env-file .env.mongo.dev -f docker-compose-mongo-dev.yml up -d`

## Architecture

### API (`api/src/`)

Thin controllers delegate to services; routes wire validators → controllers:

```
server.ts        ← Hono app, middleware, bootstrap (DB connect + indexes)
config/          ← env loader (throws on misconfiguration), CORS
routes/          ← Hono route definitions (form, admin, matching, match)
controllers/     ← Request handlers, call services
services/        ← Business logic (form, admin, questionnaire, profile, match state)
questionnaire/   ← The v2 question definitions — single source of truth (see below)
models/          ← TypeScript interfaces for MongoDB documents
validators/      ← Zod schemas for all request validation
middleware/      ← JWT auth, rate limiting, audit logging
db/              ← MongoDB connection, collections, index setup
privacy/         ← AES-256-GCM encryption, alias generation, submission keys
matching/        ← Matching pipeline (see below)
seeds/           ← Seed scripts for questionnaire, applicants, admin user
```

The API mounts at `/api/v1`. `form` routes are public; `admin` and `matching` routes require Bearer JWT.

### Question definitions (`api/src/questionnaire/questions.ts`)

The single source of truth for the questionnaire: every question, its ordered options, and whether an answer is `shared`. The seed, the Zod validator (`validators/form.validator.ts` generates its tap-question rules from it), the scorer's ordinal lookups and the OpenAI prompt snippet all import it. The frontend does not define questions — it renders what `GET /form/questionnaire` returns and only owns the translations (`questions.*` in the locale files; an API test fails if a question or option lacks a translation in any of the four languages).

- Option **order is meaningful**: ordered answers are compared by index in the scorer.
- Stored values are language-independent: kept fields keep their old values (`"Long Term"`, `"Male"`), new selects store snake_case slugs, agreement items store integers 1–5, `top_values` an array of exactly three.
- `shared` is opt-in and default-deny. Only `shared: true` answers may be shown to a match (`toMatchView`) or sent to OpenAI (`buildProfileSnippet`). Attachment, personality, partner-preference and identity answers are never shared. The optional free-text `note_to_match` is never scored and never sent to OpenAI; `toMatchView` returns it only once a match is mutual (`dating`), the same gate as the identity reveal — ice-breakers are generated at contact *request*, before the other person accepts, so it must not go into that prompt.

### Matching pipeline (`api/src/matching/`)

Single deterministic pipeline, two stages: **filter → score**. No network calls, no model, no cache.

- `engine.ts` — orchestrator; loads applicants, skips those in an active contact, runs hard filters, calls `score(a, b)` per pair, returns the top N
- `filters/` — six hard, binary pass/fail filters (excluded pairs never get a low score, they get no result): `orientation`, `age`, `religion`, `location`, `children`, `habits`
- `scorer.ts` — the only scorer: five weighted dimensions (`values`, `lifestyle`, `connection`, `personality`, `goals`) times the age modifier. Synchronous and total: a missing or unknown answer scores a neutral 0.5 for that item
- `scoring/weights.ts` — the per-dimension weights (sum to 1.0)
- `proposals.ts` — derives unique couple proposals (canonicalized pair, symmetric score) from a full matching pass

Matches are stored with `algorithm: "rules-v1"`. Applicants only see three breakdown bars (`APPLICANT_BREAKDOWN_KEYS`): `values` and `lifestyle` read the scorer's `values_shared` / `lifestyle_shared` (computed from shared answers only, so a partner's private preferences cannot be worked backwards from a bar) and `goals`; `connection` and `personality` stay admin-only. Portal thresholds live in `services/match-state.service.ts` (`PORTAL_MIN_SCORE` 0.5, `DEFAULT_SCORE_THRESHOLD` 0.6).

OpenAI (`OPENAI_API_KEY`) is used only for match summaries and ice-breakers (`services/ai.service.ts`), never for matching.

### Privacy model

Instagram handles are **never stored in `applicants`**. They are AES-256-GCM encrypted with a fresh IV per write, stored in a separate `identities` collection. Every decryption is written to `audit_logs` before plaintext is returned. Submission keys are `HMAC-SHA256(questionnaire_version, FORM_SECRET)` — prevents version enumeration.

### Error handling & status transitions

Services throw `AppError(message, statusCode)` (`errors.ts`); controllers catch and respond via `errorResponse(c, err, fallbackMessage?, fallbackStatus?)` (`utils/error-response.ts`) — don't hand-roll `{ success: false, error: ... }` JSON.

`services/match-state.service.ts` is the shared kernel for match/applicant status transitions (`transitionApplicantStatus`, `applyMatchStatusSideEffects`, `expireConflictingMatches`, `assertMatchTransition`, `promoteAppliedToMatched`). Both the admin override path (`match.service.ts`) and applicant-facing flows (`profile.service.ts`) go through it — don't duplicate status-mutation logic in either.

### Frontend (`frontend/src/`)

Two independent sections in one React app:

- **Public form** (`pages/Apply.tsx`) — invite-gated via `InviteGate`. One typed screen (`steps/Step1Identity`: name, Instagram, city, birth date), then one screen per tap question rendered by `components/QuestionField` from the questionnaire fetched from `GET /questionnaire`, then a final screen (optional note + consent). Single-choice taps auto-advance after 250 ms. `X-Submission-Key` from `GET /questionnaire` is sent with `POST /submit`. The post-submit Success page shows the applicant's `magicToken` for first portal login — the API never returns `plainPassword`.
- **Admin panel** (`admin/`) — JWT session auth via `AuthProvider`. Routes: Dashboard, Applicants, ApplicantDetail, Matching, Matches, AuditLogs. `ProtectedRoute` guards all admin routes except `/admin/login`.
- **Applicant portal** (`pages/profile/`) — session-cookie auth (`ons_applicant_session`, HttpOnly). `ProfileDashboard` has Matches and Profile tabs (edit answers with the same `QuestionField` components, identity reveal, deletion countdown).

`App.tsx` keeps `AuthProvider` scoped to `/admin/*` — `getMe()` is never called on public pages.

### Design system (frontend)

All color/shadow tokens live in `frontend/src/index.css` as `--t-*` custom properties — the single source of truth — mapped to Tailwind v4 utilities via `@theme inline` (`--color-bg`, `--color-surface`, `--color-ink`, `--color-accent`, `--color-success`, `--color-error`, etc.). **Never** hardcode hex colors or reach for off-palette Tailwind classes (`bg-blue-50`, `text-white`) in app UI — use `bg-bg`, `text-ink`, `bg-accent`, `text-bg` (the last so filled/accent buttons invert correctly in dark mode).

Dark mode is a `.dark` class on `<html>` that swaps the `--t-*` values; `ThemeProvider`/`ThemeToggle` (`theme/`) are scoped to `/admin/*` and `/profile/*` only — the public form (`/`, `/apply`, `/success`) is deliberately light-only, with a no-flash guard script in `index.html`. Theme preference persists in `localStorage` under `ons-theme`.

Brand identity: warm gold accent (`--t-accent`), `Fraunces` serif for display headings (`.font-display`), `.cta-gold` gradient button class for primary CTAs on public pages.

Reuse the shared primitives in `components/ui/` (Badge + `statusTones`, Button, ConfirmDialog, EmptyState, Skeleton, Spinner, Toast, Autocomplete, RadioCard (a real radio / checkbox group — use it for any choice list), Slider, ProgressBar, Input, Textarea, `useFocusTrap`) and shared types in `types/` (`ApplicantStatus`, `MatchStatus` in `status.ts`) instead of re-implementing them per page.

Every user-facing string goes through i18next (`i18n/locales/{en,fr,de,ar}.json`) — add a key to **all four** locale files for any new string. `ar` is RTL: use logical-direction utilities (`ms-`/`me-`/`ps-`/`pe-`), never `ml-`/`mr-`/`pl-`/`pr-`.

## Testing

**API tests** use Bun's built-in test runner. `src/__tests__/setup.ts` is preloaded and sets all required env vars — tests run without a real DB or external services. Test files live under `src/__tests__/{unit,integration,routes}/`.

The suite runs with `--isolate` (each file gets a fresh module registry). Bun's `mock.module()` is otherwise process-global, so files stubbing the same module with different shapes break each other depending on file order — which differs between macOS and Linux CI. Route tests `await import()` their route module *after* their `mock.module()` calls: static imports evaluate first, and routes capture their rate limiter by value at definition time.

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

**Smoke tests** (`tests/smoke/`) run against a live server + DB and require env vars — without them every test self-skips with a warning:
```bash
SMOKE_ADMIN_USER=... SMOKE_ADMIN_PASS=... \
SMOKE_MONGO_URI='mongodb://.../ons?authSource=ons' \
bun test ./tests/smoke/portal.smoke.ts ./tests/smoke/match-flow.smoke.ts
```
Credentials are in `api/.env.dev`; `SMOKE_MONGO_URI` matches `MONGODB_URI` there.

## Conventions

Commits follow Conventional Commits with a scope where useful: `feat(frontend): ...`, `fix(api): ...`, `refactor(api): ...`, `test(api): ...`, `docs: ...`, `style(admin): ...`, `chore(frontend): ...`. Never add a `Co-Authored-By: Claude` trailer to any commit.

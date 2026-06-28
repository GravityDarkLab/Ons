# Ons — أنس

> *Ons* (أنس) — Arabic/Tunisian for intimacy and closeness between people.

A privacy-first couple matching platform. Applicants fill out a form, an admin reviews and runs the matching engine, and compatible pairs are surfaced — no Instagram handles or personal details ever leave the encrypted identity store.

**Stack:** Bun · Hono · MongoDB · React · Vite · Tailwind  
**Docs:** [`api/README.md`](./api/README.md) · [`frontend/README.md`](./frontend/README.md) · [`api/src/matching/README.md`](./api/src/matching/README.md)

---

## Contents

- [Quick start](#quick-start)
- [Monorepo layout](#monorepo-layout)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Privacy model](#privacy-model)
- [Local MongoDB (Docker)](#local-mongodb-docker)
- [Docker stacks](#docker-stacks)
- [CI / CD](#ci--cd)
- [Scripts](#scripts)

---

## Quick start

### 0. Use supported runtimes

- Bun ≥ 1.2
- Node.js 22 LTS or 24 LTS for frontend tooling

Node 26 currently triggers a Tailwind CSS deprecation warning from `@tailwindcss/node`.

### 1. Install dependencies

```bash
bun install
```

### 2. Configure the API

```bash
cp api/.env.example api/.env
```

Open `api/.env` and fill in the required secrets — see [`api/README.md`](./api/README.md) for the full variable reference. The two that vary by MongoDB option are covered below.

### 3. Choose your MongoDB

#### Option A — Local Docker (recommended for development)

Starts MongoDB 7 with auth, a scoped app user, and Mongo Express:

```bash
cp .env.mongo.dev.example .env.mongo.dev
docker compose --env-file .env.mongo.dev  -f docker-compose-mongo-dev.yml up -d   
```

For more information, see [Local MongoDB (Docker)](#local-mongodb-docker) below for override options.

Now you can seed MongoDB using the seeders in `scripts/seed.ts` and connect the API using the app user credentials you set in `.env.mongo.dev`:

You also need to set the following in `api/.env`:

```env
MONGODB_URI=mongodb://ons_app:<MONGO_APP_PASSWORD>@localhost:27017/ons?authSource=ons
MONGODB_DB_NAME=ons
```

Mongo Express is available at http://localhost:8081 (login with the credentials you set in `.env.mongo.dev`).  
See [Local MongoDB (Docker)](#local-mongodb-docker) for override options and reset commands.

#### Option B — MongoDB Atlas (production or cloud dev)

Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas), whitelist your IP, and copy the connection string:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ons?retryWrites=true&w=majority
MONGODB_DB_NAME=ons
```

No Docker required (no `docker-compose-mongo-dev.yml`). Atlas handles auth, backups, and replica sets for you.

### 4. Seed the questionnaire

```bash
bun run seed
```

### 5. Start everything

```bash
bun run dev
```

| Service    | URL                               |
|------------|-----------------------------------|
| API        | http://localhost:3001             |
| Swagger UI | http://localhost:3001/api/v1/docs |
| Frontend   | http://localhost:5173             |

---

## Monorepo layout

```
ons/
├── api/                            ← REST API (Bun · Hono · MongoDB)
│   ├── src/
│   │   ├── matching/               ← Algorithms, engine, filters
│   │   │   └── README.md           ← Matching system deep-dive
│   │   ├── privacy/                ← Encryption, alias generation, submission keys
│   │   ├── services/               ← Business logic
│   │   ├── controllers/            ← Request handlers
│   │   ├── routes/                 ← Hono route definitions
│   │   ├── middleware/             ← Auth, rate limiting, audit logging
│   │   └── __tests__/             ← Full test suite (515 tests)
│   ├── docs/openapi.yaml           ← Full OpenAPI 3.1 spec
│   ├── Dockerfile
│   └── README.md                   ← API setup & reference
├── frontend/                       ← React app (Vite · Tailwind)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── README.md                   ← Frontend setup & reference
├── docker/
│   └── mongo/init/
│       └── 01-init-app-user.sh     ← Creates app DB user on first boot
├── scripts/
│   └── seed.ts                     ← Interactive seed runner (questionnaire / applicants / both)
├── tests/smoke/                    ← Smoke tests against a live server + DB
├── docker-compose.yml              ← Production stack (API + frontend)
└── docker-compose-mongo-dev.yml    ← MongoDB + Mongo Express only (local dev)
```

---

## How it works

1. **Applicant fills the form** — the frontend fetches the active questionnaire, gates access with an invite key, and POSTs answers to the API.
2. **PII is isolated at submission** — the first/last name and Instagram handle are each AES-256-GCM encrypted (own fresh IV per field) and stored in a separate `identities` collection, never in the applicant profile.
3. **Admin runs matching** — `POST /api/v1/matching/run` shortlists all active applicants pairwise with text embeddings, then an LLM rerank call (one per applicant, covering its whole shortlist) judges the shortlist and produces the score that's actually returned — the embedding step alone is structurally incapable of scoring a great pair above ~80%, see [`api/src/matching/README.md`](./api/src/matching/README.md#llm-rerank-servicesmatch-rerankservicets).
4. **Admin resolves identities** — every access to someone else's encrypted identity is audit-logged. (Applicants can always see their own name on their own profile — that's not a "reveal", just their own data.)
5. **Applicant uses their portal** — a magic link from the admin grants access to `/profile`, where the applicant reviews their matches and can edit their questionnaire answers.
6. **Matched applicants connect** — either side can initiate contact; the target receives ice-breaker prompts and date ideas to decide. Only when the target **accepts** are both parties' Instagram handles and names decrypted simultaneously, audit-logged, and revealed to each other. A declined or withdrawn request leaves identities sealed.
7. **Dating, the warm way** — once mutual, outcome reporting is time-gated rather than available immediately: a friendly rotating check-in message shows for the first 3 days, a quiet "things aren't working out?" option unlocks at day 3, and full "it worked / it didn't" reporting unlocks at day 7. A failed outcome can optionally tag why (e.g. "too far apart") and choose to keep looking or take a break — tagging distance later surfaces a one-time, dismissible suggestion to open up to long-distance matches.

---

## Architecture

```
browser ──► frontend (React + Vite)
                │
                ▼
            API (Hono / Bun)
           ┌────┬───────┬─────────┬───────┐
           │form│ admin │ profile │ match │
           └──┬─┴───────┴────┬────┴───┬───┘
              │               │        │
          MongoDB              Matching engine
        ┌───────┴───────┐     (embedding-cosine shortlist
        │ applicants    │      + age filter, then an
        │ identities    │      LLM listwise rerank for
        │ embeddings    │      the displayed score)
        │ match_reranks │
        │ audit_logs    │
        └───────────────┘
```

See [`api/src/matching/README.md`](./api/src/matching/README.md) for the full pipeline breakdown — weights, age filter math, embedding batching, and how to extend the system.

---

## Privacy model

| Data | Collection | Who can access |
|---|---|---|
| Questionnaire answers | `applicants` | Admin, and the applicant themselves via `/profile` |
| Instagram handle + first/last name | `identities` (AES-256-GCM encrypted, each field its own IV) | The applicant themselves (their own name, not audit-logged); admin (audit-logged); or both matched applicants simultaneously after mutual acceptance of a contact request (each audit-logged independently) |
| Text embeddings | `embeddings` | Matching engine |
| Admin actions | `audit_logs` | Admin |

The Instagram handle and name never touch the `applicants` collection. Each is encrypted with its own fresh random IV on every write and stored separately — even within the same `identities` document, no two fields ever share an IV. Decryption requires the `ENCRYPTION_KEY` secret. Decrypting *someone else's* identity (an admin lookup, or a matched applicant's mutual reveal) is always written to `audit_logs` before the plaintext is returned; an applicant viewing their own name on their own profile is not, since that's not a privacy-sensitive reveal.

---

## Local MongoDB (Docker)

`docker-compose-mongo-dev.yml` runs a self-contained MongoDB 7 stack for local development:

- MongoDB with root auth + a scoped app user created on first boot
- Persistent named volume (`mongo_data_dev`) — data survives restarts
- Mongo Express UI at http://localhost:8081

```bash
# Start
docker compose -f docker-compose-mongo-dev.yml up -d

# Stop (preserves data)
docker compose -f docker-compose-mongo-dev.yml down

# Wipe data and start fresh
docker compose -f docker-compose-mongo-dev.yml down -v
```

### Connection strings

**App user** (use this in `api/.env`):
```
MONGODB_URI=mongodb://ons_app:<MONGO_APP_PASSWORD>@localhost:27017/ons?authSource=ons
```

**Root** (admin tasks, Mongo Express backend):
```
mongodb://root:<MONGO_ROOT_PASSWORD>@localhost:27017/admin?authSource=admin
```

**Mongo Express UI:** http://localhost:8081 — login with the credentials you set in `.env.mongo.dev`

### Overriding defaults

The defaults work out of the box for a single developer. For multiple environments (dev / test / staging), create a named env file per environment and pass it with `--env-file`:

```bash
# Local development
docker compose --env-file .env.mongo.dev -f docker-compose-mongo-dev.yml up -d

# Shared staging instance (different port, stronger passwords)
docker compose --env-file .env.mongo.staging -f docker-compose-mongo-dev.yml up -d
```

Example `.env.mongo.dev`:

```env
MONGO_PORT=27017
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=root
MONGO_APP_DB=ons
MONGO_APP_USERNAME=ons_app
MONGO_APP_PASSWORD=ons_app_dev_password
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USERNAME=devadmin
MONGO_EXPRESS_PASSWORD=devadmin
```

Example `.env.mongo.staging`:

```env
MONGO_PORT=27018
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=changeme_staging
MONGO_APP_DB=ons_staging
MONGO_APP_USERNAME=ons_app
MONGO_APP_PASSWORD=changeme_staging_app
MONGO_EXPRESS_PORT=8082
MONGO_EXPRESS_USERNAME=devadmin
MONGO_EXPRESS_PASSWORD=changeme_express
```

Add both files to `.gitignore` — they contain credentials. Shell variables always take precedence over `--env-file` values.

| Variable | Default |
|---|---|
| `MONGO_PORT` | `27017` |
| `MONGO_ROOT_USERNAME` | `root` |
| `MONGO_ROOT_PASSWORD` | `root` |
| `MONGO_APP_DB` | `ons` |
| `MONGO_APP_USERNAME` | `ons_app` |
| `MONGO_APP_PASSWORD` | `ons_app_dev_password` |
| `MONGO_EXPRESS_PORT` | `8081` |
| `MONGO_EXPRESS_USERNAME` | `devadmin` |
| `MONGO_EXPRESS_PASSWORD` | `devadmin` |

---

## Docker stacks

Two compose files, each with a single responsibility:

| File | Purpose |
|---|---|
| `docker-compose-mongo-dev.yml` | Spin up MongoDB + Mongo Express locally; API and frontend run via `bun run dev` |
| `docker-compose.yml` | Build and run the API + frontend images; behaviour is fully driven by the env file you pass |

### `docker-compose.yml` — env-driven, environment-agnostic

The compose file has no hardcoded environment. Everything comes from the env file you supply:

```bash
docker compose --env-file .env.dev   up --build -d   # local / dev
docker compose --env-file .env.prod  up --build -d   # self-hosted production
docker compose --env-file .env.test  up --build      # CI smoke tests
```

See `api/.env.example` for the full variable reference. At minimum you need `ENCRYPTION_KEY`, `JWT_SECRET`, `FORM_SECRET`, `MONGODB_URI`, and `VITE_INVITE_KEY`.

### AWS ECS / cloud deployments

On ECS (or any container orchestrator) you don't need `docker-compose.yml` at all — just build and push the images directly:

```bash
docker build -t ons-api ./api
docker build -t ons-frontend \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_INVITE_KEY=<secret> \
  ./frontend
```

Inject secrets via ECS task-definition environment variables or AWS Secrets Manager.

---

## CI / CD

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | Every push / PR | TypeScript type-check + Docker build validation |
| **Security** | Every push / PR + weekly | Gitleaks secret scan, CodeQL SAST, Trivy CVE scan |
| **Dependabot** | Weekly (Monday) | Dependency updates with 15-day cooldown (supply-chain protection) |

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start API (`.env.dev`) + frontend in parallel with labelled output |
| `bun run dev:test` | Same but API uses `.env.test` |
| `bun run dev:api` | API only — `.env.dev` (hot reload) |
| `bun run dev:api:test` | API only — `.env.test` (hot reload) |
| `bun run dev:api:prod` | API only — `.env.prod` (hot reload) |
| `bun run dev:frontend` | Frontend only (hot reload) |
| `bun run seed` | Interactive seed runner — choose questionnaire, applicants, or both; prompts for environment |
| `bun run build` | Build all workspaces |
| `bun run typecheck` | Type-check all workspaces |
| `bun run test` | Run API + frontend test suites in parallel (API: 515 tests, no DB required) |
| `bun run test:smoke` | Run smoke tests against a live server + DB (requires env vars — see `tests/smoke/`) |

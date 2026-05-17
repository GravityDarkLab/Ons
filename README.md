# Ons — أنس

> *Ons* (أنس) — Arabic/Tunisian for intimacy and closeness between people.

A privacy-first couple matching platform. Applicants fill out a form, an admin reviews and runs the matching engine, and compatible pairs are surfaced — no Instagram handles or personal details ever leave the encrypted identity store.

---

## Monorepo layout

```
ons/
├── api/                        ← REST API (Bun · Hono · MongoDB)
│   ├── src/
│   │   ├── matching/           ← Algorithms, engine, filters
│   │   ├── privacy/            ← Encryption, alias generation, submission keys
│   │   ├── services/           ← Business logic
│   │   └── ...
│   ├── docs/openapi.yaml       ← Full OpenAPI spec
│   └── README.md               ← API setup & reference
├── frontend/                   ← React app (Vite · Tailwind)
│   └── README.md               ← Frontend setup & reference
├── scripts/                    ← One-shot dev scripts
│   ├── dev.ts                  ← Parallel dev runner (labelled output)
│   └── seed.ts                 ← Seeds the questionnaire into MongoDB
├── docker-compose.yml          ← Production stack
└── docker-compose.dev.yml      ← Development stack (hot reload)
```

---

## Quick start

```bash
# 1. Install all workspace dependencies
bun install

# 2. Configure the API
cp api/.env.example api/.env
# Required: MONGODB_URI, ENCRYPTION_KEY, JWT_SECRET,
#           ADMIN_USERNAME, ADMIN_PASSWORD, FORM_SECRET

# 3. Seed the questionnaire
bun run seed

# 4. Start everything
bun run dev
```

| Service | URL |
|---|---|
| API | http://localhost:3001 |
| Swagger UI | http://localhost:3001/api/v1/docs |
| Frontend | http://localhost:5174 |

See [`api/README.md`](./api/README.md) and [`frontend/README.md`](./frontend/README.md) for full setup guides.

---

## How it works

1. **Applicant fills the form** — the frontend fetches the active questionnaire, gates access with an invite key, and POSTs answers to the API.
2. **PII is isolated at submission** — the Instagram handle is AES-256-GCM encrypted and stored in a separate `identities` collection, never in the applicant profile.
3. **Admin runs matching** — `POST /api/v1/matching/run` scores all active applicants pairwise and returns ranked candidates per person.
4. **Admin resolves identities** — every access to an encrypted identity is audit-logged.

---

## Architecture at a glance

```
browser ──► frontend (React)
                │
                ▼
            API (Hono)
           ┌───┴────────────────────┐
           │  form  │ admin │ match │
           └───┬────┴───────┴───┬───┘
               │                │
           MongoDB           Matching engine
         ┌─────┴──────┐    (baseline / cosine /
         │ applicants │     embedding-cosine)
         │ identities │
         │ embeddings │
         │ audit_logs │
         └────────────┘
```

### Privacy model

| What | Where | Who can read |
|---|---|---|
| Questionnaire answers | `applicants` collection | Admin (no PII) |
| Instagram handle | `identities` collection (AES-256-GCM) | Admin only — audit logged |
| Text embeddings | `embeddings` collection | Matching engine |
| Admin actions | `audit_logs` collection | Admin |

---

## CI / CD

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | Every push / PR | TypeScript type-check + Docker build validation |
| **Security** | Every push / PR + weekly | Gitleaks secret scan, CodeQL SAST, Trivy dependency CVE scan |
| **Dependabot** | Weekly (Monday) | Dependency updates with 15-day cooldown (supply-chain protection) |

---

## Root scripts

| Command | Description |
|---|---|
| `bun run dev` | Start API + frontend in parallel |
| `bun run dev:api` | API only |
| `bun run dev:frontend` | Frontend only |
| `bun run seed` | Seed questionnaire v1.0.0 |
| `bun run seed:applicants` | Seed fake applicants (dev) |
| `bun run build` | Build all workspaces |
| `bun run typecheck` | Type-check all workspaces |

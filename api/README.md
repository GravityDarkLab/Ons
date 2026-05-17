# ons-api

REST API for the Ons matching platform — built with [Bun](https://bun.sh), [Hono](https://hono.dev), and MongoDB.

---

## Requirements

- [Bun](https://bun.sh) ≥ 1.2
- MongoDB 7+ (local or Docker)

---

## Setup

```bash
# From the monorepo root
bun install

# Copy and fill in secrets
cp api/.env.example api/.env
```

### Required environment variables

| Variable | Description | How to generate |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | — |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM | `openssl rand -hex 32` |
| `JWT_SECRET` | Secret for admin JWT signing | `openssl rand -base64 48` |
| `ADMIN_USERNAME` | Admin login username | — |
| `ADMIN_PASSWORD` | Admin login password | — |
| `FORM_SECRET` | HMAC secret for submission keys | `openssl rand -hex 32` |
| `EMBEDDING_PROVIDER` | `openai` or `local` | — |
| `EMBEDDING_MODEL` | Model name (e.g. `text-embedding-3-small`) | — |
| `EMBEDDING_BASE_URL` | Base URL for local provider | — |

### Optional variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_DB_NAME` | `ons` | Database name |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | CORS origins |
| `JWT_EXPIRY` | `8h` | JWT token lifetime |
| `PUBLIC_URL` | _(empty)_ | Base URL for startup logs |
| `OPENAI_API_KEY` | _(empty)_ | Required when `EMBEDDING_PROVIDER=openai` |

---

## Running

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

Swagger UI (dev/test only): http://localhost:3001/api/v1/docs  
OpenAPI JSON: http://localhost:3001/api/v1/openapi.json

---

## Seeding

```bash
# Seed the questionnaire schema into MongoDB
bun run seed

# Seed fake applicants (dev only — exits if NODE_ENV=production)
bun run --cwd .. seed:applicants             # default count
bun run --cwd .. seed:applicants -- --count 50
bun run --cwd .. seed:applicants -- --count 50 --clear
```

---

## API reference

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/form/questionnaire` | Fetch active questionnaire + submission key |
| `POST` | `/api/v1/form/submit` | Submit a completed form |

> `POST /submit` requires the `X-Submission-Key` header obtained from `GET /questionnaire`. This proves the client fetched the questionnaire legitimately rather than guessing version strings.

### Admin (Bearer token required)

```bash
# Login to get a JWT
curl -X POST http://localhost:3001/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'
```

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/admin/login` | Get admin JWT |
| `GET` | `/api/v1/admin/applicants` | List applicants (paginated) |
| `GET` | `/api/v1/admin/applicants/:id` | Get applicant profile |
| `GET` | `/api/v1/admin/applicants/:id/identity` | Decrypt & return Instagram handle ⚠ audit logged |
| `DELETE` | `/api/v1/admin/applicants/:id` | Deactivate applicant |
| `GET` | `/api/v1/admin/audit-logs` | View audit trail |
| `POST` | `/api/v1/admin/questionnaires` | Create new questionnaire version |

### Matching (Bearer token required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/matching/candidates/:id` | Top N candidates for one applicant |
| `POST` | `/api/v1/matching/run` | Full pairwise pass over all active applicants |

Both endpoints accept an `algorithm` parameter: `baseline`, `cosine`, or `embedding-cosine`.  
See [`src/matching/README.md`](./src/matching/README.md) for algorithm details.

---

## Project structure

```
api/
├── src/
│   ├── config/          ← env loader, CORS config
│   ├── controllers/     ← request handlers (thin — delegate to services)
│   ├── db/              ← MongoDB connection, collections, index setup
│   ├── matching/        ← Engine, algorithms, filters, embeddings
│   │   └── README.md    ← Matching system deep-dive
│   ├── middleware/       ← Auth (JWT), rate limiting, audit logging
│   ├── models/          ← TypeScript interfaces for MongoDB documents
│   ├── privacy/         ← Encryption, alias generator, submission keys
│   ├── routes/          ← Hono route definitions
│   ├── seeds/           ← Dev data seeders
│   ├── services/        ← Business logic (form, admin, questionnaire, embedding)
│   ├── validators/      ← Zod schemas for request validation
│   └── server.ts        ← App entry point, middleware wiring, bootstrap
└── docs/
    └── openapi.yaml     ← Full OpenAPI 3.1 spec
```

---

## Privacy & security

- **No PII in applicant profiles** — Instagram handles are AES-256-GCM encrypted in a separate `identities` collection.
- **Submission keys** — HMAC-SHA256(version, `FORM_SECRET`) prevents questionnaire version enumeration.
- **Audit logs** — every admin identity access records the admin ID, IP, user-agent, and timestamp.
- **Rate limiting** — in-memory sliding-window limiter on all public and admin routes.
- **Orientation filter** — incompatible pairs are excluded *before* scoring, never just ranked low.

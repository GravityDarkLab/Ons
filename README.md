# Ons — أنس

> Privacy-first couple matching platform.  
> *Ons* (أنس) — Arabic/Tunisian for intimacy and closeness between people.

```
ons/
├── api/                  ← Backend  (Bun + Hono + MongoDB)
├── frontend/             ← Frontend (Vite + React + Tailwind)
├── scripts/              ← Shared one-shot scripts
│   ├── dev.ts            ← Parallel dev runner (both services, labelled output)
│   └── seed.ts           ← Seeds the questionnaire into MongoDB
├── docker-compose.yml    ← Production
├── docker-compose.dev.yml← Development (hot reload via volume mounts)
└── api/docs/openapi.yaml ← Full API spec
```

---

## Local development

### Prerequisites
- [Bun](https://bun.sh) ≥ 1.2
- MongoDB running locally **or** use the Docker dev stack

### 1. Install all dependencies
```bash
bun install   # installs both api/ and frontend/ workspaces
```

### 2. Configure environment
```bash
# API secrets
cp api/.env.example api/.env
# Fill in: MONGODB_URI, ENCRYPTION_KEY, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
# ENCRYPTION_KEY → openssl rand -hex 32
# JWT_SECRET     → openssl rand -base64 48
# FORM_SECRET    → openssl rand -hex 32

# Frontend
cp frontend/.env.example frontend/.env.local
# Fill in: VITE_INVITE_KEY, VITE_API_URL
```

### 3. Seed the database
```bash
bun run seed   # seeds the questionnaire into MongoDB
```

### 4. Start dev servers

| Command | What starts |
|---|---|
| `bun run dev` | Both api + frontend (coloured output) |
| `bun run dev:api` | API only → http://localhost:3001 |
| `bun run dev:frontend` | Frontend only → http://localhost:5174 |

Swagger UI (dev only): http://localhost:3001/api/v1/docs

---

## Docker

### Development (hot reload)
Source files are mounted — changes reflect immediately without rebuilding.

```bash
docker compose -f docker-compose.dev.yml up          # all services
docker compose -f docker-compose.dev.yml up api       # api + mongo only
docker compose -f docker-compose.dev.yml up frontend  # frontend only
```

### Production
Builds optimised images (api: Bun runtime, frontend: nginx + static build).

```bash
export VITE_INVITE_KEY=your-key
export VITE_API_URL=https://api.yourdomain.com

docker compose up --build
```

> `api/.env` must exist for production — the compose file marks it `required: true`.

---

## Architecture

### Privacy model

Instagram handles are never stored in the applicant profile. They are
AES-256-GCM encrypted in a separate `identities` collection and resolvable
only by admins. Every admin identity access is audit-logged.
Applicants are identified by a human-friendly alias e.g. "Blue Falcon".

### Collections

| Collection | What lives here |
|---|---|
| `questionnaires` | Versioned form schemas — `sensitive: true` flag drives PII routing |
| `applicants` | Public matching profiles — zero PII |
| `identities` | Encrypted Instagram handles — admin only |
| `audit_logs` | Every admin identity access |
| `embeddings` | Pre-computed text embeddings for semantic matching |

### Matching algorithms

| Algorithm | Description |
|---|---|
| `baseline` | Weighted rule-based scoring across 6 hand-crafted dimensions |
| `cosine` | Cosine similarity over encoded feature vectors (bag-of-words) |
| `embedding-cosine` | Same structure as cosine but uses dense vector embeddings — "driven" ≈ "ambitious" |

The `embedding-cosine` algorithm requires `EMBEDDING_PROVIDER` to be configured
(OpenAI or a local model via LM Studio / Ollama).

### API surface

```
GET  /health

GET  /api/v1/form/questionnaire
POST /api/v1/form/submit

POST   /api/v1/admin/login
GET    /api/v1/admin/applicants
GET    /api/v1/admin/applicants/:id
GET    /api/v1/admin/applicants/:id/identity   ← audit logged
DELETE /api/v1/admin/applicants/:id
GET    /api/v1/admin/audit-logs
POST   /api/v1/admin/questionnaires

GET  /api/v1/matching/candidates/:id
POST /api/v1/matching/run
```

Full spec: [`api/docs/openapi.yaml`](./api/docs/openapi.yaml)  
Interactive docs (dev): http://localhost:3001/api/v1/docs

---

## Scripts reference

| Command | Description |
|---|---|
| `bun run dev` | Start both services in parallel |
| `bun run dev:api` | Start API only |
| `bun run dev:frontend` | Start frontend only |
| `bun run seed` | Seed questionnaire v1.0.0 into MongoDB |
| `bun run seed:applicants` | Seed fake applicants (dev) |
| `bun run build` | Build both workspaces |
| `bun run typecheck` | Type-check both workspaces |

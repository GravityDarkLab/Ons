# Matching

Privacy-oriented couple matching platform — monorepo.

```
matching/
├── api/                  ← Backend  (Bun + Hono + MongoDB)
├── frontend/             ← Frontend (Vite + React + Tailwind)
├── scripts/              ← Shared one-shot scripts
│   ├── dev.ts            ← Parallel dev runner (both services, labelled output)
│   └── seed.ts           ← Seeds the questionnaire into MongoDB
├── docker-compose.yml    ← Production
├── docker-compose.dev.yml← Development (hot reload via volume mounts)
└── openapi.yaml          ← Full API spec
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

# Frontend
cp frontend/.env.example frontend/.env.local
# Fill in: VITE_INVITE_KEY, VITE_API_URL
# VITE_INVITE_KEY → openssl rand -hex 8
```

### 3. Seed the database
```bash
bun run seed   # runs scripts/seed.ts → api/src/seeds/questionnaire.seed.ts
```

### 4. Start dev servers

| Command              | What starts                              |
|----------------------|------------------------------------------|
| `bun run dev`        | Both api + frontend (coloured output)    |
| `bun run dev:api`    | API only → http://localhost:3001         |
| `bun run dev:frontend` | Frontend only → http://localhost:5174  |

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
# Set required build args first
export VITE_INVITE_KEY=your-key
export VITE_API_URL=https://api.yourdomain.com

docker compose up --build         # all services
docker compose up api --build     # api + mongo only
docker compose up frontend --build
```

> **Note:** `api/.env` must exist for production — the compose file marks it `required: true`.

---

## Architecture

**Privacy model:** Instagram handles are never stored in the applicant profile.  
They are AES-256-GCM encrypted in a separate `identities` collection and  
resolvable only by admins. Every admin identity access is audit-logged.  
Applicants are identified by a human-friendly alias e.g. "Blue Falcon".

### Collections

| Collection | What lives here |
|---|---|
| `questionnaires` | Versioned form schemas — `sensitive: true` flag drives PII routing |
| `applicants` | Public matching profiles — zero PII |
| `identities` | Encrypted Instagram handles — admin only |
| `audit_logs` | Every admin identity access |

### API surface

```
GET  /health

POST /api/v1/form/submit

POST   /api/v1/admin/login
GET    /api/v1/admin/applicants
GET    /api/v1/admin/applicants/:id
GET    /api/v1/admin/applicants/:id/identity   ← audit logged
DELETE /api/v1/admin/applicants/:id
GET    /api/v1/admin/audit-logs

GET  /api/v1/matching/candidates/:id
POST /api/v1/matching/run
```

Full spec: [`openapi.yaml`](./openapi.yaml)

---

## Scripts reference

| Command | Description |
|---|---|
| `bun run dev` | Start both services in parallel |
| `bun run dev:api` | Start API only |
| `bun run dev:frontend` | Start frontend only |
| `bun run seed` | Seed questionnaire v1.0.0 into MongoDB |
| `bun run build` | Build both workspaces |
| `bun run typecheck` | Type-check both workspaces |

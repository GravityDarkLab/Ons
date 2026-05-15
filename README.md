# Matching Backend

Privacy-oriented couple matching platform backend built with Bun, Hono, and MongoDB.

## Architecture

The core privacy guarantee: **Instagram handles are never stored in the applicant profile.** They are AES-256-GCM encrypted and kept in a separate `identities` collection, resolvable only by authorized admins (with full audit logging). Applicants are identified throughout the system by a human-friendly alias like "Blue Falcon" or "Silent River".

### Collections

| Collection | What lives here |
|---|---|
| `questionnaires` | Versioned form schemas with question metadata (`sensitive` flag drives PII routing) |
| `applicants` | Public matching profiles — zero PII, identified by alias |
| `identities` | AES-256-GCM encrypted Instagram handles — admin-only |
| `audit_logs` | Every admin identity access logged with IP, user-agent, action |

### Module layout

```
src/
├── server.ts                       # Hono app, Bun native serve
├── config/                         # Env validation, CORS
├── db/                             # MongoDB connection + typed collection accessors
├── models/                         # TypeScript interfaces for all 4 collections
├── privacy/
│   ├── alias.generator.ts          # 36×36 Adjective+Noun codenames, collision-safe
│   ├── encryption.ts               # AES-256-GCM, fresh IV per record
│   └── identity.service.ts        # store / resolve encrypted Instagram handle
├── validators/                     # Zod schemas (age ≥ 18, disclaimer literal true)
├── middleware/                     # JWT auth, audit logging, rate limiting
├── services/                       # Form submission, admin operations, questionnaire
├── controllers/ + routes/          # Thin HTTP handlers
├── matching/
│   ├── engine.ts                   # Plugin-based Algorithm interface + registry
│   ├── algorithms/baseline.ts     # 6-dimension weighted scorer
│   └── scorers/trait.scorer.ts    # Jaccard keyword overlap (AI-ready placeholder)
└── seeds/questionnaire.seed.ts    # Idempotent v1.0.0 questionnaire seed
```

## Getting started

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in MONGODB_URI, ENCRYPTION_KEY, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
# Generate ENCRYPTION_KEY: openssl rand -hex 32
# Generate JWT_SECRET:      openssl rand -base64 48

# 3. Seed the questionnaire
bun run seed

# 4. Start dev server
bun run dev
# → http://localhost:3001
```

## API

### Public

```
POST /api/v1/form/submit
GET  /health
```

### Admin (Bearer JWT)

```
POST   /api/v1/admin/login
GET    /api/v1/admin/applicants?status=active&page=1&limit=20
GET    /api/v1/admin/applicants/:id
GET    /api/v1/admin/applicants/:id/identity   ← audit logged, decrypts Instagram handle
DELETE /api/v1/admin/applicants/:id
GET    /api/v1/admin/audit-logs
```

### Matching (Bearer JWT)

```
GET  /api/v1/matching/candidates/:applicantId?topN=10&algorithm=baseline
POST /api/v1/matching/run
```

## Form submission example

```json
POST /api/v1/form/submit
{
  "questionnaireVersion": "1.0.0",
  "answers": {
    "instagram_handle": "@johndoe",
    "location": "Paris, France",
    "age": 27,
    "height_cm": 178,
    "work": "Software Engineer",
    "gender_identity": "Male",
    "sexual_orientation": "Straight",
    "religion": "Agnostic",
    "vibe_words": "curious, calm, funny",
    "lifestyle": "Social drinker, non-smoker",
    "relationship_type": "Long Term",
    "open_to_long_distance": true,
    "preferred_physical_traits": "Athletic, tall",
    "preferred_character_traits": "Ambitious, kind, funny",
    "deal_breakers": "Dishonesty, smoking",
    "okay_with_opposite_gender_friends": true,
    "religion_deal_breaker": false,
    "physical_affection_importance": 8,
    "dream_first_date": "Coffee at a bookstore, then a walk by the river",
    "disclaimer_agreed": true
  }
}

// Response
{ "success": true, "alias": "Blue Falcon", "applicantId": "64f1a2b3..." }
```

## Security notes

- Server refuses to start if any required env var is missing or malformed
- Rate limiting: 100 req/10 min on form submit, 20 req/min on admin endpoints
- CORS restricted to `ALLOWED_ORIGINS` from env
- All admin identity accesses are audit logged — fire-and-forget, never blocks the response
- `disclaimer_agreed: true` (literal) is required for form submission

## Extending the questionnaire

Add a new question to the `questionnaire.seed.ts` sections array and re-run `bun run seed`. If the field is sensitive, set `sensitive: true` — the form service will automatically route it to the encrypted identity store. No other code changes needed.

## Scripts

```bash
bun run dev        # dev server with hot reload
bun run start      # production server
bun run seed       # seed questionnaire v1.0.0
bun run typecheck  # tsc --noEmit
```


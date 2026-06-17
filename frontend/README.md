# ons-app

React frontend for the Ons matching platform — built with [Vite](https://vitejs.dev), [React 18](https://react.dev), [React Hook Form](https://react-hook-form.com), [Zod](https://zod.dev), and [Tailwind CSS](https://tailwindcss.com).

---

## Requirements

- [Bun](https://bun.sh) ≥ 1.2
- Node.js 22 LTS or 24 LTS. Node 26 currently triggers a Tailwind CSS deprecation warning from `@tailwindcss/node`.
- `ons-api` running (see [`../api/README.md`](../api/README.md))

---

## Setup

```bash
# From the monorepo root
bun install

cp frontend/.env.example frontend/.env.local
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Base URL of the API (e.g. `http://localhost:3001`) |
| `VITE_INVITE_KEY` | Yes | Secret key users must enter to unlock the app |

Generate an invite key:
```bash
openssl rand -hex 8   # e.g. a3f7c2d1e4b09281
```

---

## Running

```bash
# Development (hot reload)
bun run dev          # from frontend/ directory
# or from monorepo root:
bun run dev:frontend

# Production build
bun run build        # outputs to frontend/dist/
bun run preview      # preview the production build locally
```

---

## App flow

The app has three independent route trees:

```
/ (Home)                          ── public form, invite-gated
  └─► /apply  (multi-step form)
        └─► /success  (confirmation)

/profile/login                    ── applicant portal, session-cookie auth
  └─► /profile  (matches + edit answers)

/admin/*                           ── admin panel, session-cookie auth
  └─► /admin/login, dashboard, applicants, matching, matches, audit-logs
```

Access to `/`, `/apply`, and `/success` is gated by `InviteGate` — users must enter the correct `VITE_INVITE_KEY` before they can see any page. `/profile/*` and `/admin/*` are not invite-gated; they use their own session auth instead.

### Pages

| Route | Component | Description |
|---|---|---|
| `/` | `Home.tsx` | Landing page with a "Apply" CTA |
| `/apply` | `Apply.tsx` | 5-step form — fetches active questionnaire from the API |
| `/success` | `Success.tsx` | Post-submission confirmation |
| `/profile/login` | `ProfileLoginPage.tsx` | Applicant login via magic link + password |
| `/profile` | `ProfileDashboard.tsx` | Tabs for viewing matches and editing questionnaire answers |
| `/admin/*` | `admin/pages/*` | Admin panel — dashboard, applicants, matching, matches, audit logs (see [`src/admin/`](./src/admin)) |

### Form steps

The `/apply` page is a wizard that walks the user through the questionnaire:

| Step | Component | What it collects |
|---|---|---|
| 1 | `Step1Identity.tsx` | Instagram handle, location |
| 2 | `Step2AboutYou.tsx` | Birth date, height, work, gender identity, sexual orientation, religion |
| 3 | `Step3Vibe.tsx` | Vibe words, lifestyle description |
| 4 | `Step4Preferences.tsx` | Relationship type, long-distance openness, age gap preference (max gap + open to older/younger, shown conditionally), preferred traits, deal breakers |
| 5 | `Step5Final.tsx` | Physical affection importance, dream first date, disclaimer agreement |

The questionnaire schema is fetched dynamically from `GET /api/v1/form/questionnaire` so the form always reflects the latest active version. The `X-Submission-Key` returned by that endpoint is sent as a header with `POST /api/v1/form/submit` to prevent version enumeration.

### Applicant portal

`/profile/login` accepts a magic link issued by an admin and, on first login, prompts the applicant to set a password. `/profile` (`ProfileDashboard.tsx`) has two tabs:

- **Matches** — score breakdown vs. each match, request/accept identity reveal, report an outcome.
- **Profile** — edit questionnaire answers, change password, theme/language settings, and account deactivation/deletion (`DeletionCountdown.tsx`).

### Internationalization

UI strings are translated via [`i18next`](https://www.i18next.com) (`src/i18n/`). Supported locales: `en`, `fr`, `ar`, `de` — `ar` renders right-to-left. `LanguageSwitcher` lets users change locale at runtime.

---

## Project structure

```
frontend/
├── src/
│   ├── admin/           ← Admin panel (session auth, separate from the public form)
│   │   ├── api/            ← Admin API client functions
│   │   ├── components/     ← AdminLayout, ProtectedRoute, MatchingPulse
│   │   ├── context/        ← AuthContext / AuthProvider
│   │   └── pages/          ← Dashboard, Applicants, ApplicantDetail, Matching, Matches, AuditLogs, Login
│   ├── api/             ← API client functions (typed fetch wrappers)
│   ├── components/      ← Shared UI components
│   │   ├── InviteGate.tsx  ← Blocks access until invite key is entered
│   │   ├── layout/         ← Page layout shell
│   │   └── ui/             ← Primitive components (buttons, inputs, etc.)
│   ├── data/            ← Static option lists (cities, occupations, religions)
│   ├── i18n/            ← i18next setup + locale files (en, fr, ar, de)
│   ├── lib/             ← Shared helpers (e.g. age-from-birth-date)
│   ├── pages/           ← Route-level page components
│   │   ├── Home.tsx
│   │   ├── Apply.tsx
│   │   ├── Success.tsx
│   │   └── profile/        ← Applicant portal (ProfileLoginPage, ProfileDashboard, ...)
│   ├── steps/           ← Form wizard step components
│   ├── theme/           ← Theme provider + toggle (light/dark)
│   ├── types/           ← Shared TypeScript types
│   ├── App.tsx          ← Router setup + InviteGate wrapper
│   ├── main.tsx         ← React entry point
│   └── index.css        ← Tailwind base styles
├── .env.example
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## Type-check

```bash
bun run typecheck
```

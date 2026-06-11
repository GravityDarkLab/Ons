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

```
/ (Home)
  └─► /apply  (multi-step form)
        └─► /success  (confirmation)
```

Access to all routes is gated by `InviteGate` — users must enter the correct `VITE_INVITE_KEY` before they can see any page.

### Pages

| Route | Component | Description |
|---|---|---|
| `/` | `Home.tsx` | Landing page with a "Apply" CTA |
| `/apply` | `Apply.tsx` | 5-step form — fetches active questionnaire from the API |
| `/success` | `Success.tsx` | Post-submission confirmation |

### Form steps

The `/apply` page is a wizard that walks the user through the questionnaire:

| Step | Component | What it collects |
|---|---|---|
| 1 | `Step1Identity.tsx` | Basic identity (name, age, gender, orientation) |
| 2 | `Step2AboutYou.tsx` | Lifestyle, religion, long-distance openness |
| 3 | `Step3Vibe.tsx` | Vibe words, lifestyle description, deal breakers |
| 4 | `Step4Preferences.tsx` | Preferred character & physical traits, relationship type |
| 5 | `Step5Final.tsx` | Instagram handle + final submission |

The questionnaire schema is fetched dynamically from `GET /api/v1/form/questionnaire` so the form always reflects the latest active version. The `X-Submission-Key` returned by that endpoint is sent as a header with `POST /api/v1/form/submit` to prevent version enumeration.

---

## Project structure

```
frontend/
├── src/
│   ├── api/             ← API client functions (typed fetch wrappers)
│   ├── components/      ← Shared UI components
│   │   ├── InviteGate.tsx  ← Blocks access until invite key is entered
│   │   ├── layout/         ← Page layout shell
│   │   └── ui/             ← Primitive components (buttons, inputs, etc.)
│   ├── pages/           ← Route-level page components
│   │   ├── Home.tsx
│   │   ├── Apply.tsx
│   │   ├── Success.tsx
│   │   └── InviteGate.tsx
│   ├── steps/           ← Form wizard step components
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

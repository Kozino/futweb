# FutWeb

**Africa-native football talent intelligence.** Verified digital CVs for players,
offline-first scouting for clubs, and a trust layer built specifically to stop
the fake-agent economy that costs Nigerian families thousands of pounds a year.

```
React 18 · TypeScript · Vite · Tailwind · Supabase (Postgres + Auth + Storage)
Flutterwave (NGN + USD billing) · PWA (offline-first) · Netlify / Render
```

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional — see Demo Mode below
npm run dev                    # http://localhost:5173
```

### Demo Mode

If `VITE_SUPABASE_URL` is **not** set, FutWeb boots in **Demo Mode**: every
screen, dashboard and flow is fully interactive against a local store with
realistic Nigerian player and club data. No database, no secrets, no signup.

Use the demo login buttons on `/login`, or the dashboard shortcuts at the bottom
of the landing page. This is deliberate — designers, stakeholders and new
engineers should be able to exercise the whole product without touching
production credentials.

To connect a real backend, fill in `.env.local` and run the migrations.

---

## Connecting Supabase

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Apply schema, RLS, triggers and storage policies
supabase db push

# Generate typed client from your live schema
npm run db:types

# Edge function secrets (never in .env — these are server-side only)
supabase secrets set FLW_SECRET_KEY=...
supabase secrets set FLW_SECRET_HASH=...      # must equal Flutterwave dashboard "Secret Hash"
supabase secrets set APP_URL=https://futweb.app
supabase secrets set ALLOWED_ORIGIN=https://futweb.app

supabase functions deploy create-checkout
supabase functions deploy flutterwave-webhook --no-verify-jwt
```

### Flutterwave dashboard

| Setting | Value |
|---|---|
| Webhook URL | `https://<ref>.supabase.co/functions/v1/flutterwave-webhook` |
| Secret Hash | identical to `FLW_SECRET_HASH` |
| Events | `charge.completed` |

The webhook verifies an **HMAC-SHA512** signature over the raw request body and
compares it in constant time. Unsigned requests are rejected with `401` and
logged to the audit trail.

---

## Deploy

Full step-by-step runbook (order of operations across Supabase, Flutterwave,
and Netlify/Render, including the env vars each one needs from the others):
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Short version:

### Netlify (frontend)

```bash
npm run build      # outputs dist/
```

`netlify.toml` already contains the SPA rewrite, the security header set
(CSP, HSTS, `X-Frame-Options`, `Permissions-Policy`) and immutable asset caching.

### Render

`render.yaml` defines the static site as a Netlify alternative — use one or
the other, not both. The second (billing relay) service in that file is an
unbuilt placeholder and is commented out; Supabase Functions already is the
complete billing backend, so you don't need it.

### Supabase (backend)

Hosted Supabase, or self-host with `supabase start` against the Docker stack.

---

## Project layout

```
src/
├── lib/
│   ├── ratings.ts        # The rating engine — position weighting, age curve,
│   │                     # confidence discounting, trust scoring. Domain core.
│   ├── supabase.ts       # Client + Demo Mode detection
│   ├── constants.ts      # Plans, leagues, navigation
│   └── utils.ts          # Formatting, validation, Nigerian locale data
├── context/
│   ├── AuthContext.tsx   # Session, roles, subscription gate
│   └── OfflineContext.tsx# IndexedDB write-behind queue, sync, data saver
├── components/
│   ├── ui/               # Design system primitives + inline SVG icon set
│   ├── layout/           # App shell, sidebar, public layout
│   ├── player/           # Radar, attribute bars, shareable card
│   └── trust/            # Verification badges, trust panel, safety notices
├── pages/
│   ├── public/           # Marketing site (10 pages)
│   ├── auth/             # Login, register, paywall
│   ├── player/           # Player workspace (7 screens)
│   ├── club/             # Club workspace (8 screens)
│   └── admin/            # Admin console (7 screens)
└── data/mock.ts          # Deterministic demo dataset

supabase/
├── migrations/           # 0001 schema · 0002 RLS · 0003 triggers · 0004 seed+storage
└── functions/            # create-checkout · flutterwave-webhook
```

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Apply migrations |
| `npm run db:types` | Regenerate `src/types/database.ts` |

---

## The three ideas that make this not-generic

**1. Trust is the product, not a feature.**
Every club carries a machine-readable trust score built from eight discrete
checks — CAC registration, NFF/state FA affiliation, NIN/BVN identity, liveness,
references, billing, tenure and conduct. Players see it before they reply.
Charging a player for a trial is blocked by a **database check constraint**, so
no client, bug or stolen token can create a fee-bearing trial posting.

**2. Offline-first, because the network is the hard part.**
Ratings and scout reports are written to IndexedDB first and flushed when
connectivity returns. A scout at a state FA tournament in Makurdi with one bar
of 3G never loses an assessment. The service worker guarantees the shell loads
even with no signal at all.

**3. Ratings that answer the three questions scouts actually ask.**
*Good for this position?* — position-weighted. *Good for his age?* — adjusted
along a development curve to the positional prime. *Can I trust the number?* —
regressed toward the mean by how much independent evidence backs it. The weights
live in the database as well as the client, so a tampered client cannot inflate
its own score.

Full reasoning in [`docs/COMPETITIVE_ANALYSIS.md`](docs/COMPETITIVE_ANALYSIS.md).

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/COMPETITIVE_ANALYSIS.md`](docs/COMPETITIVE_ANALYSIS.md) | Incumbent weaknesses, sourced, and how each is inverted |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, data model, offline sync, rating engine |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model, RLS, payment integrity, NDPA 2023, minors |
| [`docs/RATING_MODEL.md`](docs/RATING_MODEL.md) | The maths, with worked examples |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Step-by-step: Supabase → Flutterwave → Netlify/Render, in the order that avoids placeholder-URL rework |
| [`supabase/README.md`](supabase/README.md) | Backend runbook: local dev, migration map, RPC reference, env vars, RLS testing, troubleshooting |

---

## Status

Frontend complete and verified: **35 routes**, TypeScript strict-mode clean,
production build passing. Backend schema, RLS, triggers and both edge functions
written; migrations have not yet been run against a live Supabase project.

Built in Nigeria, for the game.

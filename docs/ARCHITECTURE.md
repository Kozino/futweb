# Architecture

## System overview

```
┌──────────────────────────────────────────────────────────────┐
│  Browser / PWA                                               │
│  React 18 · TypeScript · Tailwind · React Router             │
│                                                              │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────────┐   │
│  │  UI layer  │ │ OfflineQueue │ │  Rating engine (local)│   │
│  │  35 routes │ │  (IndexedDB) │ │  position/age/conf    │   │
│  └─────┬──────┘ └──────┬───────┘ └───────────┬───────────┘   │
└────────┼───────────────┼─────────────────────┼───────────────┘
         │               │                     │
         ▼               ▼                     │
┌─────────────────────────────────┐            │
│  Supabase                       │            │  weights mirrored
│  ├─ Auth (JWT, MFA-capable)     │◄───────────┘  server-side so a
│  ├─ Postgres + RLS              │               tampered client
│  ├─ Storage (4 buckets)         │               cannot inflate
│  └─ Edge Functions (Deno)       │               its own score
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Flutterwave                    │
│  charge.completed → webhook     │
│  HMAC-SHA512 verified, idempotent│
└─────────────────────────────────┘
```

---

## The two-environment design

The single most consequential architectural decision: **the app must be fully
usable with no backend at all.**

```ts
// src/lib/supabase.ts
export const hasSupabase = Boolean(URL && ANON)
export const DEMO_MODE = !hasSupabase
```

When `VITE_SUPABASE_URL` is absent, `supabase` is `null` and the app runs against
a localStorage-backed session plus a deterministic mock dataset
(`src/data/mock.ts`). Every screen works. This means:

- Designers and stakeholders review the real product, not a Figma file.
- New engineers run `npm install && npm run dev` with zero setup.
- Demos to academies work without carrying production credentials.
- No `if (demo)` branches scattered through screens — the *data layer* differs,
  the components do not.

---

## Data model

### Tenancy

Three subject types, one `profiles` table as the identity root:

```
auth.users ──1:1── profiles ──1:1── players
                      │
                      └──1:N── clubs (owner_id)
                                  │
                                  └──N:M── org_members (staff + roles)
```

`org_members` is the RBAC join table. A user can belong to several clubs with
different roles in each.

### Key relationships

| Table | Purpose | Notable constraint |
|---|---|---|
| `players` | The talent record | `is_minor` is a **generated column**; a check constraint forbids a minor without guardian consent |
| `player_attributes` | Current 32-attribute profile | Wide table, not jsonb — enables indexed range scans for discovery |
| `rating_snapshots` | Every rating ever | **Immutable** — a trigger raises on UPDATE/DELETE |
| `match_stats` | Per-season counts | `verified` flag separates federation data from self-reported |
| `media_assets` | Video and images | Carries `recorded_at` / `recorded_location` for provenance |
| `trial_postings` | Club-run trials | `fee_charged_to_player` constrained to `0` |
| `payments` | Money ledger | Status transitions restricted by trigger; amounts immutable |
| `audit_log` | Append-only event log | UPDATE/DELETE raise; INSERT only via security-definer |

### Denormalisation

`players.futweb_score`, `.potential` and `.confidence` are denormalised from the
rating snapshots. Discovery filters on them constantly; recomputing on every
query would be unacceptable. A background job recalculates after new snapshots.

---

## The rating engine

Lives in `src/lib/ratings.ts` and is **mirrored** in SQL
(`compute_trust_score`, plan pricing). See [`RATING_MODEL.md`](RATING_MODEL.md).

Pipeline:

```
raw attributes
   │
   ├─► position weighting ──► weightedScore(attrs, group)
   │                              │
   ├───────────────────────────►  raw composite
   │
   ├─► confidence discount ──►  shrink 0–30% toward mean(50)
   │                              │
   ├───────────────────────────►  FutWeb Score  ("now")
   │
   └─► age curve ────────────►  projected peak ("potential")
```

---

## Offline sync

**Design constraint:** a scout entering a rating must never lose work, ever.

```
  user submits rating
        │
        ▼
  enqueue() → IndexedDB  ◄── ALWAYS succeeds, even with no network
        │
        ├── (offline) ──► badge "N records pending"
        │                 flushes on: online event · window focus · manual
        │
        └── (online) ──► POST to sync endpoint
                              │
                              ├─ 200 → mark synced, prune
                              └─ err → attempts++, keep for retry
```

IndexedDB is wrapped in try/catch throughout. In private browsing, where it is
unavailable, the queue degrades to in-memory and the UI still reports pending
work — degraded, never broken.

The service worker caches the **app shell** separately, so the app opens even
with no connectivity. Data capture is a separate concern from shell delivery,
and the two fail independently.

---

## Authorisation layers

Four independent layers. Compromising one does not compromise the product.

| Layer | Mechanism | Stops |
|---|---|---|
| 1. Route guard | `RequireAuth`, `RequireRole`, `RequireSubscription` | UX-level navigation to wrong surfaces |
| 2. Row Level Security | Postgres policies on all 22 tables | Cross-tenant data access, even with a valid JWT |
| 3. Edge function | Re-derives user from verified JWT; server-side pricing | Tampered client payloads, price manipulation |
| 4. Database constraints | `check`, `generated`, triggers | Invalid states regardless of caller |

**Layer 1 is explicitly not a security boundary.** It exists so users do not see
a forbidden screen; the enforcement is layer 2.

---

## Frontend structure

### Design system

No component library. Primitives in `src/components/ui/`, built on Tailwind
tokens defined in `tailwind.config.js`:

- **Palette:** deep ink (`#0A0F1C`) as the base, red (`#E4002B`) as the action
  colour, white for surface, gold (`#F5B301`) for verification/premium, green
  (`#00B67A`) for trust. The gold/green split is deliberate — gold means
  *premium*, green means *verified*. They are never interchangeable.
- **Icons:** a hand-built inline SVG set (52 icons). No icon dependency, so
  nothing to load over a slow network and no bundle cost.
- **Type:** Inter for UI, Bebas Neue for numeric display (scores, totals).

### Accessibility baseline

- Visible focus ring on `:focus-visible` (WCAG 2.4.7).
- `prefers-reduced-motion` honoured globally.
- Semantic landmarks, labelled form controls, `aria-invalid` on errors.
- Modals trap Escape, restore scroll, and use `role="dialog"`.
- Colour is never the only signal — badges pair colour with icon and text.

### Performance

- Manual chunk splitting: vendor / supabase / charts / app.
- Charts (Recharts) are the largest chunk and only load where used.
- Deterministic mock data with a seeded PRNG — no flicker across reloads.

---

## Deployment

| Surface | Platform | Notes |
|---|---|---|
| Frontend | Netlify (or Render static) | SPA rewrite; security headers in `netlify.toml` |
| Database / Auth | Supabase (or Render + managed Postgres) | Migrations in `supabase/migrations/` |
| Billing | Supabase Edge Functions | `create-checkout`, `flutterwave-webhook` |
| Media | Supabase Storage | 4 buckets with distinct policies |

Content-Security-Policy allows only `self`, Supabase, Flutterwave and Google
Fonts. `frame-ancestors 'none'` prevents clickjacking regardless of the
`X-Frame-Options` fallback.

---

## Known gaps before production

1. Migrations not yet applied to a live Supabase project.
2. `db:types` generated schema (`src/types/database.ts`) not committed — the app
   uses hand-written domain types in `src/types/index.ts`.
3. No automated test suite. Given the billing and RLS surface, this is the
   highest-priority gap.
4. Offline sync currently simulates the server round-trip; the real endpoint
   needs implementing against the same RLS guarantees.
5. Video transcoding pipeline not built.

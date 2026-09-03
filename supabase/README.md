# FutWeb backend

This directory **is** the backend: Postgres schema, Row Level Security,
privileged SQL procedures, and the two Deno edge functions that talk to
Flutterwave. There is no separate application server — Supabase (hosted
Postgres + Auth + Storage + Edge Functions) is the entire backend surface,
and every write that matters (billing, trust scores, verification) is
enforced in the database, not in application code that a client could bypass.

For the *why* behind these choices, read [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
and [`../docs/SECURITY.md`](../docs/SECURITY.md) first — this file is the
hands-on companion: how to run it, extend it, and not break it.

```
supabase/
├── migrations/                  Applied in order, 0001 → 0005. Never edit an
│   ├── 0001_schema.sql          applied migration — write a new one.
│   ├── 0002_rls.sql
│   ├── 0003_functions.sql
│   ├── 0004_seed_storage.sql
│   └── 0005_public_directory.sql
└── functions/
    ├── _shared/
    │   ├── cors.ts               CORS headers + JSON response helper
    │   └── rateLimit.ts          Deno KV sliding-window rate limiter
    ├── create-checkout/          Authenticated: starts a Flutterwave charge
    └── flutterwave-webhook/      Public (--no-verify-jwt): settles it
```

---

## Migration map — what each file is responsible for

| File | Responsible for |
|---|---|
| `0001_schema.sql` | Enums, all 22 tables, indexes. No RLS yet — nothing is queryable by a client until 0002 runs. |
| `0002_rls.sql` | Enables RLS on every table, the `security definer` helper functions (`is_admin`, `can_view_player`, `my_club_ids`, …) and every policy. Ends with the `grant` block — **policies filter rows, grants gate table access; both are required.** |
| `0003_functions.sql` | Triggers (`updated_at`, append-only audit log, immutable payments/ratings, minor guardian gate, seat accounting hooks) and the privileged procedures: `handle_new_user`, `compute_trust_score`, `refresh_trust_and_tier`, `activate_subscription`. |
| `0004_seed_storage.sql` | Plan catalogue seed, the 4 storage buckets + their policies, the `player_search` view, seat-limit enforcement trigger. |
| `0005_public_directory.sql` | Anon-readable views (`public_player_profiles`, `public_clubs`, …) that back the marketing site's talent directory — a strict subset of columns, never raw contact or guardian data, never a minor's exact date of birth. |

Migrations are not idempotent by accident — they're idempotent by design
(`create or replace`, `drop policy if exists`, `on conflict do nothing`), so
re-running `supabase db push` against a project that already has some of
these applied is safe.

---

## Local development

Requires Docker and the Supabase CLI (`npm install -g supabase` or via your
package manager).

```bash
supabase start                 # spins up local Postgres, Auth, Storage, Studio
supabase db reset              # applies all migrations to the local db, fresh
```

`supabase start` prints a local `API URL` and `anon key` — put those in the
project's `.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to
run the frontend against your local stack instead of Demo Mode.

Studio (table editor, SQL runner, auth users, logs) is at the URL printed by
`supabase start`, typically `http://localhost:54323`.

### Adding a migration

```bash
supabase migration new <short_description>
```

Write forward-only SQL. If you need to change a table shape that already
shipped to production, write an `alter table` in the new file — do not edit
`0001_schema.sql` after it has been applied anywhere.

### Regenerating types for the frontend

```bash
npm run db:types
```

This writes `src/types/database.ts` from whichever project your CLI is
currently linked to (local or remote). The frontend currently ships with
hand-written domain types in `src/types/index.ts` instead — regenerate and
wire in the generated types once the schema is stable, so drift between the
database and the client is caught at compile time rather than at runtime.

### Edge functions locally

```bash
supabase functions serve create-checkout --env-file supabase/functions/.env.local
supabase functions serve flutterwave-webhook --env-file supabase/functions/.env.local --no-verify-jwt
```

`--no-verify-jwt` on the webhook matters: Flutterwave calls it without a
Supabase session, so the platform's own JWT gate must be off. Authentication
for that endpoint is the HMAC signature check inside the function itself, not
Supabase's request-level gate — the two are different layers on purpose.

To exercise the webhook locally without a real Flutterwave account, sign a
test body yourself:

```bash
BODY='{"event":"charge.completed","data":{"tx_ref":"FW-ABC123-000000","status":"successful","amount":3500,"currency":"NGN","id":"12345"}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha512 -hmac "$FLW_SECRET_HASH" | sed 's/^.* //')
curl -X POST http://localhost:54321/functions/v1/flutterwave-webhook \
  -H "Content-Type: application/json" -H "verif-hash: $SIG" -d "$BODY"
```

(`tx_ref` must already exist as a `pending` row in `payments` — created by
`create-checkout` — or `activate_subscription` correctly rejects it. See
"Testing the payment flow end-to-end" below.)

---

## Environment variables

| Variable | Where it lives | Notes |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Frontend `.env.local` | Public by design — RLS is the actual boundary. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Edge function env (auto-injected by Supabase) | Used to build the request-scoped client that re-derives the caller from their JWT. |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase secrets set` only | Bypasses RLS entirely. Never in `.env`, never in frontend code, never logged. |
| `FLW_SECRET_KEY` | `supabase secrets set` only | Flutterwave secret key — server-side charge creation. |
| `FLW_SECRET_HASH` | `supabase secrets set` only | Must exactly match the "Secret Hash" configured in the Flutterwave dashboard; this is what the webhook HMAC-verifies against. |
| `APP_URL` | `supabase secrets set` | Redirect target after checkout. |
| `ALLOWED_ORIGIN` | `supabase secrets set` | Locks down edge-function CORS to the real frontend origin in production; defaults to `*` only when unset, which is fine for local dev and wrong for production — set it before going live. |

```bash
supabase secrets set FLW_SECRET_KEY=...
supabase secrets set FLW_SECRET_HASH=...
supabase secrets set APP_URL=https://futweb.app
supabase secrets set ALLOWED_ORIGIN=https://futweb.app
```

---

## RPC / privileged function reference

These are `security definer` and most have their direct-execute grant
revoked from `anon`/`authenticated` — they're either called through a
trigger, or (for `activate_subscription`) only from the service-role client
inside the webhook. Documented here because they carry the actual business
rules; the tables alone don't tell that story.

| Function | Called by | Does |
|---|---|---|
| `handle_new_user()` | `AFTER INSERT` trigger on `auth.users` | Creates the `profiles` row, and for a club signup, the `clubs` + `org_members` rows, atomically. Records initial ToS consent. |
| `compute_trust_score(uuid)` | `refresh_trust_and_tier` | Pure calculation, no writes. Mirrors the weighting in `src/lib/ratings.ts` — **if you change the formula, change it in both places or the client and server will disagree.** |
| `refresh_trust_and_tier(uuid)` | `on_verification_decided` trigger, `activate_subscription` | Recomputes score + tier and writes them, then audits the change. |
| `on_verification_decided()` | `AFTER UPDATE` trigger on `verification_requests` | The only path that can mark identity/liveness/entity verified. Re-checks `is_admin()` even though RLS already gates the `UPDATE` — defence in depth against a future policy mistake. |
| `activate_subscription(...)` | Webhook only, via service-role `admin.rpc(...)` | Idempotent on `tx_ref`; re-verifies the paid amount against the plan price server-side before activating anything. Raises if no matching pending payment row exists — it never invents a subscription from an unrecognised reference. |
| `enforce_player_seats()` | `AFTER INSERT OR UPDATE OF managed_by_club_id` trigger on `players` | Rejects adding a player past the club's plan seat limit; the check lives here so a client bug can't silently create unbilled seats. |
| `players_guard_minor()` | `BEFORE INSERT OR UPDATE` trigger on `players` | Refuses to save an under-18 profile without guardian name + consent timestamp, and force-downgrades `visibility` to `verified_only` even if the client sent `public`. |
| `log_audit(...)` | Called from most of the above | Single write path into `audit_log`; the table itself has no client-facing insert policy. |

---

## Testing the payment flow end-to-end

1. `POST /functions/v1/create-checkout` with a valid user JWT and
   `{ "plan_code": "player_pro", "interval": "monthly" }` (optionally
   `"currency": "USD"` — the amount is still resolved from `plans`, the
   client only picks which currency column and payment rail to use).
2. This inserts a `pending` row in `payments` and returns a
   `payment_link` from Flutterwave.
3. Completing payment (or the curl-signed test above) fires the webhook,
   which calls `activate_subscription`. Confirm:
   - `payments.status` → `successful`, `settled_at` set.
   - `subscriptions` has an `active` row for that subscriber.
   - `profiles.sub_status` → `active`.
   - `audit_log` has `checkout.created`, `webhook.payment_successful`
     (or `subscription.activated`), and `trust.recalculated` rows.
4. Replay the exact same webhook body — it must return the same result
   without creating a second subscription or a duplicate payment. This is
   the single most important test in the whole backend; a regression here
   is a billing incident.

---

## Verifying RLS from the SQL editor

`supabase db reset` seeds nothing user-specific, so create a couple of test
auth users first (Studio → Authentication → Add user, or `supabase.auth.signUp`
from the frontend against your local stack). Then, as the Postgres superuser:

```sql
-- Impersonate a specific authenticated user and confirm what they can see.
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
select * from public.players;   -- should return only rows can_view_player() allows
reset role;
```

Prefer `supabase test db` (pgTAP) for anything you want to keep passing —
see "Known gaps" in `../docs/ARCHITECTURE.md`; an automated RLS suite is the
highest-leverage thing to add before this goes to production traffic.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Client gets an empty result instead of an error | Working as designed — a denied `SELECT` returns zero rows, not a `403`, so an attacker can't tell whether a row exists. Check the relevant policy in `0002_rls.sql`, not the client code. |
| `new row violates row-level security policy` on insert | The `with check` clause failed. Usually means either the wrong `auth.uid()` context (are you testing as `service_role` and expecting `authenticated` behaviour, or vice versa?) or a genuinely missing membership/ownership row. |
| `webhook.signature_invalid` in `audit_log` for a real Flutterwave event | `FLW_SECRET_HASH` doesn't match the dashboard's "Secret Hash" byte-for-byte, or the raw body was re-serialised before hashing (it must be signed over the exact bytes received — this function reads the body with `req.text()` for that reason; don't change it to `req.json()` first). |
| `activate_subscription` raises "no pending payment for tx_ref" | Either a forged/foreign `tx_ref` (correctly rejected), or `create-checkout`'s insert into `payments` failed silently upstream — check the edge function logs for that request. |
| Migration fails with "extension already exists" or similar on a fresh `db reset` | Usually a leftover local Docker volume from a previous project. `supabase stop --no-backup` then `supabase start` to get a clean instance. |
| `player_seats_used` looks wrong after removing/reassigning a player | `enforce_player_seats()` increments on assignment but there is currently no corresponding decrement trigger for removal/reassignment — reconcile manually via `select count(*) from players where managed_by_club_id = ...` until that trigger is added. |

---

## Changelog (backend-specific)

- **Currency selection fixed in `create-checkout`.** The function previously
  computed `currency` from a ternary that always evaluated to `'NGN'`
  regardless of the branch taken, silently ignoring the USD pricing the
  Pricing page already offers. It now reads an explicit, validated
  `currency` field from the request body (`'USD'` or default `'NGN'`); the
  charged amount is still resolved exclusively from the server-side `plans`
  row either way, so this does not weaken the "client can't set its own
  price" guarantee.
- **Exact date of birth removed from every public/anon-readable view**
  (`public_player_profiles` in `0005_public_directory.sql`). Only the
  derived `age` is exposed publicly now; raw `dob` remains available to the
  player themself, their managing club, and admins through the ordinary
  RLS-protected `players` table. This closes a gap the existing minors
  protections didn't cover: guardian consent gates *visibility*, but an
  unnecessarily precise DOB on an otherwise-public profile is its own
  data-minimisation problem under NDPA 2023, independent of consent status.
- **`activate_subscription` now raises explicitly** when called with a
  `tx_ref` that has no matching pending `payments` row, instead of falling
  through with a null payment record and a confusing "unknown plan" error.

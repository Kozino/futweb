# Deployment runbook

This is the order-of-operations to get FutWeb live for real testing:
**Supabase first** (nothing else works without it), **then Flutterwave**
(needs a live webhook URL from Supabase), **then Netlify** (needs the
Supabase URL/keys), **then a final loop back to Supabase and Flutterwave**
to register the real Netlify origin. Doing it in a different order means
copy-pasting placeholder URLs and fixing them later — this order avoids that.

Render is **optional** — a same-purpose alternative to Netlify for the
frontend, not an additional required piece. Use one or the other. Skip to
[§5](#5-optional-render-instead-of-netlify) if that's your choice.

You need accounts on: Supabase, Netlify (or Render), Flutterwave (Business
account, test mode is fine to start), and your GitHub repo pushed somewhere
Netlify/Render can pull from.

---

## 0. Local prerequisites

```bash
npm install -g supabase
npm install          # in the project root
```

---

## 1. Supabase — the backend

### 1.1 Create the project

Dashboard → New project. Pick a region close to your users (e.g. a European
region for lowest latency to Nigeria/Qatar — Supabase has no West Africa
region yet). Note the **Project Reference** (`<ref>` below) and the database
password.

### 1.2 Link and push the schema

```bash
supabase login
supabase link --project-ref <ref>
supabase db push          # applies 0001–0005 in order
```

Confirm it worked: Dashboard → Table Editor should show 22+ tables, and
Database → Functions should list `activate_subscription`,
`compute_trust_score`, `handle_new_user`, etc.

### 1.3 Set edge function secrets

These are **never** committed and never go in `.env` files that ship to the
browser — see the variable table in [`../supabase/README.md`](../supabase/README.md#environment-variables)
for what each one is.

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<from Project Settings → API>
supabase secrets set FLW_SECRET_KEY=<Flutterwave test secret key>
supabase secrets set FLW_SECRET_HASH=<pick any strong random string for now>
supabase secrets set APP_URL=https://futweb.app          # placeholder — fixed in §4
supabase secrets set ALLOWED_ORIGIN=https://futweb.app   # placeholder — fixed in §4
```

`FLW_SECRET_HASH` isn't fetched from Flutterwave — you invent it, then paste
the *same* value into the Flutterwave dashboard in §2. Use something like
`openssl rand -hex 32`.

### 1.4 Deploy the two functions

```bash
supabase functions deploy create-checkout
supabase functions deploy flutterwave-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required — Flutterwave calls it without a
Supabase session. Do **not** add that flag to `create-checkout`; it must stay
JWT-protected, since that's what proves the caller is a real logged-in user.

Your webhook's public URL is now:
```
https://<ref>.supabase.co/functions/v1/flutterwave-webhook
```
Copy it — you need it in the next step.

### 1.5 Auth URL configuration

Dashboard → Authentication → URL Configuration:
- **Site URL**: your production frontend URL (placeholder for now, fixed in §4)
- **Redirect URLs**: add `<your-frontend-url>/auth/callback` — this is where
  `AuthContext.tsx` sends users after email confirmation
  (`emailRedirectTo: window.location.origin + '/auth/callback'`).

You'll revisit both once the real Netlify URL exists.

### 1.6 Get your frontend credentials

Dashboard → Project Settings → API. You need:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

Both are safe to expose to the browser by design — Row Level Security, not
key secrecy, is what protects the data. Never take the `service_role` key
out of Supabase secrets.

---

## 2. Flutterwave — payments

Dashboard → Settings → Webhooks:

| Setting | Value |
|---|---|
| Webhook URL | `https://<ref>.supabase.co/functions/v1/flutterwave-webhook` (from §1.4) |
| Secret Hash | exactly the value you set as `FLW_SECRET_HASH` in §1.3 |
| Events | `charge.completed` |

Settings → API: copy the **Public Key** (goes to Netlify as
`VITE_FLUTTERWAVE_PUBLIC_KEY`) and confirm the **Secret Key** matches what
you set as `FLW_SECRET_KEY` in §1.3. Stay in **test mode** until you've run
the checkout flow through at least once end-to-end (§6).

---

## 3. Netlify — the frontend

### 3.1 Connect the repo

Netlify → Add new site → Import an existing project → pick your repo.
`netlify.toml` already defines the build command (`npm run build`), publish
directory (`dist`), the SPA rewrite, and the full security-header set
(CSP, HSTS, `X-Frame-Options`, etc.) — you don't need to configure any of
that in the dashboard.

### 3.2 Environment variables

Site configuration → Environment variables → add:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | from §1.6 |
| `VITE_SUPABASE_ANON_KEY` | from §1.6 |
| `VITE_FLUTTERWAVE_PUBLIC_KEY` | from §2 |
| `VITE_APP_URL` | your Netlify URL, e.g. `https://futweb.netlify.app` (or custom domain) |

Deploy. If the build fails on `tsc -b` type errors, run `npm run typecheck`
locally first and fix those before retrying — Netlify's build is stricter
than dev mode by design (`npm run build` = typecheck + build).

### 3.3 Note your real URL

Whatever Netlify assigns (or your custom domain) is what every placeholder
URL in §1 needs to become. That's §4.

---

## 4. Close the loop — wire the real URLs back in

This is the step people skip and then can't figure out why login redirects
or CORS break. Once you know your real frontend URL:

```bash
supabase secrets set APP_URL=https://<your-real-netlify-url>
supabase secrets set ALLOWED_ORIGIN=https://<your-real-netlify-url>
supabase functions deploy create-checkout           # re-deploy to pick up new secrets
supabase functions deploy flutterwave-webhook --no-verify-jwt
```

Then in the Supabase dashboard:
- Authentication → URL Configuration → **Site URL** = your real Netlify URL
- **Redirect URLs** → replace the placeholder with `<your-real-url>/auth/callback`

If `ALLOWED_ORIGIN` doesn't match the origin the browser sends, `create-checkout`
requests will fail CORS silently in the browser console — this is the single
most common integration bug across this stack, and it only shows up after
the frontend is deployed somewhere real, which is exactly why this step
exists.

---

## 5. (Optional) Render instead of Netlify

`render.yaml` defines a static site service equivalent to §3 — use it
instead of Netlify, not in addition to it. Render → New → Blueprint → point
at the repo; it reads `render.yaml` automatically. Set the same two env vars
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Render dashboard —
`VITE_FLUTTERWAVE_PUBLIC_KEY` and `VITE_APP_URL` aren't declared in
`render.yaml`'s env list, so add them there too if you go this route.

Ignore the second (commented-out) service in `render.yaml` — it's an
unbuilt placeholder for running billing outside Supabase Functions, which
you don't need; §1–§2 already gives you a complete, working billing backend.

Whichever host you pick, repeat §4 with that host's URL instead of Netlify's.

---

## 6. Verify the whole thing actually works

Walk through this on the deployed site, not locally — integration bugs live
in the gaps between services, which local dev with Demo Mode never exercises.

1. **Sign up** as a club account. Confirm the email arrives and the
   `/auth/callback` redirect lands you back in the app logged in, not on an
   error page (this exercises §1.5/§4's redirect URL).
2. **Check `profiles` and `clubs`** in Supabase Table Editor — both rows
   should exist, created atomically by `handle_new_user()`.
3. **Start a checkout** from the Pricing/Paywall page. Confirm a `pending`
   row appears in `payments` and you land on the real Flutterwave checkout
   page (exercises `create-checkout` + CORS from §4).
4. **Pay with a Flutterwave test card** ([test cards list](https://developer.flutterwave.com/docs/integration-guides/testing-helpers)).
   Confirm: `payments.status` → `successful`, a row appears in
   `subscriptions`, `profiles.sub_status` → `active`, and `audit_log` shows
   `webhook.payment_successful` — this exercises the entire signature
   verification + idempotency + amount-check chain in
   `flutterwave-webhook` → `activate_subscription`.
5. **Reload the app** and confirm the paywall reflects the new active plan.

If step 3 fails with a CORS error in the browser console, it's almost always
`ALLOWED_ORIGIN` — go back to §4. If step 4 never updates the database, check
Supabase → Edge Functions → `flutterwave-webhook` → Logs, and cross-reference
with the troubleshooting table in
[`../supabase/README.md`](../supabase/README.md#troubleshooting).

---

## Summary: what lives where

| Concern | Platform |
|---|---|
| Static frontend (React build) | Netlify **or** Render — pick one |
| Database, Auth, Storage, RLS | Supabase |
| `create-checkout`, `flutterwave-webhook` | Supabase Edge Functions |
| Payment processing | Flutterwave |
| DNS / custom domain | Wherever you bought it, pointed at Netlify/Render |

Nothing in this stack needs Render *and* Netlify *and* a separate billing
server simultaneously — the three-platform setup you asked about is
Supabase (backend) + one frontend host (Netlify or Render) + Flutterwave
(payments). That's the complete, working system.

# Security & Compliance

## Summary

FutWeb handles three categories of sensitive data: **identity documents,
minors' personal data, and payment events.** The controls below are designed
around the assumption that the client is fully compromised.

---

## Threat model

| # | Threat | Control |
|---|---|---|
| T1 | Stolen JWT used to read another tenant's data | RLS on all 22 tables; ownership equality checks |
| T2 | Client tampers with plan/price at checkout | Prices resolved server-side from `plans`; amount re-verified in `activate_subscription` |
| T3 | Forged "payment successful" webhook | HMAC-SHA512 over raw body, constant-time compare |
| T4 | Webhook replay double-activates a subscription | Idempotent on `tx_ref`; DB rejects illegal state transitions |
| T5 | User escalates own role to admin | RLS `with check` pins `role`, `verification_tier`, `sub_status` to current values |
| T6 | Minor exposed to unverified club | `can_view_player()` + `players_guard_minor()` trigger; visibility forced to `verified_only` |
| T7 | Player charged for a trial | `check (fee_charged_to_player = 0)` — database-enforced |
| T8 | Admin rewrites the audit trail | `BEFORE UPDATE OR DELETE` trigger raises unconditionally |
| T9 | Impersonation of a real club | Liveness check; CAC + NFF/state FA entity verification |
| T10 | Object storage enumeration | Per-bucket policies keyed on `auth.uid()` folder prefix |
| T11 | search_path hijack in a definer function | Every definer function sets `search_path = public, pg_temp` |
| T12 | Credential stuffing / brute force | Supabase Auth rate limits; MFA available; consider CAPTCHA at scale |
| T13 | Inflated self-rating passed off as verified | Confidence discount; weights mirrored server-side |
| T14 | XSS via user-supplied bio/notes | React escapes by default; CSP with no `unsafe-eval` |

---

## Row Level Security

All 22 tables have RLS enabled. The model:

- **Identity** comes only from `auth.uid()`. Client-supplied ids are never
  trusted for authorisation.
- **Tenant isolation** uses equality against an owner column, resolved through
  `security definer` helper functions so Postgres can use indexes:

```sql
create function public.my_club_ids() returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.club_id from public.org_members m
  where m.user_id = auth.uid() and m.revoked_at is null
$$;
```

- **Denied reads return zero rows, not an error.** Deliberate: it prevents an
  attacker from enumerating which ids exist.

### Privilege note (important)

RLS policies **filter** rows; they do not **grant** access. A role without the
underlying table privilege can never see a row, no matter how permissive the
policy. `0002_rls.sql` therefore grants minimal table privileges to
`authenticated` and relies on policies for row filtering. `anon` may read only
the public plan catalogue.

### Player visibility

```sql
can_view_player(pid) :=
     is_admin()
  OR player.user_id = auth.uid()
  OR player.managed_by_club_id IN my_club_ids()
  OR (visibility = 'public'          AND has_active_sub())
  OR (visibility = 'verified_only'   AND has_active_sub()
                                     AND caller tier ∈ {identity, entity, gold})
  AND (NOT is_minor OR guardian_consent_at IS NOT NULL)
```

A minor's profile is invisible to every club until guardian consent is recorded,
and even then is only reachable by verified accounts with an active subscription.

---

## Payment integrity

### Checkout

1. Client POSTs `{ plan_code, interval }` — **no amount, no user id.**
2. Edge function resolves the user from the verified JWT.
3. Plan is looked up **server-side**; audience is validated against account type.
4. A `payments` row is inserted with status `pending` and a unique `tx_ref`.
5. Flutterwave is initialised with the **secret key, which never leaves the
   server.**

### Webhook

```ts
const sig = HMAC-SHA512(SECRET_HASH, rawBody)
if (!timingSafeEqual(sig, provided)) return 401   // logged, no detail returned
```

Then:

- Only our own reference format is processed: `^FW-[A-Z0-9]{6,}-\d{6,}$`.
- `activate_subscription()` re-reads the plan price and **rejects** any
  settlement below it. A tampered client cannot buy a ₦300,000 plan for ₦3,500.
- The subscriber is resolved from the pending `payments` row, never from the
  request body.
- Idempotency: an already-settled `tx_ref` returns the existing row.

### Payment state machine

```
pending ──► successful ──► refunded
   │
   ├──────► failed
   └──────► cancelled
```

Anything else raises `42501`. `amount`, `currency` and `tx_ref` are immutable
after insert. Direct execution of `activate_subscription` is revoked from
`public`, `anon` and `authenticated` — only the service role may settle.

### Rate limiting

Deno KV sliding window: 10 checkouts/hour per user, 30/hour per IP, 60 webhook
events/minute per IP.

---

## Minors (FIFA Art. 19 + NDPA 2023)

Enforced structurally, not by policy document:

```sql
-- Generated, so it can never drift from the date of birth
is_minor boolean generated always as ((dob > (now() - interval '18 years')::date)) stored,

-- A minor cannot exist in the table without a guardian
constraint minor_requires_guardian
  check (not (dob > (now() - interval '18 years')::date)
         or (guardian_name is not null and guardian_consent_at is not null)),
```

Plus a `BEFORE INSERT OR UPDATE` trigger that:
- Rejects any under-18 profile lacking guardian name and consent timestamp.
- **Forces** `visibility` down from `public` to `verified_only` for minors.
- Every club contact with a minor is written to the audit log
  (`minor.contact_recorded`) and mirrored to the guardian.

FIFA Article 19 restricts international transfer of players under 18. FutWeb
blocks direct trial or transfer arrangements with minors entirely; a guardian is
a required party.

---

## NDPA 2023 (Nigeria Data Protection Act)

| Right | Implementation |
|---|---|
| Lawful basis | Consent recorded in `consents` with kind + version + timestamp |
| Data minimisation | Verification documents auto-purge 90 days after decision |
| Right of access | `data_subject_requests` (export), 30-day SLA |
| Right to erasure | `data_subject_requests` (erasure), 30-day SLA |
| Right to rectification | Self-service profile edit; audited |
| Breach notification | Audit trail supports the 72-hour NDPA notification duty |
| Children's data | Guardian consent required; highest-privacy defaults |

`data_subject_requests.due_at` defaults to `now() + 30 days`, matching the
statutory window.

---

## Audit logging

`audit_log` is append-only at the trigger level:

```sql
create trigger trg_audit_no_update before update or delete on public.audit_log
  for each row execute function public.audit_append_only();
```

The function raises `42501` unconditionally — for every role, including
superuser. Logged automatically:

- `user.created`, `profile.role_changed`
- `verification.decided`, `verification.tier_changed`, `trust.recalculated`
- `checkout.created`, `subscription.activated`, `subscription.status_changed`
- `trial.created`, `trial.status_changed`
- `minor.contact_recorded`
- `webhook.signature_invalid`, `webhook.rate_limited`,
  `webhook.activation_rejected`

Failed security events are logged **without detail to the caller** — an attacker
learns nothing from the response.

---

## Transport & browser hardening

Configured in `netlify.toml`:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` — default `self`; no `unsafe-eval`;
  `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=()`

---

## Operational security

- **Secrets.** Only `VITE_SUPABASE_ANON_KEY` and `VITE_FLUTTERWAVE_PUBLIC_KEY`
  reach the browser — both are designed to be public. `SERVICE_ROLE_KEY`,
  `FLW_SECRET_KEY` and `FLW_SECRET_HASH` exist only as edge function secrets.
- **MFA.** Available through Supabase Auth; required for admin and staff roles.
- **Demo Mode.** When `VITE_SUPABASE_URL` is unset the app never contacts a
  backend. No production data can leak into a local or staging build.
- **Least privilege.** Staff roles (`club_admin`, `club_staff`, `scout`) are
  scoped; scouts cannot see billing or manage staff.

---

## Recommended before launch

1. **Automated tests for RLS.** A policy mistake is silent. Use `supabase test
   db` with policies exercised per role.
2. **Penetration test** of the checkout and webhook flow specifically.
3. **Bug bounty** or at minimum a disclosed reporting address.
4. **Backup restore drill** — an untested backup is not a backup.
5. **Independent review** of the verification workflow by someone with Nigerian
   football governance experience (NFF / state FA).
6. **Load test** the discovery endpoint; it is the heaviest query and the one
   most likely to be abused.
7. **Alerting** on `webhook.signature_invalid` and `audit_log` anomalies.

# FutWeb — Go-live runbook (parts an engineer with credentials must do)

Everything in this file is a step **you** run against your Supabase / Netlify /
Flutterwave accounts. The code fixes are already applied and verified in `src/`;
they take effect once you deploy.

> One-time data corrections below target your three **test** accounts and the
> empty score column. For a real launch, create fresh accounts through the app
> rather than relying on these.

---

## 0. Prerequisites
- The `supabase` CLI (`supabase login`, linked to the project `bmfxhbkeskihzmsdvwiw`), **or** the Supabase **SQL editor** in the dashboard.
- Push access to your Netlify site (`futweb.netlify.app`).
- Flutterwave dashboard + secret key (for webhook) and an email/SMS provider.

---

## 1. Deploy the frontend changes
1. Commit the repo changes (they are staged source-only; no `dist/`).
2. Deploy to Netlify (or push to the branch Netlify auto-deploys). The build is
   `npm run build` → publishes `dist/`, already in `netlify.toml`.

After deploy, re-test:
- Player: Dashboard, My CV ("Add club"), Performance ("Record a season"),
  Settings ("Export / Request deletion", "Recent messages").
- Club: **deep-link** `/club/staff`, `/club/verify`, `/billing` (no longer
  bounce to `/club`); post a trial → appears as **open + verified**.
- Admin: normal login lands on `/admin`; Admin → Subscriptions shows the real
  account (not "Unknown account"); club Squad/Dashboard show real scores.

---

## 2. Run the SQL (three scripts, in order)
Open the Supabase SQL editor (or `psql`) and run:

1. **`supabase/sql/reconcile_futweb_score.sql`** — score backfill (fills the NULL `players.futweb_score`).
2. **`supabase/sql/futweb_test_account_fixes.sql`** — one-time fixes to the test club/admin accounts.
3. **`supabase/sql/futweb_subscription_expiry.sql`** — automatic trial/grace expiry (NEW). Adds `expire_overdue_subscriptions()` (global sweep, for a scheduler) and `expire_my_subscription()` (called by the app on every sign-in / app load, so a lapsed trial is revoked on the next visit even without a scheduler). Optionally schedules an hourly `pg_cron` job if the extension is enabled.
4. **`supabase/migrations/0011_trial_review_pipeline.sql`** — trial publication pipeline (NEW). Closes the dead-end where a club's trial stayed `pending_verification` forever. Adds `trial_may_publish(uuid)`, `publish_eligible_pending_trials(uuid)`, `admin_verify_trial(uuid,text)`, `admin_reject_trial(uuid,text)`, re-defines `admin_verify_club` to auto-publish eligible pending postings, and a guard trigger so a club can never self-verify a posting unless it actually qualifies (entity-verified + Pro Club/Enterprise/trial). **Run it after script 3.**
5. **`supabase/migrations/0012_profile_views.sql`** — profile view tracking (NEW). Adds `profile_views` table + RLS, `record_profile_view(uuid)` (security-definer write; drops self-views, derives the viewer's club from auth, rate-limits to 1/player/24h, no direct insert policy) and `my_profile_views(int)` (returns only the caller's own views). Drives the player "Who viewed your profile" panel (Pro+).
6. **`supabase/migrations/0013_club_audit.sql`** — club audit log & export (NEW). Adds `log_club_activity(uuid,text,jsonb)` and `club_audit_log(uuid,int)` security-definer RPCs (club-scoped read only for the caller's own club), plus triggers that auto-record trial posts/status changes, staff add/role-change/remove, and scout reports into the club's audit slice. Drives Club → Audit log / Export CSV (Pro Club).
7. **`supabase/migrations/0014_messaging.sql`** — direct player↔club messaging (NEW). Adds `conversations` + `messages` tables and security-definer RPCs `open_conversation`, `send_message`, `mark_conversation_read`, `my_conversations`, `conversation_messages`. Messaging is gated to **Elite players** (or full trial/admin) and only entity-verified clubs participate; minors require guardian consent. No direct table policy — participants are always re-derived from `auth.uid()`. Drives `/messages` for both roles.
8. **`supabase/migrations/0015_federation.sql`** — Federation group structure + enterprise-access (NEW). Adds `clubs.parent_club_id`, recursive access helpers (`user_in_club_tree`), `link_academy`/`unlink_academy`/`federation_children`/`federation_academy_squad`, extends `can_view_player` so a parent can see child-academy players, and an `enterprise_requests` table + `submit_enterprise_request` for the human/contracted Federation offerings (SSO, data residency, SLA, NAM, NFF onboarding, API/webhooks).
9. **`supabase/migrations/0016_developer_api.sql`** — Federation developer access scaffolding (NEW): `api_keys` (SHA-256-hashed, scoped, revocable) + `create_api_key`/`resolve_api_key`/`revoke_api_key`; `webhook_endpoints` + `webhook_deliveries` + `register_webhook_endpoint`/`queue_webhook_event`; and `club_custom_roles` for named roles with capability sets. Client surface at **Club → Developer** (`/club/integrations`, Federation). Webhook delivery runs via `supabase/functions/api-webhook-deliver` (deploy + schedule it). **Enforcement note:** API keys/webhooks are real; custom roles are app-layer access control — the core RLS still keys off the built-in `user_role` enum, so don't treat arbitrary role names as a hard security boundary yet.
10. **`supabase/migrations/0017_access_withdrawal.sql`** — withdraw server-side access a subscription no longer covers (NEW). Re-verifies `club_is_federation` on `federation_children`/`federation_academy_squad` and on `can_view_player`'s cross-club path so a parent downgraded off Federation **loses child-academy/group oversight reads immediately** (DB-level, not just UI); preserves a club's direct access to its OWN players; and fixes `can_view_player` so the guardian-consent guard applies to every non-self/non-admin path (a club can't read a managed minor without consent). Full findings + remaining product-policy open items in **`docs/AUDIT_ACCESS_WITHDRAWAL.md`**.
11. **`supabase/migrations/0018_admin_monitor.sql`** — admin monitoring for Federation & developer access (NEW). Admin-only, `security definer` reporting functions gated on `is_admin()`, returning **sanitised** rows (API-key prefix only, never the secret/hash): `admin_federation_tree`, `admin_api_keys_view`, `admin_webhook_health`, `admin_platform_monitor`, and `admin_at_risk_clubs` (clubs whose subscription lapsed but that still hold open verified trials / academy links / active API keys / webhooks — the downgrade-withdrawal risk watch). Drives the new **Admin → Federation & API** page (`/admin/federation-api`), including an at-risk banner.
12. **`supabase/migrations/0019_guardian_copy.sql`** — guardian-copy pipeline for club→minor messaging (NEW). Adds a durable `guardian_copies` outbox and rewrites `send_message` so EVERY message involving a minor is captured as a copy addressed to the registered guardian (name/email from the player record) — consent-gating remains enforced and messaging a minor without guardian consent is still blocked. Adds `my_guardian_copies` (player/guardian view) and `admin_guardian_copies_health`. Delivery runs via **`supabase/functions/guardian-copy-deliver`** (deploy + schedule it; needs a verified sender email). Landing/Trust/ForPlayers/pricing copy now reflects what's enforced (consent-gated + guardian-notified) rather than implying an always-on email.
13. **`supabase/migrations/0020_report_to_disputes.sql`** — wire the "Report a suspicious approach" flow into the real queue (NEW). The `/report` page (previously cosmetic — it showed a fake confirmation and wrote nothing) is now gated to **authenticated players** and inserts a row into the `disputes` table (matching `kind`/`severity`, prose `summary`, plus a new `metadata` jsonb holding who/contact/amount). Reports therefore appear under **Admin → Disputes & reports** with the reporter attributed, and the review modal shows the structured report details. Reference shown to the reporter is derived from the real row id.
14. **`supabase/migrations/0021_admin_subscription_actions.sql`** — make the Admin → Subscriptions **Manage** button functional (NEW). Adds admin-gated security-definer RPCs (`admin_change_plan`, `admin_set_subscription_status`, `admin_extend_period`, `admin_cancel_at_period_end`) that update BOTH `subscriptions` and `profiles.sub_status`/`plan_code` in sync (profiles is the authoritative access state), so changing a status genuinely withdraws/restores paid access at the DB and is audit-logged. The Manage modal offers change-status / change-plan / extend-grace-or-trial / cancel-at-period-end. **Money actions (refund/void)** are scaffolded via **`supabase/functions/flutterwave-refund`** and only run once deployed with `FLW_SECRET_KEY`.

All are idempotent and safe to re-run.

> Until script 3 is applied, the app still works, but a lapsed trial is not
> auto-expired (the client hook simply no-ops if the function is absent). Until
> migration 0011 is applied, the admin Approve/Reject buttons and the club
> "Publish now (requirements met)" re-check call RPCs that do not yet exist
> (they surface a friendly error and no-op) — pending postings stay pending
> until the migration runs. Client calls to 0012/0013 RPCs also no-op with a
> friendly error until those migrations run, so a deploy before applying them
> will not break the app.

> Until script 3 is applied, the app still works, but a lapsed trial is not
> auto-expired (the client hook simply no-ops if the function is absent). Until
> migration 0011 is applied, the admin Approve/Reject buttons and the club
> "Publish now (requirements met)" re-check call RPCs that do not yet exist
> (they surface a friendly error and no-op) — pending postings stay pending
> until the migration runs.

---

## 2b. Per-plan feature gating (entitlements) — behaviour notes
Implemented in code (no SQL needed). See `src/lib/entitlements.ts`:
- **Trial = full access.** During the trial, players get Elite-level features and
  clubs get Pro Club/Enterprise-level features. Set `TRIAL_GRANTS_FULL` to
  `false` in `entitlements.ts` if you want a trial scoped to only the plan picked.
- **Active / grace = the plan's features.** e.g. a player on Pro sees the Pro
  feature set and Elite-only items (unlimited video, PDF dossier, direct
  messaging, verified badge, etc.) as **locked** with an upgrade prompt.
- The **Billing → Plans → "What your plan includes"** panel lists which features
  are unlocked vs locked for the current account.
- Enforced surfaces so far: **player highlight-video quota** (Scout 0, Pro 10,
  Elite unlimited) on Media; **club verified-trial postings** (Pro Club /
  Enterprise — an entity-verified club on the Academy plan can't self-publish a
  verified/open trial; it posts as pending). Extend by wrapping more actions in
  the `<FeatureGate feature="...">` component.

---

## 2c. Trial verification pipeline (NEW — fixes the "stuck pending trial")
**Before this fix:** a club whose posting did not auto-publish (not entity-verified,
or on the Academy plan) was created `pending_verification` and **nothing could ever
promote it** — a permanent invisible dead-end.

**After this fix** (needs migration 0011), a pending posting is published through:
1. **Auto** — the moment the club is entity-verified **and** on Pro Club/Enterprise
   (or trial), the pending posting flips to `open` + `verified`. `admin_verify_club`
   does this automatically; the club can also hit **"Publish now (requirements met)"**
   on `/club/trials` to self-heal after it upgrades or gets verified.
2. **Admin review** — Admin → Verification now lists **"Trial postings awaiting
   publication."** A moderator Approves (optional note) or Rejects (required reason)
   a posting; the club owner is notified either way. Approving is a manual override
   used when a moderator judges the posting legitimate even though an automated rule
   couldn't (e.g. an Academy club).

**Sanity check after deploy:** post a trial from an entity-**un**verified or Academy
club → it shows **"Pending verification"** with a checklist (verify org / plan) on
`/club/trials`; verify the club entity as admin → the trial flips to **open +
verified** and appears to players; a rejected posting is cancelled with a reason.

---

## 2d. Federation / group structure (NEW — migration 0015)
Gives the Federation (club_enterprise) tier a real multi-academy group:
- **Club → Academies** (`/club/academies`, requires Federation-level access): add/remove child
  academies by club id and view each academy's squad + headcounts for group oversight. Child
  academies keep independent ownership/staff/billing.
- **Federation overview**: a parent can see any child academy's players (read-only) via the
  extended `can_view_player`.
- **Enterprise access** (`/federation/apply`, authed): a request form for the human/contracted
  Federation items (SSO, data residency, API/webhooks, SLA, NAM, NFF onboarding). Rows land in
  `enterprise_requests`; **Admin → Enterprise** reviews them and updates status.

**Honest plan copy:** the Federation tier features now split into product (group management, which
works) vs clearly-labelled **"Add-on"** items that are arranged via the enterprise agreement — no
longer implying SSO/SLA/etc. are auto-included on signup.

> Custom roles/RBAC and a real API-key + webhook-delivery system are still scaffolding (auth-only
> placeholders) — they need a live Supabase Edge Function + auth strategy to be production. See the
> Federation roadmap note.

**Sanity check after deploy:** on a Federation/trial club → `/club/academies` add an academy club id
→ it lists with headcounts; expand its squad. Submit a request at `/federation/apply` → confirm it
shows under Admin → Enterprise.

---

## 3. One-time corrections to your test accounts
Run these in the SQL editor (or `psql`). **They mutate rows for the accounts you
gave me** — tune to your own users before a real launch.

```sql
begin;

-- 3a. Let the club owner land straight on /club (stop re-running onboarding).
update public.profiles
   set onboarding_complete = true
 where email = 'brusselsardar@gmail.com';

-- 3b. Admin: role is 'admin' already, which now routes to /admin. Mark it
--     onboarded so nothing else treats it as a pending player signup.
update public.profiles
   set onboarding_complete = true,
       account_type        = 'club'
 where email = 'nwankwohenry9@gmail.com';

-- 3c. Give the club a real subscription row so /billing and the "plan" banner
--     reconcile (its profile currently says trialing but no subscriptions row
--     exists, so the UI shows "plan: free").
insert into public.subscriptions (subscriber, plan_code, status, interval, current_period_start, current_period_end)
select p.id, 'club_pro', 'trialing', 'monthly', now(), now() + interval '11 days'
  from public.profiles p
 where p.email = 'brusselsardar@gmail.com'
   and not exists (
     select 1 from public.subscriptions s where s.subscriber = p.id
   )
 returning subscriber, plan_code, status;

commit;
```

Optional clean-up of the messy test rows you made earlier (Dutch-address club
details, the "SCFC/hyg" pending trial, placeholder staff invites `joemildred25`):
edit them in the dashboard or via SQL — not required for functionality.

---

## 4. Email / SMS (needed for real staff invites, resets, guardian copies)
The app calls `admin_send_notification` (in-app) but **no transactional
email/SMS is connected**, so "you'll get an email" messages are not yet real.
Options:
- Enable **Supabase Auth > Providers > Email (SMTP)** with your domain so
  password resets & confirmations send.
- Add a **Supabase Edge Function** (or webhook/Resend/Postmark) that the
  `notifications` / `org_members` flow calls on insert to send real mail. Today
  that relay is not implemented, so staff invites that create an account will
  only work for users who already exist.

**Guardian-copy delivery (migration 0019):** every club message to a minor is
captured in `guardian_copies` regardless of relay availability. To actually send
those to guardians, deploy + schedule the worker and set a verified sender:
- `supabase secrets set GUARDIAN_EMAIL_FROM="FutWeb <you@yourdomain>" GUARDIAN_EMAIL_KEY=<resend-api-key>`
- `supabase functions deploy guardian-copy-deliver --no-verify-jwt --schedule every-minute`
Until then, copies stay `pending`/`failed` in the outbox (admin health function),
so the product never silently loses a copy.

## 5. Payments (Flutterwave webhook)
The frontend has a public key path but billing is driven server-side by the
edge functions. Ensure:
1. `supabase secrets set FLW_SECRET_KEY FLW_SECRET_HASH APP_URL ALLOWED_ORIGIN`
2. Deploy: `supabase functions deploy create-checkout flutterwave-webhook --no-verify-jwt` (webhook only)
3. In the Flutterwave dashboard set Webhook URL to
   `https://<ref>.supabase.co/functions/v1/flutterwave-webhook`, Secret Hash =
   `FLW_SECRET_HASH`, events = `charge.completed`.

**Admin refunds (money action):** the Manage modal now has a **Refund** action
that looks up the account's successful payments (from `payments`, matching the
subscription's `subscriber`) and shows each refundable charge (with its
Flutterwave `flw_id`, amount + date). Selecting one and Apply calls
**`supabase/functions/flutterwave-refund`** (JWT ON, re-checks admin; proxies to
Flutterwave `/v3/transactions/:id/refund`). On success it also marks the local
`payments` row `status = 'refunded'` (so it can't be double-refunded) and audit-
logs. To make refunds live:
1. `supabase secrets set FLW_SECRET_KEY ...`
2. `supabase functions deploy flutterwave-refund` (it is now self-contained, no
   `_shared` import)
The DB-level actions (status / plan / grace-trial / cancel-at-period-end) work
immediately after migration 0021 regardless.

The "Manage" button on Admin → Subscriptions is intentionally a stub — wire it
to `flutterwave` endpoints (refund/pause/change) when you have a live account.

---

## 5b. Hotfix (Sep 2026): club `/billing` (and other club pages) reload loop

**Symptom:** on a club account the `/billing` page (and any club route under a
`RequireStaffAccess` guard) unmounts/remounts ~15×/sec indefinitely, firing an
ever-growing stream of `profiles` / `payments` / `subscriptions` requests.

**Root cause:** `Billing`'s mount effect calls `refreshProfile()`, which makes
`AuthContext` return a **new** `user` object (same `id`). `ClubContext.refresh`
had `[user]` as a dependency, so the identity change re-ran the club fetch,
which toggled `ready` false→true. `RequireStaffAccess` renders `<Skeleton>` while
`!ready`, so the gated child (Billing) unmounted and remounted — restarting its
mount effect → infinite loop. Players never hit it because their path returns
early from `RequireStaffAccess` with no `ready` churn.

**Fix (`src/context/ClubContext.tsx`):** `refresh` now depends on `user.id` +
`accountType` (not the whole `user` object), and only drops to the loading
skeleton on the **first** resolution of a given user id
(`resolvedForRef` ref). Refresh for the same user is now a silent background
update that never flips `ready` to false, so guarded routes stay mounted.

**Verification:** with a club logged in, `/billing` shows flat request counts
(`profiles`/`payments`/`subscriptions` stay at a small constant value with no
growth) and page errors = 0. `/club`, `/club/staff`, `/club/verify`, `/billing`,
`/club/squad` all render and deep-link correctly with no remount.

---

## 6. Final sanity checklist (multi-role)
- [ ] Club posts a trial → status **open + verified**; a player sees it and can **Apply**; the club sees the application.
- [ ] Player adds a season (Performance) and a club (My CV) → both persist and survive refresh.
- [ ] Settings "Request deletion"/"Export" creates a `data_subject_requests` row (visible in DB/admin).
- [ ] Score backfill ran → player dashboard, admin Players, and club Squad all agree.
- [ ] Deep-link to club Staff/Verify/Billing works on a fresh tab (logged in).
- [ ] Admin normal login → `/admin`; Subscriptions shows the club name.
- [ ] Plan gating: a player on Pro sees Elite-only features locked on Billing → "What your plan includes" and a 10-video cap on Media; a club on Pro Club/Enterprise (or trial) publishes verified/open trials, an Academy club's posts stay pending.
- [ ] Trial expiry: set a test account's `trial_ends_at` to the past → on next login the app shows the Paywall (status flipped to expired by `expire_my_subscription`).

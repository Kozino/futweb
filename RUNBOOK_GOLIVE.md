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

All are idempotent and safe to re-run.

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

## 5. Payments (Flutterwave webhook)
The frontend has a public key path but billing is driven server-side by the
edge functions. Ensure:
1. `supabase secrets set FLW_SECRET_KEY FLW_SECRET_HASH APP_URL ALLOWED_ORIGIN`
2. Deploy: `supabase functions deploy create-checkout flutterwave-webhook --no-verify-jwt` (webhook only)
3. In the Flutterwave dashboard set Webhook URL to
   `https://<ref>.supabase.co/functions/v1/flutterwave-webhook`, Secret Hash =
   `FLW_SECRET_HASH`, events = `charge.completed`.

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

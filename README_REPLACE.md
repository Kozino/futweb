# FutWeb — updates package

## A) Source files to REPLACE (drop into the repo, same paths)
Copy each file over the matching file in your project:

    src/App.tsx
    src/context/AuthContext.tsx                       [new change: trial expiry hook]
    src/context/ClubContext.tsx
    src/lib/supabase/attributes.ts
    src/lib/supabase/recruitment.ts                   [new change: plan-tiered trial posting]
    src/lib/supabase/workspace.ts
    src/pages/Settings.tsx
    src/pages/admin/Subscriptions.tsx
    src/pages/billing/Billing.tsx                     [new change: "What your plan includes"]
    src/pages/club/Trials.tsx
    src/pages/player/Media.tsx                        [new change: video quota gate]
    src/pages/player/Profile.tsx
    src/pages/player/Stats.tsx

## B) NEW source files to ADD (same paths)
    src/lib/entitlements.ts                           [per-plan feature engine]
    src/components/plan/FeatureGate.tsx               [reusable lock + upgrade UI]

Then rebuild + redeploy:
    npm install
    npm run build      # -> dist/  (deploy this to Netlify)

## C) SQL to run in Supabase (Dashboard > SQL editor, in this order)
1. supabase/sql/reconcile_futweb_score.sql
   Fills the empty players.futweb_score column from rating snapshots.
   Idempotent. Optionally uncomment the trigger at the bottom.
2. supabase/sql/futweb_test_account_fixes.sql
   One-time fixes for the test club/admin accounts (edit emails inside).
3. supabase/sql/futweb_subscription_expiry.sql         [NEW — trial/grace expiry]
   Adds expire_overdue_subscriptions() (for a scheduler) and expire_my_subscription()
   (called by the app on every sign-in / app load). Optionally schedules an
   hourly pg_cron job if the extension is enabled. Idempotent.

## D) Go-live steps needing credentials
See RUNBOOK_GOLIVE.md — email/SMS + Flutterwave webhook + final sanity checklist.

## What these changes do
Earlier rounds:
- Club Squad/Dashboard show the real FutWeb score (was a bogus low number).
- Admin -> Subscriptions no longer 400s / shows "Unknown account".
- Deep-link/refresh to club Staff, Verify and Billing no longer bounces to /club.
- Admin normal login goes to /admin; club onboarding persists.
- Players can record season match stats + add career entries.
- Entity-verified clubs' trials publish; Settings data-subject requests + inbox.

New in this round — per-plan gating + trial expiry:
- Per-plan entitlements engine (src/lib/entitlements.ts).
  Trial = FULL access. Active/grace = that plan's features only.
- Visible locks: Media enforces the player highlight-video quota (Scout 0,
  Pro 10, Elite unlimited); club "verified trial postings" is Pro Club/Enterprise
  (Academy posts stay pending). The Billing -> Plans -> "What your plan includes"
  panel shows unlocked vs locked features for the current account.
- Automatic trial/grace expiry: the SQL creates the functions; the app calls
  expire_my_subscription() on every sign-in/app load so a lapsed trial is
  revoked on the next visit (Paywall shows). Run the SQL or it no-ops safely.

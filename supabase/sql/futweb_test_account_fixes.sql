-- ============================================================================
-- FutWeb — One-time data fixes for the TEST accounts
-- (ruthdorine7 / brusselsardar / nwankwohenry9)
-- ============================================================================
-- Run in: Supabase Dashboard > SQL editor  (or psql)
-- Safe to run as-is against the current project. Tune the emails if you have
-- already created fresh accounts.
--
-- What this does:
--   1. Marks the club owner onboarded  -> lands on /club, not /onboarding/club
--   2. Fixes the admin account         -> routes to /admin (already role=admin);
--                                         marks onboarded + account_type club
--   3. Gives the club a subscriptions row so /billing and the "plan" banner
--      reconcile (currently trialing but no subscription row exists).
-- The FutWeb Score backfill is SEPARATE: supabase/sql/reconcile_futweb_score.sql
-- ============================================================================

begin;

-- 1) Club owner: stop re-running onboarding on every sign-in.
update public.profiles
   set onboarding_complete = true
 where email = 'brusselsardar@gmail.com';

-- 2) Admin account: it already has role = 'admin' (which now routes to /admin),
--    but it is flagged account_type='player' and not onboarded. Normalise it.
update public.profiles
   set onboarding_complete = true,
       account_type        = 'club'
 where email = 'nwankwohenry9@gmail.com';

-- 3) Give the club a subscription row (status trialing) so its plan/billing UI
--    reflects the trial instead of showing "plan: free".
insert into public.subscriptions
    (subscriber, plan_code, status, interval, current_period_start, current_period_end)
select p.id, 'club_pro', 'trialing', 'monthly', now(), now() + interval '11 days'
  from public.profiles p
 where p.email = 'brusselsardar@gmail.com'
   and not exists (
     select 1 from public.subscriptions s where s.subscriber = p.id
   )
 returning subscriber, plan_code, status;

commit;

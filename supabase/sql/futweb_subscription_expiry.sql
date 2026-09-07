-- ============================================================================
-- FutWeb — Automatic trial / grace-period expiry
-- ============================================================================
-- Run in: Supabase Dashboard > SQL editor  (or psql)
-- Idempotent — safe to run repeatedly.
--
-- Why:
--   An account starts as sub_status='trialing' with a 14-day trial_ends_at.
--   Previously nothing ever flipped 'trialing' -> 'expired' when the trial
--   passed, so a lapsed trial kept full access forever. This adds two
--   SECURITY DEFINER functions plus (optionally) a scheduled job so access is
--   actually revoked once the trial/grace window passes.
--
-- What it does:
--   1. expire_overdue_subscriptions()  — global sweep (for the scheduler).
--   2. expire_my_subscription()        — expires ONLY the calling user (the
--      client calls this on each app load, so expiry also happens on the next
--      visit even if the scheduler isn't running). Grant: authenticated.
--   3. Optionally schedules the global sweep hourly with pg_cron (guarded — it
--      only runs if the extension is present).
-- ============================================================================

begin;

-- 1) Global sweep (used by the scheduler and manual runs).
create or replace function public.expire_overdue_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  -- Lapsed trials and grace periods -> expired.
  update public.profiles
     set sub_status = 'expired', updated_at = now()
   where sub_status in ('trialing','grace')
     and (
       (sub_status = 'trialing'
          and trial_ends_at is not null and trial_ends_at < now())
       or
       (sub_status = 'grace'
          and grace_ends_at is not null and grace_ends_at < now())
     );
  get diagnostics n = row_count;

  -- Keep the subscriptions table in lock-step with the profile.
  update public.subscriptions s
     set status = 'expired', updated_at = now()
    from public.profiles p
   where s.subscriber = p.id
     and s.status in ('active','trialing','grace')
     and p.sub_status = 'expired';

  return n;
end;
$$;

-- 2) Self-scoped expiry — called by the client on session restore.
create or replace function public.expire_my_subscription()
returns public.sub_status
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.sub_status;
begin
  select sub_status into me from public.profiles where id = auth.uid();
  if me is null or me not in ('trialing','grace') then
    return me;
  end if;

  if (
    (me = 'trialing'
       and exists (select 1 from public.profiles
                    where id = auth.uid()
                      and trial_ends_at is not null and trial_ends_at < now()))
    or
    (me = 'grace'
       and exists (select 1 from public.profiles
                    where id = auth.uid()
                      and grace_ends_at is not null and grace_ends_at < now()))
  ) then
    update public.profiles set sub_status = 'expired', updated_at = now()
     where id = auth.uid();
    update public.subscriptions set status = 'expired', updated_at = now()
     where subscriber = auth.uid() and status in ('active','trialing','grace');
    return 'expired';
  end if;

  return me;
end;
$$;

-- Lock the global sweep down (only scheduler/service-role may call it).
revoke all on function public.expire_overdue_subscriptions() from public, anon;
grant execute on function public.expire_overdue_subscriptions() to service_role;

-- The client-facing self-expiry is callable by any authenticated user.
revoke all on function public.expire_my_subscription() from public, anon;
grant execute on function public.expire_my_subscription() to authenticated;

-- 3) Optional: run the global sweep hourly. Only schedules if the pg_cron
--    extension is enabled (Dashboard > Database > Extensions > cron). If you
--    can't enable pg_cron, skip this block — the client hook already expires
--    a user's account on their next app load.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'futweb-subscription-expiry',
      '0 * * * *',
      'select public.expire_overdue_subscriptions();'
    );
  end if;
end;
$$;

commit;

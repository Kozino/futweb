-- ============================================================================
-- FutWeb — Admin subscription management (Admin → Subscriptions "Manage")
-- ----------------------------------------------------------------------------
-- Makes the Admin "Manage" button real. The previous button only showed a
-- toast ("wire to your Flutterwave endpoints"). This migration provides
-- admin-gated, security-definer RPCs that an admin can actually invoke.
--
-- IMPORTANT model note: the AUTHORITATIVE access state is
-- `profiles.sub_status` + `profiles.plan_code` (this is what `has_active_sub`,
-- `trial_may_publish`, `club_is_federation`, messaging RLS etc. read).
-- `subscriptions` is the billing mirror. So every action here updates BOTH in
-- sync so that changing a status really withdraws/grants access at the DB and
-- not just in a billing row.
--
-- All functions require is_admin(), write to both tables, and audit-log.
-- Money actions (refund/void) need live Flutterwave credentials + the deployed
-- edge function `flutterwave-refund`; they are scaffolded separately (see
-- RUNBOOK). This file covers the DB-level actions that work immediately.
-- Idempotent: create or replace.
-- ============================================================================

-- Change an account's plan. Keeps current status/period, updates both tables.
create or replace function public.admin_change_plan(p_subscriber uuid, p_plan_code text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_plan public.plans;
  v_prev_plan text;
  v_prev_status text;
begin
  if not public.is_admin() then
    raise exception 'only administrators may manage subscriptions' using errcode = '42501';
  end if;
  if p_subscriber is null then raise exception 'subscriber required' using errcode='22023'; end if;

  select * into v_plan from public.plans where code = p_plan_code and active;
  if not found then raise exception 'unknown or inactive plan %s', p_plan_code using errcode = '22023'; end if;

  select plan_code, sub_status into v_prev_plan, v_prev_status
    from public.profiles where id = p_subscriber;

  -- Keep the same billing status; only change the tier.
  update public.subscriptions
     set plan_code = v_plan.code,
         interval  = v_plan.interval,
         updated_at = now()
   where subscriber = p_subscriber;

  update public.profiles
     set plan_code = v_plan.code, updated_at = now()
   where id = p_subscriber;

  perform public.refresh_trust_and_tier(p_subscriber);
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'subscription.plan_changed', 'profile', p_subscriber,
          jsonb_build_object('from', v_prev_plan, 'to', v_plan.code,
                             'status', v_prev_status));
end;
$$;

-- Force a subscription status (cancel/pause/expire/reactivate/grace/trialing).
-- This is what actually withdraws (or restores) server-side access.
create or replace function public.admin_set_subscription_status(
  p_subscriber uuid, p_status text, p_reason text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_prev text; v_prev_plan text; v_allowed text[];
begin
  if not public.is_admin() then
    raise exception 'only administrators may manage subscriptions' using errcode = '42501';
  end if;

  v_allowed := array['trialing','active','past_due','grace','cancelled','expired','paused'];
  if not (p_status = any(v_allowed)) then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  select sub_status, plan_code into v_prev, v_prev_plan
    from public.profiles where id = p_subscriber;
  if v_prev is null then raise exception 'profile not found' using errcode = 'P0002'; end if;

  update public.subscriptions
     set status = p_status::public.sub_status, updated_at = now(),
         cancel_at_period_end = (p_status = 'cancelled')
   where subscriber = p_subscriber;

  update public.profiles
     set sub_status = p_status::public.sub_status,
         grace_ends_at = case when p_status = 'grace'
                              then coalesce(grace_ends_at, now() + interval '7 days')
                              when p_status in ('active','trialing') then null
                              else grace_ends_at end,
         updated_at = now()
   where id = p_subscriber;

  perform public.refresh_trust_and_tier(p_subscriber);
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'subscription.status_changed', 'profile', p_subscriber,
          jsonb_build_object('from', v_prev, 'to', p_status, 'plan', v_prev_plan,
                             'reason', p_reason));
end;
$$;

-- Extend grace or trial by N days (keeps the current period end).
create or replace function public.admin_extend_period(
  p_subscriber uuid, p_kind text, p_days int, p_reason text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'only administrators may manage subscriptions' using errcode = '42501';
  end if;
  if p_kind not in ('grace','trial') then
    raise exception 'kind must be grace or trial' using errcode = '22023';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'days must be between 1 and 365' using errcode = '22023';
  end if;

  if p_kind = 'grace' then
    update public.profiles
       set sub_status = 'grace',
           grace_ends_at = greatest(coalesce(grace_ends_at, now()),
                                    now()) + (p_days || ' days')::interval,
           updated_at = now()
     where id = p_subscriber;
    update public.subscriptions set status = 'grace', updated_at = now()
     where subscriber = p_subscriber;
  else
    update public.profiles
       set sub_status = 'trialing',
           trial_ends_at = greatest(coalesce(trial_ends_at, now()),
                                    now()) + (p_days || ' days')::interval,
           updated_at = now()
     where id = p_subscriber;
    update public.subscriptions set status = 'trialing', updated_at = now()
     where subscriber = p_subscriber;
  end if;

  perform public.refresh_trust_and_tier(p_subscriber);
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin',
          case when p_kind = 'grace' then 'subscription.grace_extended'
               else 'subscription.trial_extended' end,
          'profile', p_subscriber,
          jsonb_build_object('days', p_days, 'reason', p_reason));
end;
$$;

-- Cancel at period end (retain access until the current period ends).
create or replace function public.admin_cancel_at_period_end(p_subscriber uuid, p_cancel boolean)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'only administrators may manage subscriptions' using errcode = '42501';
  end if;
  update public.subscriptions
     set cancel_at_period_end = p_cancel, updated_at = now()
   where subscriber = p_subscriber;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'subscription.cancel_scheduled', 'profile', p_subscriber,
          jsonb_build_object('cancel_at_period_end', p_cancel));
end;
$$;

grant execute on function public.admin_change_plan(uuid, text) to authenticated;
grant execute on function public.admin_set_subscription_status(uuid, text, text) to authenticated;
grant execute on function public.admin_extend_period(uuid, text, int, text) to authenticated;
grant execute on function public.admin_cancel_at_period_end(uuid, boolean) to authenticated;

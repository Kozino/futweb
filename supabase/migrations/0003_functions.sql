-- ============================================================================
-- FutWeb — Triggers, invariants and privileged procedures
-- ============================================================================

-- ------------------------------------------------------------ updated_at ---
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare r record;
begin
  for r in select unnest(array['profiles','clubs','players','player_attributes','subscriptions','shortlists']) as t
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', r.t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', r.t);
  end loop;
end $$;

-- ------------------------------------------------------------- audit log ---
-- Append-only. Not even a superuser should be able to quietly rewrite history:
-- UPDATE and DELETE raise, and the exception handler logs the attempt itself.
create or replace function public.log_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare new_id bigint;
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    (select role::text from public.profiles where id = auth.uid()),
    p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.audit_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only: %s is not permitted', tg_op
    using errcode = '42501';
end $$;

drop trigger if exists trg_audit_no_update on public.audit_log;
create trigger trg_audit_no_update before update or delete on public.audit_log
  for each row execute function public.audit_append_only();

-- Payments: allow only forward status transitions, never amount changes.
create or replace function public.payments_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.amount <> old.amount or new.currency <> old.currency or new.tx_ref <> old.tx_ref then
      raise exception 'payments are immutable except for status transitions' using errcode = '42501';
    end if;
    if (old.status, new.status) not in (
      ('pending','successful'), ('pending','failed'), ('pending','cancelled'),
      ('successful','refunded')
    ) then
      raise exception 'illegal payment status transition %s -> %s', old.status, new.status
        using errcode = '42501';
    end if;
    if new.status in ('successful','failed','cancelled','refunded') then
      new.settled_at = now();
    end if;
  elsif tg_op = 'DELETE' then
    raise exception 'payments cannot be deleted' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_payments_guard on public.payments;
create trigger trg_payments_guard before update or delete on public.payments
  for each row execute function public.payments_guard();

-- Rating snapshots: historical facts.
create or replace function public.snapshots_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'rating snapshots are immutable (%s)', tg_op using errcode = '42501';
end $$;
drop trigger if exists trg_snapshots_immutable on public.rating_snapshots;
create trigger trg_snapshots_immutable before update or delete on public.rating_snapshots
  for each row execute function public.snapshots_immutable();

-- -------------------------------------------------------- new user setup ---
-- Creates the profile (and, for clubs, the club row) atomically on signup.
-- security definer because the client cannot insert into profiles directly.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_account_type account_type := coalesce(
    (new.raw_user_meta_data->>'account_type')::account_type, 'player');
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_club_name text := new.raw_user_meta_data->>'club_name';
  v_club_id   uuid;
begin
  insert into public.profiles (id, email, full_name, account_type, role, phone,
                               email_verified, verification_status, sub_status, trial_ends_at)
  values (
    new.id, new.email, v_full_name, v_account_type,
    case when v_account_type = 'club' then 'club_admin'::user_role else 'player'::user_role end,
    new.raw_user_meta_data->>'phone',
    coalesce(new.email_confirmed_at is not null, false),
    'none',
    'trialing',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;

  if v_account_type = 'club' then
    insert into public.clubs (owner_id, slug, name, short_name)
    values (
      new.id,
      regexp_replace(lower(coalesce(v_club_name, v_full_name)), '[^a-z0-9]+', '-', 'g'),
      coalesce(v_club_name, v_full_name || '''s Club'),
      upper(left(regexp_replace(coalesce(v_club_name, v_full_name), '[^a-zA-Z0-9]', '', 'g'), 3))
    )
    returning id into v_club_id;

    insert into public.org_members (club_id, user_id, role, accepted_at)
    values (v_club_id, new.id, 'club_admin', now());

    update public.profiles set sub_status = 'trialing' where id = new.id;
  end if;

  insert into public.consents (subject_id, kind, version, granted)
  values (new.id, 'terms_of_service', '2025-09-01', true);

  perform public.log_audit('user.created', 'profile', new.id,
                           jsonb_build_object('account_type', v_account_type));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------ trust score calc ---
-- Single source of truth, mirrored from src/lib/ratings.ts. Keeping the weights
-- in the database means a compromised client cannot inflate its own score.
create or replace function public.compute_trust_score(p_id uuid)
returns smallint language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  p  public.profiles;
  c  public.clubs;
  v  smallint := 0;
begin
  select * into p from public.profiles where id = p_id;
  if not found then return 0; end if;

  if p.email_verified then v := v + 10; end if;
  if p.phone_verified then v := v + 10; end if;
  if p.identity_verified_at is not null then v := v + 20; end if;
  if p.liveness_verified_at is not null then v := v + 10; end if;

  select * into c from public.clubs where owner_id = p_id limit 1;
  if found and c.entity_verified then v := v + 25; end if;

  if exists (select 1 from public.verification_requests r
             where r.subject_id = p_id and r.kind = 'references' and r.status = 'verified')
  then v := v + 10; end if;

  if p.sub_status = 'active' then v := v + 10; end if;
  if p.disputes_upheld = 0 then v := v + 5; end if;

  v := v + least(10, floor(extract(day from (now() - p.created_at)) / 30)::int);
  v := v - (p.disputes_upheld * 15);

  return greatest(0, least(100, v))::smallint;
end $$;

create or replace function public.refresh_trust_and_tier(p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_score smallint; v_tier verification_tier;
begin
  v_score := public.compute_trust_score(p_id);

  select case
    when v_score >= 85
         and exists (select 1 from public.clubs c
                     where c.owner_id = p_id and c.entity_verified)
         and exists (select 1 from public.profiles q
                     where q.id = p_id and q.liveness_verified_at is not null)
      then 'gold'::verification_tier
    when v_score >= 65
         and exists (select 1 from public.clubs c where c.owner_id = p_id and c.entity_verified)
      then 'entity'::verification_tier
    when v_score >= 35
         and exists (select 1 from public.profiles q where q.id = p_id and q.identity_verified_at is not null)
      then 'identity'::verification_tier
    else 'unverified'::verification_tier
  end into v_tier;

  update public.profiles
     set trust_score = v_score, verification_tier = v_tier, updated_at = now()
   where id = p_id;

  perform public.log_audit('trust.recalculated', 'profile', p_id,
                           jsonb_build_object('score', v_score, 'tier', v_tier));
end $$;

-- Recalculate whenever a verification request is decided.
create or replace function public.on_verification_decided()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('verified','rejected') and old.status is distinct from new.status then
    if tg_op = 'UPDATE' and not public.is_admin() then
      raise exception 'only administrators may decide verification requests' using errcode = '42501';
    end if;

    update public.profiles p
       set identity_verified_at = case when new.kind = 'identity' and new.status = 'verified'
                                       then now() else p.identity_verified_at end,
           liveness_verified_at = case when new.kind = 'liveness' and new.status = 'verified'
                                       then now() else p.liveness_verified_at end,
           verification_status  = case when new.status = 'verified' then 'verified'::verification_status
                                       else p.verification_status end
     where p.id = new.subject_id;

    if new.kind = 'entity' and new.status = 'verified' and new.club_id is not null then
      update public.clubs c
         set entity_verified = true, entity_verified_at = now()
       where c.id = new.club_id;
    end if;

    perform public.refresh_trust_and_tier(new.subject_id);
    perform public.log_audit('verification.decided', 'verification_request', new.id,
                             jsonb_build_object('kind', new.kind, 'status', new.status));
  end if;
  return new;
end $$;

drop trigger if exists trg_verification_decided on public.verification_requests;
create trigger trg_verification_decided
  after update on public.verification_requests
  for each row execute function public.on_verification_decided();

-- ------------------------------------------------ subscription activation --
-- Called ONLY by the Flutterwave webhook (service role). Idempotent on tx_ref.
create or replace function public.activate_subscription(
  p_tx_ref   text,
  p_flw_id   text,
  p_amount   integer,
  p_currency text,
  p_channel  text,
  p_raw      jsonb
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_plan    public.plans;
  v_sub     uuid;
begin
  -- Idempotency: if we have already settled this tx_ref, return the same row.
  select * into v_payment from public.payments where tx_ref = p_tx_ref;
  if not found then
    -- No pending row means this tx_ref was never created by create-checkout.
    -- Never invent a subscription from an unrecognised reference.
    raise exception 'no pending payment for tx_ref %s', p_tx_ref using errcode = '22023';
  end if;
  if v_payment.status in ('successful','refunded') then
    return v_payment.id;
  end if;

  select * into v_plan from public.plans where code = v_payment.plan_code;
  if not found then
    raise exception 'unknown plan on payment %s', p_tx_ref using errcode = '22023';
  end if;

  -- Amount check: reject if the customer was charged less than the plan price.
  -- Prevents a tampered client from buying Pro at the Scout price.
  if p_amount < (case when p_currency = 'NGN' then v_plan.price_ngn else v_plan.price_usd end) then
    raise exception 'amount %s does not cover plan %s', p_amount, v_plan.code using errcode = '22023';
  end if;

  update public.payments
     set status = 'successful', flw_id = coalesce(p_flw_id, flw_id),
         channel = p_channel, raw = coalesce(p_raw, raw), settled_at = now()
   where tx_ref = p_tx_ref
  returning id into v_sub;

  insert into public.subscriptions (subscriber, plan_code, status, interval,
                                    current_period_start, current_period_end)
  values (
    v_payment.subscriber, v_plan.code, 'active', v_plan.interval,
    now(),
    now() + (case when v_plan.interval = 'annual' then interval '365 days' else interval '30 days' end)
  )
  on conflict (subscriber) do update
    set plan_code = excluded.plan_code,
        status = 'active',
        current_period_start = excluded.current_period_start,
        current_period_end   = excluded.current_period_end,
        cancel_at_period_end = false,
        updated_at = now()
  returning id into v_sub;

  update public.profiles
     set sub_status = 'active', plan_code = v_plan.code,
         grace_ends_at = null, updated_at = now()
   where id = v_payment.subscriber;

  perform public.refresh_trust_and_tier(v_payment.subscriber);
  perform public.log_audit('subscription.activated', 'subscription', v_sub,
                           jsonb_build_object('tx_ref', p_tx_ref, 'plan', v_plan.code));

  return v_sub;
end $$;

-- Revoke direct execution: only the service role may settle payments.
revoke all on function public.activate_subscription(text,text,integer,text,text,jsonb) from public, anon, authenticated;

-- ----------------------------------------------------- guardian gate -------
-- A minor's profile must never become visible without guardian consent.
create or replace function public.players_guard_minor()
returns trigger language plpgsql as $$
begin
  if new.dob > (now() - interval '18 years')::date then
    if new.guardian_name is null or new.guardian_consent_at is null then
      raise exception 'under-18 profiles require guardian name and consent (FIFA Art.19 / NDPA 2023)'
        using errcode = '23514';
    end if;
    -- Force the safest visibility until a guardian actively opts in.
    if new.visibility = 'public' then
      new.visibility := 'verified_only';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_players_minor on public.players;
create trigger trg_players_minor before insert or update on public.players
  for each row execute function public.players_guard_minor();

-- ------------------------------------------------------------ audit hooks --
-- Automatically log the security-relevant state changes.
create or replace function public.audit_profile_changes()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    perform public.log_audit('profile.role_changed', 'profile', new.id,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.sub_status is distinct from old.sub_status then
    perform public.log_audit('subscription.status_changed', 'profile', new.id,
      jsonb_build_object('from', old.sub_status, 'to', new.sub_status));
  end if;
  if new.verification_tier is distinct from old.verification_tier then
    perform public.log_audit('verification.tier_changed', 'profile', new.id,
      jsonb_build_object('from', old.verification_tier, 'to', new.verification_tier));
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_profile on public.profiles;
create trigger trg_audit_profile after update on public.profiles
  for each row execute function public.audit_profile_changes();

create or replace function public.audit_trial_changes()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('trial.created', 'trial_posting', new.id,
      jsonb_build_object('club_id', new.club_id, 'fee', new.fee_charged_to_player));
  elsif new.status is distinct from old.status then
    perform public.log_audit('trial.status_changed', 'trial_posting', new.id,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_trials on public.trial_postings;
create trigger trg_audit_trials after insert or update on public.trial_postings
  for each row execute function public.audit_trial_changes();

-- Reports written by a club about a minor are copied to the guardian by the
-- notification worker; here we simply ensure the fact is recorded.
create or replace function public.audit_minor_contact()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.players p where p.id = new.player_id and p.is_minor) then
    perform public.log_audit('minor.contact_recorded', 'scout_report', new.id,
      jsonb_build_object('player_id', new.player_id, 'author', new.author_id));
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_minor_contact on public.scout_reports;
create trigger trg_audit_minor_contact after insert on public.scout_reports
  for each row execute function public.audit_minor_contact();

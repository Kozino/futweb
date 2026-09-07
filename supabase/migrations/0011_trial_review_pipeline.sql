-- ============================================================================
-- FutWeb — Trial publication / review pipeline
-- ----------------------------------------------------------------------------
-- Fixes the dead-end where a club's trial posting is created as
-- 'pending_verification' and NOTHING can ever promote it — so it stays
-- invisible to players forever.
--
-- A posting becomes live (status='open' AND verified=true — the only state a
-- player can see/apply to) through one of these trustworthy paths:
--   1. AUTO  — the club is entity-verified AND its plan/state grants
--              'verified_trial_postings' (Pro Club/Enterprise, or trial). This
--              mirrors what createTrialPosting already does at insert time, and
--              now ALSO runs when a club later becomes entity-verified or
--              upgrades, so previously-pending postings self-heal.
--   2. ADMIN — a moderator reviews the posting and explicitly Approves (or
--              Rejects) it, for the cases an automated rule cannot decide
--              (e.g. an Academy club a moderator judges legitimate).
--
-- Also adds a guard trigger so a club can NEVER self-mark a posting verified /
-- self-open it unless it actually qualifies (entity-verified + eligible plan).
-- ============================================================================

-- Does the club currently qualify to publish a verified trial on its own?
create or replace function public.trial_may_publish(p_club_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.clubs c
      join public.profiles o on o.id = c.owner_id
     where c.id = p_club_id
       and c.entity_verified
       and (
         o.sub_status = 'trialing'
         or (o.sub_status in ('active','grace')
             and o.plan_code in ('club_pro','club_enterprise'))
       )
  )
$$;

-- Publish every currently-pending posting of a club that now qualifies.
-- Safe to call by the club itself (self-heal after entity verification/upgrade)
-- or by an admin. The guard trigger below still blocks non-qualifying clubs.
create or replace function public.publish_eligible_pending_trials(p_club_id uuid)
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_owner    uuid;
  v_updated  integer;
begin
  select owner_id into v_owner from public.clubs where id = p_club_id;
  if v_owner is null then
    raise exception 'club not found' using errcode = 'P0002';
  end if;

  if not public.is_admin()
     and not exists (
       select 1 from public.org_members m
        where m.club_id = p_club_id and m.user_id = auth.uid()
          and (m.role = 'club_admin' or m.role = 'club_staff')
          and m.revoked_at is null
     )
     and auth.uid() <> v_owner
  then
    raise exception 'you do not manage this club' using errcode = '42501';
  end if;

  update public.trial_postings
     set verified   = true,
         status     = 'open',
         verified_by = coalesce((select owner_id from public.clubs where id = p_club_id),
                                auth.uid())
   where club_id = p_club_id
     and status = 'pending_verification'
     and verified = false
     and public.trial_may_publish(p_club_id);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- A moderator approves a specific pending posting (manual override).
create or replace function public.admin_verify_trial(
  p_trial_id uuid,
  p_note     text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_club uuid; v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'only administrators may verify trial postings' using errcode = '42501';
  end if;

  select club_id into v_club from public.trial_postings where id = p_trial_id;
  if v_club is null then
    raise exception 'trial posting not found' using errcode = 'P0002';
  end if;

  update public.trial_postings
     set verified = true,
         status   = 'open',
         verified_by = auth.uid()
   where id = p_trial_id;

  select owner_id into v_owner from public.clubs where id = v_club;
  if v_owner is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_owner, 'trial_verified', 'Trial published',
            coalesce(p_note, 'Your trial posting is now live and visible to players.'),
            '/club/trials');
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'admin', 'trial.posting.verified', 'trial_posting', p_trial_id,
            jsonb_build_object('club_id', v_club, 'note', p_note));
  end if;
end;
$$;

-- A moderator rejects a pending posting (with a reason shown to the club).
create or replace function public.admin_reject_trial(
  p_trial_id uuid,
  p_reason   text default 'Does not meet our verification standards.'
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_club uuid; v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'only administrators may reject trial postings' using errcode = '42501';
  end if;

  select club_id into v_club from public.trial_postings where id = p_trial_id;
  if v_club is null then
    raise exception 'trial posting not found' using errcode = 'P0002';
  end if;

  update public.trial_postings
     set verified = false,
         status   = 'cancelled'
   where id = p_trial_id;

  select owner_id into v_owner from public.clubs where id = v_club;
  if v_owner is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_owner, 'trial_rejected', 'Trial not published',
            coalesce(p_reason, 'Please review and correct your trial posting.'),
            '/club/trials');
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'admin', 'trial.posting.rejected', 'trial_posting', p_trial_id,
            jsonb_build_object('club_id', v_club, 'reason', p_reason));
  end if;
end;
$$;

-- Hook club entity-verification so eligible pending postings self-heal.
create or replace function public.admin_verify_club(p_club_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'only administrators may verify clubs' using errcode = '42501';
  end if;

  select owner_id into v_owner from public.clubs where id = p_club_id;
  if v_owner is null then
    raise exception 'club not found' using errcode = 'P0002';
  end if;

  update public.clubs
     set entity_verified = true,
         entity_verified_at = coalesce(entity_verified_at, now()),
         updated_at = now()
   where id = p_club_id;

  update public.profiles
     set verification_tier   = 'entity'::verification_tier,
         verification_status = 'verified',
         updated_at          = now()
   where id = v_owner
     and verification_tier not in ('gold');

  perform public.refresh_trust_and_tier(v_owner);

  -- Publish any pending postings of this club whose plan/state now qualifies.
  perform public.publish_eligible_pending_trials(p_club_id);

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'verification.club.verified', 'club', p_club_id,
          jsonb_build_object('owner', v_owner));
end;
$$;

-- Guard: a club may never self-verify / self-open a posting unless it actually
-- qualifies (entity-verified + eligible plan). Admins always may.
create or replace function public.trials_guard_publication()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() and not public.trial_may_publish(new.club_id) then
    if new.verified is true and coalesce(old.verified, false) is not true then
      raise exception 'trial verification requires admin approval or club eligibility'
        using errcode = '42501';
    end if;
    if new.status = 'open' and old.status is distinct from 'open' and new.verified is true then
      raise exception 'a trial may not be opened until it is verified'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trials_guard on public.trial_postings;
create trigger trg_trials_guard
  before update on public.trial_postings
  for each row execute function public.trials_guard_publication();

grant execute on function public.trial_may_publish(uuid) to authenticated;
grant execute on function public.publish_eligible_pending_trials(uuid) to authenticated;
grant execute on function public.admin_verify_trial(uuid, text) to authenticated;
grant execute on function public.admin_reject_trial(uuid, text) to authenticated;

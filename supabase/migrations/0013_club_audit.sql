-- ============================================================================
-- FutWeb — Club audit log & export (Pro Club feature)
-- ----------------------------------------------------------------------------
-- Gives a club a compliance-ready record of its own activity and the ability
-- to export it. The global audit_log stays admin-only and append-only; clubs
-- reach their slice through a security-definer RPC that returns rows where
-- entity_type='club' and entity_id = the caller's own club — and only after the
-- caller is proven to be a member/admin of that club (or a site admin).
--
-- The trigger below automatically records the club-relevant events that the
-- existing audit infrastructure already captures (trial created/status), so the
-- feed is populated without any client work.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- log_club_activity — write a row into the club's audit slice.
-- Validates the caller actually belongs to the club (or is an admin).
-- ---------------------------------------------------------------------------
create or replace function public.log_club_activity(
  p_club_id uuid,
  p_action  text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and auth.uid() <> (select owner_id from public.clubs where id = p_club_id)
     and not exists (
       select 1 from public.org_members m
        where m.club_id = p_club_id and m.user_id = auth.uid() and m.revoked_at is null
     )
  then
    raise exception 'you do not manage this club' using errcode = '42501';
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    (select role::text from public.profiles where id = auth.uid()),
    p_action, 'club', p_club_id, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- club_audit_log — read this club's own audit rows (newest first).
-- ---------------------------------------------------------------------------
create or replace function public.club_audit_log(p_club_id uuid, p_limit int default 200)
returns table (
  id         bigint,
  action     text,
  actor_name text,
  actor_role text,
  metadata   jsonb,
  created_at timestamptz
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and auth.uid() <> (select owner_id from public.clubs where id = p_club_id)
     and not exists (
       select 1 from public.org_members m
        where m.club_id = p_club_id and m.user_id = auth.uid() and m.revoked_at is null
     )
  then
    raise exception 'you do not manage this club' using errcode = '42501';
  end if;

  return query
    select a.id, a.action,
           coalesce(pr.full_name, 'System') as actor_name,
           coalesce(a.actor_role, 'system') as actor_role,
           a.metadata, a.created_at
      from public.audit_log a
      left join public.profiles pr on pr.id = a.actor_id
     where a.entity_type = 'club' and a.entity_id = p_club_id
     order by a.created_at desc
     limit greatest(least(coalesce(p_limit, 200), 500), 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-capture club-relevant events the existing triggers already know about:
--   * trial postings created / status changed (owned by the club)
--   * staff membership added / role changed / revoked
--   * scout reports written by this club's staff about a squad player
-- ---------------------------------------------------------------------------
create or replace function public.club_audit_trial_changes()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_club uuid;
begin
  select club_id into v_club from public.trial_postings where id = new.id;
  if v_club is null then return new; end if;

  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), (select role::text from public.profiles where id = auth.uid()),
            'trial.posted', 'club', v_club,
            jsonb_build_object('trial_id', new.id, 'title', new.title, 'status', new.status));
  elsif new.status is distinct from old.status then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), (select role::text from public.profiles where id = auth.uid()),
            'trial.status_changed', 'club', v_club,
            jsonb_build_object('trial_id', new.id, 'title', new.title, 'from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_club_audit_trials on public.trial_postings;
create trigger trg_club_audit_trials after insert or update on public.trial_postings
  for each row execute function public.club_audit_trial_changes();

create or replace function public.club_audit_staff_changes()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_full_name text;
begin
  select full_name into v_full_name from public.profiles where id = new.user_id;
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), (select role::text from public.profiles where id = auth.uid()),
            'staff.added', 'club', new.club_id,
            jsonb_build_object('user_id', new.user_id, 'role', new.role, 'user', v_full_name));
  elsif new.role is distinct from old.role then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), (select role::text from public.profiles where id = auth.uid()),
            'staff.role_changed', 'club', new.club_id,
            jsonb_build_object('user_id', new.user_id, 'from', old.role, 'to', new.role, 'user', v_full_name));
  elsif new.revoked_at is not null and old.revoked_at is null then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), (select role::text from public.profiles where id = auth.uid()),
            'staff.removed', 'club', new.club_id,
            jsonb_build_object('user_id', new.user_id, 'user', v_full_name));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_club_audit_staff on public.org_members;
create trigger trg_club_audit_staff after insert or update on public.org_members
  for each row execute function public.club_audit_staff_changes();

create or replace function public.club_audit_reports()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Only reports written by/for a club get a club-scoped audit row.
  if new.club_id is not null then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (new.author_id, (select role::text from public.profiles where id = new.author_id),
            'scout_report.created', 'club', new.club_id,
            jsonb_build_object('report_id', new.id, 'player_id', new.player_id,
                               'rating', new.rating, 'recommendation', new.recommendation::text));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_club_audit_reports on public.scout_reports;
create trigger trg_club_audit_reports after insert on public.scout_reports
  for each row execute function public.club_audit_reports();

grant execute on function public.log_club_activity(uuid, text, jsonb) to authenticated;
grant execute on function public.club_audit_log(uuid, int) to authenticated;

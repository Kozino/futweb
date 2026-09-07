-- ============================================================================
-- FutWeb — Federation / multi-academy group structure + enterprise-access
-- ----------------------------------------------------------------------------
-- Enables the Federation tier (club_enterprise): a parent club that manages a
-- set of child academies as a group, and a self-serve "request enterprise
-- access" flow for the human-contracted Federation offerings.
--
-- Model:
--   * clubs.parent_club_id  — a club whose parent is set becomes a member
--     academy of that parent (the Federation/group). A club may have at most
--     one parent.
--   * A parent may link/unlink child academies and (read) their squads. Child
--     academies remain independently owned & managed by their own staff; the
--     parent gains read visibility for group oversight only.
--   * Linking requires the caller to belong to the PARENT (staff/admin), the
--     parent to be on the Federation (club_enterprise) plan / full trial, and
--     the child to not already belong to another parent.
--   * SSO, data-residency, custom SLA, NAM, NFF onboarding, custom webhook
--     delivery remain human/contracted offerings — surfaced through the
--     enterprise_requests flow rather than fake product code.
-- ============================================================================

alter table public.clubs
  add column if not exists parent_club_id uuid references public.clubs(id) on delete set null;
create index if not exists clubs_parent_idx on public.clubs (parent_club_id);

-- A club is on the Federation tier when its OWNER's subscription is active/grace
-- on club_enterprise, or still trialing (trial = full club access).
create or replace function public.club_is_federation(p_club_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.clubs c
    join public.profiles o on o.id = c.owner_id
    where c.id = p_club_id
      and (
        o.sub_status = 'trialing'
        or (o.sub_status in ('active','grace') and o.plan_code = 'club_enterprise')
      )
  )
$$;

-- The caller is a member (owner or non-revoked staff) of this club, OR of an
-- ancestor club above it (so a parent federation can reach a child academy).
create or replace function public.user_in_club_tree(p_club_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    with recursive anc(id) as (
      select p_club_id
      union all
      select c.parent_club_id
        from public.clubs c join anc a on c.id = a.id
       where c.parent_club_id is not null
    )
    select 1 from anc n
    join public.clubs cl on cl.id = n.id
    where cl.owner_id = auth.uid()
       or exists (
         select 1 from public.org_members m
          where m.club_id = n.id and m.user_id = auth.uid() and m.revoked_at is null
       )
  )
$$;

-- ---------------------------------------------------------------------------
-- Group management (parent federation)
-- ---------------------------------------------------------------------------
create or replace function public.link_academy(
  p_parent_club_id uuid,
  p_child_club_id  uuid
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_child_parent uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode='42501'; end if;

  -- Caller must belong to the parent club.
  if not public.user_in_club_tree(p_parent_club_id) then
    raise exception 'you must be a member of the parent group' using errcode='42501';
  end if;
  if not public.club_is_federation(p_parent_club_id) then
    raise exception 'a Federation (club_enterprise) plan is required to manage academies' using errcode='42501';
  end if;

  -- Child must exist and not already be under a parent.
  if p_child_club_id = p_parent_club_id then
    raise exception 'a club cannot be its own academy' using errcode='42501';
  end if;
  if not exists (select 1 from public.clubs where id = p_child_club_id) then
    raise exception 'academy club not found' using errcode='P0002';
  end if;
  select parent_club_id into v_child_parent from public.clubs where id = p_child_club_id;
  if v_child_parent is not null and v_child_parent <> p_parent_club_id then
    raise exception 'that academy already belongs to another group' using errcode='42501';
  end if;

  update public.clubs set parent_club_id = p_parent_club_id, updated_at = now()
   where id = p_child_club_id;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), (select role::text from public.profiles where id=auth.uid()),
          'academy.linked', 'club', p_parent_club_id,
          jsonb_build_object('parent', p_parent_club_id, 'academy', p_child_club_id));
end;
$$;

create or replace function public.unlink_academy(p_parent_club_id uuid, p_child_club_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.user_in_club_tree(p_parent_club_id) then
    raise exception 'you must be a member of the parent group' using errcode='42501';
  end if;
  if not public.club_is_federation(p_parent_club_id) then
    raise exception 'a Federation plan is required to manage academies' using errcode='42501';
  end if;

  update public.clubs set parent_club_id = null, updated_at = now()
   where id = p_child_club_id and parent_club_id = p_parent_club_id;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), (select role::text from public.profiles where id=auth.uid()),
          'academy.unlinked', 'club', p_parent_club_id,
          jsonb_build_object('academy', p_child_club_id));
end;
$$;

-- The group's child academies, with a live headcount + the caller's access.
create or replace function public.federation_children(p_parent_club_id uuid)
returns table (
  id uuid, name text, short_name text, state_region text,
  player_count bigint, staff_count bigint, entity_verified boolean, linked_at timestamptz
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.user_in_club_tree(p_parent_club_id) and not public.is_admin() then
    raise exception 'not permitted' using errcode='42501';
  end if;
  return query
    select c.id, c.name, c.short_name, c.state_region,
           (select count(*) from public.players p where p.managed_by_club_id = c.id)::bigint as player_count,
           (select count(*) from public.org_members m
             where m.club_id = c.id and m.revoked_at is null)::bigint as staff_count,
           c.entity_verified,
           c.updated_at as linked_at
      from public.clubs c
     where c.parent_club_id = p_parent_club_id
     order by c.name;
end;
$$;

-- A parent may list any (public/managed) players across its academies, for
-- group oversight. Read-only.
create or replace function public.federation_academy_squad(p_child_club_id uuid)
returns table (
  id uuid, first_name text, last_name text, position_primary text,
  age int, futweb_score numeric, visibility text
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_parent uuid;
begin
  select parent_club_id into v_parent from public.clubs where id = p_child_club_id;
  if v_parent is null then raise exception 'not an academy' using errcode='P0002'; end if;
  if not public.user_in_club_tree(v_parent) and not public.is_admin() then
    raise exception 'not permitted' using errcode='42501';
  end if;
  return query
    select pl.id, pl.first_name, pl.last_name, pl.position_primary,
           date_part('year', age(pl.dob))::int as age,
           pl.futweb_score, pl.visibility::text
      from public.players pl
     where pl.managed_by_club_id = p_child_club_id
     order by pl.futweb_score desc nulls last;
end;
$$;

-- Extend player visibility so an ancestor (parent federation) can see a child
-- academy's managed players for group oversight.
create or replace function public.can_view_player(pid uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.players pl
    where pl.id = pid
      and (
        public.is_admin()
        or pl.user_id = auth.uid()
        or pl.managed_by_club_id in (select public.my_club_ids())
        or (pl.managed_by_club_id is not null and public.user_in_club_tree(pl.managed_by_club_id))
        or (
          pl.visibility = 'public'
          and public.has_active_sub()
        )
        or (
          pl.visibility = 'verified_only'
          and public.has_active_sub()
          and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.verification_tier in ('identity','entity','gold')
          )
        )
        and (
          not pl.is_minor
          or (pl.is_minor and pl.guardian_consent_at is not null)
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Self-serve enterprise-access request (for the human/contracted Federation
-- offerings: SSO, data residency, API/webhooks, SLA, NAM, NFF onboarding).
-- ---------------------------------------------------------------------------
create table if not exists public.enterprise_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.profiles(id) on delete cascade,
  organisation   text not null,
  contact_name   text not null,
  contact_email  text not null,
  contact_phone  text,
  needs          text not null,   -- comma-separated list of the items they want
  message        text,
  status         text not null default 'new' check (status in ('new','contacted','approved','declined')),
  created_at     timestamptz not null default now()
);
create index if not exists enterprise_requests_status_idx
  on public.enterprise_requests (status, created_at desc);
alter table public.enterprise_requests enable row level security;

drop policy if exists enterprise_requests_read on public.enterprise_requests;
create policy enterprise_requests_read on public.enterprise_requests
  for select using (requester_id = auth.uid() or public.is_admin());
drop policy if exists enterprise_requests_admin on public.enterprise_requests;
create policy enterprise_requests_admin on public.enterprise_requests
  for update using (public.is_admin()) with check (public.is_admin());
revoke all on table public.enterprise_requests from anon;
grant select, insert, update on table public.enterprise_requests to authenticated;

create or replace function public.submit_enterprise_request(
  p_organisation text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text default null,
  p_needs text default null,
  p_message text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if btrim(coalesce(p_organisation,'')) = '' or btrim(coalesce(p_contact_email,'')) = '' then
    raise exception 'organisation and contact email are required' using errcode='22023';
  end if;

  insert into public.enterprise_requests
    (requester_id, organisation, contact_name, contact_email, contact_phone, needs, message)
  values
    (auth.uid(), btrim(p_organisation), btrim(p_contact_name),
     btrim(p_contact_email), nullif(btrim(p_contact_phone),''),
     nullif(btrim(p_needs),''), nullif(btrim(p_message),''))
  returning id into v_id;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), (select role::text from public.profiles where id=auth.uid()),
          'enterprise.requested', 'enterprise_request', v_id,
          jsonb_build_object('organisation', p_organisation));
  return v_id;
end;
$$;

grant execute on function public.club_is_federation(uuid) to authenticated;
grant execute on function public.user_in_club_tree(uuid) to authenticated;
grant execute on function public.link_academy(uuid, uuid) to authenticated;
grant execute on function public.unlink_academy(uuid, uuid) to authenticated;
grant execute on function public.federation_children(uuid) to authenticated;
grant execute on function public.federation_academy_squad(uuid) to authenticated;
grant execute on function public.submit_enterprise_request(text, text, text, text, text, text) to authenticated;

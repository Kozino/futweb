-- ============================================================================
-- FutWeb — Profile view tracking ("who viewed your profile")
-- ----------------------------------------------------------------------------
-- Gives Pro+ players visibility into who is scouting them. A "view" is
-- recorded when a signed-in account (typically a club/scout) opens a player's
-- profile detail. The player (or admin) can read their own recent views.
--
-- The real security here lives in Postgres:
--   * Views are written ONLY through the security-definer function
--     record_profile_view(p_player_id) — there is NO direct insert policy, so
--     no client can forge a view for an arbitrary player or spoof a viewer.
--   * Self-views (the player opening their own profile) are dropped.
--   * A viewer is rate-limited to one view of the same player per ~24h.
--   * A player reads only views of their OWN player record(s); admins read all.
--   * The viewer's club is derived from auth (owner club or org membership),
--     never accepted from the client.
-- ============================================================================

create table if not exists public.profile_views (
  id               uuid primary key default gen_random_uuid(),
  viewed_player_id uuid not null references public.players(id) on delete cascade,
  viewer_id        uuid not null references public.profiles(id) on delete cascade,
  viewer_club_id   uuid references public.clubs(id) on delete set null,
  viewed_at        timestamptz not null default now()
);
create index if not exists profile_views_player_idx
  on public.profile_views (viewed_player_id, viewed_at desc);
create index if not exists profile_views_viewer_idx
  on public.profile_views (viewer_id, viewed_at desc);

alter table public.profile_views enable row level security;

-- Owner of the viewed player (or an admin) may read views. A player sees who
-- viewed their own profile(s).
drop policy if exists profile_views_owner_read on public.profile_views;
create policy profile_views_owner_read on public.profile_views
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.players p
      where p.id = viewed_player_id
        and p.user_id = auth.uid()
    )
  );

-- No direct write. Views are created only via record_profile_view (security
-- definer), so drop any accidental default policies to be safe.
drop policy if exists profile_views_all on public.profile_views;

revoke all on table public.profile_views from anon, authenticated;
grant select on table public.profile_views to authenticated;

-- ----------------------------------------------------------------------------
-- Record a profile view for the current authenticated user (security definer).
-- ----------------------------------------------------------------------------
create or replace function public.record_profile_view(p_player_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_owner  uuid;
  v_club   uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Resolve the owner of the viewed player.
  select user_id into v_owner
    from public.players where id = p_player_id;
  if v_owner is null then
    return; -- player does not exist / not visible; ignore
  end if;

  -- Never record a self-view.
  if v_owner = auth.uid() then
    return;
  end if;

  -- Derive the viewer's club (owner club first, then any active membership).
  select c.id into v_club
    from public.clubs c
   where c.owner_id = auth.uid()
   limit 1;
  if v_club is null then
    select m.club_id into v_club
      from public.org_members m
     where m.user_id = auth.uid() and m.revoked_at is null
     limit 1;
  end if;

  -- One view per viewer per player within ~24h (rate limit), not a hard block.
  if exists (
    select 1 from public.profile_views pv
     where pv.viewed_player_id = p_player_id
       and pv.viewer_id = auth.uid()
       and pv.viewed_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  insert into public.profile_views (viewed_player_id, viewer_id, viewer_club_id)
  values (p_player_id, auth.uid(), v_club);
end;
$$;

-- ----------------------------------------------------------------------------
-- A player reads who viewed their own profile(s). Security definer so we can
-- join profiles/clubs for display names (those are not directly readable across
-- accounts) while still returning ONLY rows for this caller's own players.
-- ----------------------------------------------------------------------------
create or replace function public.my_profile_views(p_limit int default 25)
returns table (
  viewer_name text,
  viewer_club text,
  viewed_at   timestamptz
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
    select coalesce(pr.full_name, 'A FutWeb user') as viewer_name,
           cl.name                                 as viewer_club,
           pv.viewed_at
      from public.profile_views pv
      join public.players pp
        on pp.id = pv.viewed_player_id and pp.user_id = auth.uid()
      left join public.profiles pr on pr.id = pv.viewer_id
      left join public.clubs cl    on cl.id = pv.viewer_club_id
     order by pv.viewed_at desc
     limit greatest(least(coalesce(p_limit, 25), 100), 1);
end;
$$;

grant execute on function public.record_profile_view(uuid) to authenticated;
grant execute on function public.my_profile_views(int) to authenticated;

-- ============================================================================
-- FutWeb — Player CV photos, public CV views and subscription-aware access
-- ----------------------------------------------------------------------------
-- A player's headshot is part of their CV, not an unscoped account setting.
-- Keep the URL on `players` so the existing player RLS rules govern every club
-- and admin read. `profiles.avatar_url` remains the source used by the signed-in
-- shell; the trigger below keeps the two values in sync.
--
-- The public directory views are deliberately a narrow, anon-readable subset
-- of the player record. They expose a headshot only for an active, public,
-- adult player and never expose contact, guardian or date-of-birth data.
-- ============================================================================

-- ------------------------------------------------------------------ photo ---
alter table public.players
  add column if not exists avatar_url text;

-- Preserve any account avatar a player already had before this column existed.
update public.players pl
set avatar_url = pr.avatar_url
from public.profiles pr
where pr.id = pl.user_id
  and pl.avatar_url is null
  and pr.avatar_url is not null;

-- New player rows inherit a pre-existing account avatar (for example, if the
-- player uploaded their headshot before completing onboarding).
create or replace function public.copy_profile_avatar_to_player()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_avatar text;
begin
  -- Never accept a client-supplied player-row URL. The account profile is the
  -- canonical source, and this also covers the onboarding insert path.
  select avatar_url
    into v_profile_avatar
    from public.profiles
   where id = new.user_id;

  new.avatar_url := v_profile_avatar;
  return new;
end;
$$;

drop trigger if exists trg_players_copy_profile_avatar on public.players;
create trigger trg_players_copy_profile_avatar
  before insert on public.players
  for each row execute function public.copy_profile_avatar_to_player();

-- Keep the CV photo in sync whenever its owner changes their account avatar.
-- The active-subscription check makes the server, not only the UI, the
-- enforcement point for adding/replacing a photo. Clearing a photo remains
-- possible so an expired account is never prevented from removing its image.
-- Admin changes remain possible for moderation.
create or replace function public.sync_player_avatar_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player_id uuid;
begin
  if new.account_type = 'player'
     and new.avatar_url is distinct from old.avatar_url then
    if new.avatar_url is not null
       and auth.uid() is not null
       and not public.is_admin()
       and not public.has_active_sub(new.id) then
      raise exception 'an active subscription is required to update a player CV photo'
        using errcode = '42501';
    end if;

    update public.players
       set avatar_url = new.avatar_url
     where user_id = new.id
     returning id into v_player_id;

    if v_player_id is not null then
      perform public.log_audit(
        'player.cv_photo_updated',
        'player',
        v_player_id,
        jsonb_build_object('has_photo', new.avatar_url is not null)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_player_avatar on public.profiles;
create trigger trg_profiles_sync_player_avatar
  after update of avatar_url on public.profiles
  for each row execute function public.sync_player_avatar_from_profile();

-- A player row must only ever mirror its owner's profile avatar. This prevents
-- a direct table update from supplying an unrelated, untracked image URL.
create or replace function public.guard_player_avatar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_avatar text;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.avatar_url is distinct from old.avatar_url then
    if new.avatar_url is not null
       and auth.uid() is not null
       and not public.is_admin()
       and not public.has_active_sub(new.user_id) then
      raise exception 'an active subscription is required to update a player CV photo'
        using errcode = '42501';
    end if;

    select avatar_url into v_profile_avatar
      from public.profiles
     where id = new.user_id;

    if new.avatar_url is distinct from v_profile_avatar then
      raise exception 'player CV photo must match the account avatar'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_players_guard_avatar on public.players;
create trigger trg_players_guard_avatar
  before update of avatar_url on public.players
  for each row execute function public.guard_player_avatar();

-- These are trigger-only security-definer functions; clients must never invoke
-- them as RPCs.
revoke all on function public.copy_profile_avatar_to_player() from public, anon, authenticated;
revoke all on function public.sync_player_avatar_from_profile() from public, anon, authenticated;
revoke all on function public.guard_player_avatar() from public, anon, authenticated;

-- Avatar object creation and replacement follow the same live-subscription
-- rule. A user cannot upload orphaned photos after access has expired and later
-- attach them to a CV. Existing public read and owner-delete behaviour remain
-- unchanged, so a person may always remove their image.
drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.is_admin() or public.has_active_sub())
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.is_admin() or public.has_active_sub())
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.is_admin() or public.has_active_sub())
  );

-- --------------------------------------------------------- player visibility
-- External CV access now also requires the *player's* subscription to be live.
-- A club's own managed players remain available to that club, as their access
-- is covered by the club seat rather than the player's personal plan.
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
        or (
          pl.managed_by_club_id is not null
          and (
            public.is_club_staff(pl.managed_by_club_id)
            or exists (
              select 1 from public.clubs pc
               where pc.id = pl.managed_by_club_id
                 and pc.parent_club_id is not null
                 and public.club_is_federation(pc.parent_club_id)
                 and public.is_club_staff(pc.parent_club_id)
            )
          )
          and (
            not pl.is_minor
            or (pl.is_minor and pl.guardian_consent_at is not null)
          )
        )
        or (
          pl.visibility = 'public'
          and public.has_active_sub()
          and public.has_active_sub(pl.user_id)
          and (
            not pl.is_minor
            or (pl.is_minor and pl.guardian_consent_at is not null)
          )
        )
        or (
          pl.visibility = 'verified_only'
          and public.has_active_sub()
          and public.has_active_sub(pl.user_id)
          and exists (
            select 1 from public.profiles p
             where p.id = auth.uid()
               and p.verification_tier in ('identity','entity','gold')
          )
          and (
            not pl.is_minor
            or (pl.is_minor and pl.guardian_consent_at is not null)
          )
        )
      )
  )
$$;

-- ---------------------------------------------------------- public CV data --
-- These views intentionally bypass the normal authenticated-player RLS path
-- for anonymous visitors, but each view repeats the full public eligibility
-- predicate. Never add raw DOB, contact or guardian fields here.
drop view if exists public.public_player_attributes;
drop view if exists public.public_player_stats;
drop view if exists public.public_player_career;
drop view if exists public.public_player_profiles;
drop view if exists public.public_clubs;

create view public.public_player_profiles
with (security_barrier = true) as
select
  pl.id,
  pl.slug::text as slug,
  pl.first_name,
  pl.last_name,
  extract(year from age(pl.dob))::integer as age,
  pl.nationality,
  pl.state_of_origin,
  pl.position_primary,
  pl.position_secondary,
  pl.foot,
  pl.height_cm,
  pl.weight_kg,
  pl.bio,
  pl.availability::text as availability,
  pl.futweb_score,
  pl.potential,
  pl.confidence,
  pl.visibility::text as visibility,
  pl.is_minor,
  pl.avatar_url,
  c.id as club_id,
  c.name as club_name,
  c.short_name as club_short_name,
  c.city as club_city,
  c.state_region as club_state,
  c.league_code as club_league,
  c.logo_url as club_logo_url,
  c.entity_verified as club_entity_verified
from public.players pl
join public.profiles owner_profile
  on owner_profile.id = pl.user_id
left join public.clubs c
  on c.id = pl.managed_by_club_id
where pl.visibility = 'public'
  and not pl.is_minor
  and owner_profile.sub_status in ('active', 'trialing', 'grace');

create view public.public_player_career
with (security_barrier = true) as
select
  ce.id,
  ce.player_id,
  ce.club_name,
  ce.season,
  ce.competition,
  ce.appearances,
  ce.goals,
  ce.assists,
  ce.verified
from public.career_entries ce
join public.players pl
  on pl.id = ce.player_id
join public.profiles owner_profile
  on owner_profile.id = pl.user_id
where pl.visibility = 'public'
  and not pl.is_minor
  and owner_profile.sub_status in ('active', 'trialing', 'grace');

create view public.public_player_stats
with (security_barrier = true) as
select
  ms.id,
  ms.player_id,
  ms.season,
  ms.competition,
  ms.appearances,
  ms.minutes,
  ms.goals,
  ms.assists,
  ms.shots,
  ms.shots_on_target,
  ms.pass_attempts,
  ms.passes_completed,
  ms.duels,
  ms.duels_won,
  ms.tackles,
  ms.interceptions,
  ms.fouls_committed,
  ms.yellow_cards,
  ms.red_cards,
  ms.clean_sheets,
  ms.goals_conceded,
  ms.saves,
  ms.verified
from public.match_stats ms
join public.players pl
  on pl.id = ms.player_id
join public.profiles owner_profile
  on owner_profile.id = pl.user_id
where pl.visibility = 'public'
  and not pl.is_minor
  and owner_profile.sub_status in ('active', 'trialing', 'grace');

create view public.public_player_attributes
with (security_barrier = true) as
select
  pa.player_id,
  pa.finishing,
  pa.passing,
  pa.dribbling,
  pa.first_touch,
  pa.crossing,
  pa.technique,
  pa.heading,
  pa.acceleration,
  pa.sprint_speed,
  pa.agility,
  pa.stamina,
  pa.strength,
  pa.jumping,
  pa.balance,
  pa.vision,
  pa.positioning,
  pa.decision_making,
  pa.work_rate,
  pa.composure,
  pa.aggression,
  pa.leadership,
  pa.marking,
  pa.tackling,
  pa.interceptions,
  pa.aerial_duels,
  pa.reflexes,
  pa.handling,
  pa.gk_distribution,
  pa.shot_stopping
from public.player_attributes pa
join public.players pl
  on pl.id = pa.player_id
join public.profiles owner_profile
  on owner_profile.id = pl.user_id
where pl.visibility = 'public'
  and not pl.is_minor
  and owner_profile.sub_status in ('active', 'trialing', 'grace');

create view public.public_clubs
with (security_barrier = true) as
select
  c.id,
  c.slug::text as slug,
  c.name,
  c.short_name,
  c.country,
  c.state_region,
  c.city,
  c.league_code,
  c.stadium,
  c.founded_year,
  c.logo_url,
  c.entity_verified,
  c.entity_verified_at,
  c.cac_number,
  c.nff_affiliation
from public.clubs c
where c.entity_verified;

revoke all on table public.public_player_profiles from public, anon, authenticated;
revoke all on table public.public_player_career from public, anon, authenticated;
revoke all on table public.public_player_stats from public, anon, authenticated;
revoke all on table public.public_player_attributes from public, anon, authenticated;
revoke all on table public.public_clubs from public, anon, authenticated;

grant select on table public.public_player_profiles to anon, authenticated;
grant select on table public.public_player_career to anon, authenticated;
grant select on table public.public_player_stats to anon, authenticated;
grant select on table public.public_player_attributes to anon, authenticated;
grant select on table public.public_clubs to anon, authenticated;

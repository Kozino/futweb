-- ============================================================================
-- FutWeb — public talent directory
-- Public discovery intentionally exposes only fields suitable for recruitment.
-- Private contact/guardian fields remain behind the existing RLS policies.
-- ============================================================================

-- NOTE: exact date of birth is never exposed through a public/anon-readable
-- view — only the derived integer `age`. dob is precise enough (combined with
-- name + club) to materially aid identity theft or child-targeting, and NDPA
-- 2023 data-minimisation applies to public exposure just as much as to any
-- other processing. Callers who are authorised to see the raw dob (the
-- player themself, their club, admins) read it from `public.players` directly,
-- which remains behind ordinary RLS.
create or replace view public.public_player_profiles as
select
  p.id, p.slug, p.first_name, p.last_name,
  extract(year from age(p.dob))::int as age,
  p.nationality, p.state_of_origin, p.position_primary, p.position_secondary,
  p.foot, p.height_cm, p.weight_kg, p.bio, p.availability,
  p.futweb_score, p.potential, p.confidence, p.visibility,
  p.is_minor, p.managed_by_club_id,
  pr.avatar_url,
  c.id as club_id, c.name as club_name, c.short_name as club_short_name,
  c.city as club_city, c.state_region as club_state, c.league_code as club_league,
  c.logo_url as club_logo_url, c.entity_verified as club_entity_verified
from public.players p
left join public.profiles pr on pr.id = p.user_id
left join public.clubs c on c.id = p.managed_by_club_id
where p.visibility = 'public'
  and (not p.is_minor or p.guardian_consent_at is not null);

grant select on public.public_player_profiles to anon, authenticated;

create or replace view public.public_player_career as
select ce.id, ce.player_id, ce.club_name, ce.season, ce.competition,
       ce.appearances, ce.goals, ce.assists, ce.verified
from public.career_entries ce
join public.players p on p.id = ce.player_id
where p.visibility = 'public'
  and (not p.is_minor or p.guardian_consent_at is not null);

grant select on public.public_player_career to anon, authenticated;

create or replace view public.public_player_stats as
select ms.id, ms.player_id, ms.season, ms.competition, ms.appearances, ms.minutes,
       ms.goals, ms.assists, ms.shots, ms.shots_on_target, ms.pass_attempts,
       ms.passes_completed, ms.duels, ms.duels_won, ms.tackles, ms.interceptions,
       ms.fouls_committed, ms.yellow_cards, ms.red_cards, ms.clean_sheets,
       ms.goals_conceded, ms.saves, ms.verified
from public.match_stats ms
join public.players p on p.id = ms.player_id
where p.visibility = 'public'
  and (not p.is_minor or p.guardian_consent_at is not null);

grant select on public.public_player_stats to anon, authenticated;

create or replace view public.public_player_attributes as
select a.*
from public.player_attributes a
join public.players p on p.id = a.player_id
where p.visibility = 'public'
  and (not p.is_minor or p.guardian_consent_at is not null);

grant select on public.public_player_attributes to anon, authenticated;

create or replace view public.public_clubs as
select id, slug, name, short_name, country, state_region, city, league_code,
       stadium, founded_year, logo_url, entity_verified, entity_verified_at,
       cac_number, nff_affiliation
from public.clubs
where entity_verified = true;

grant select on public.public_clubs to anon, authenticated;

-- ============================================================================
-- FutWeb — Withdraw server-side access when a subscription no longer covers it
-- ----------------------------------------------------------------------------
-- Audit (see docs/AUDIT_ACCESS_WITHDRAWAL.md) found that several PREMIUM reads
-- were enforced only in the client (which recomputes entitlements on every
-- render), not in the database. The database is the real security boundary, so
-- once a club's plan/subscription is downgraded or lapses the DB must stop
-- granting the withdrawn access immediately — without waiting for a code push
-- or trusting the UI to hide a button.
--
-- This migration closes the gaps that are clearly attributable to a paid tier:
--
--   * FEDERATION GROUP OVERSIGHT. Reading another organisation's academy squads
--     and player data is a club_enterprise (Federation) capability. The old
--     `federation_children`, `federation_academy_squad` and the cross-club path
--     of `can_view_player` only checked *membership* of the group, so a parent
--     that downgraded off Federation kept silent read access to every child
--     academy's players. All three now re-verify `club_is_federation(parent)`
--     before granting cross-organisation visibility.
--   * DIRECT-CLUB ACCESS is unaffected: a club's OWN owner/staff keep their own
--     players (that is not a premium cross-org read).
--   * MINOR-CONSENT GUARD. In the previous `can_view_player` the final
--     guardian-consent AND clause was grouped so tightly (AND binds before OR)
--     that it applied ONLY to the 'verified_only' branch. It now applies to
--     every non-self/non-admin visibility path, so a club cannot view a minor
--     it manages until guardian consent exists.
--
-- Everything here is `create or replace function` — idempotent and safe to re-run.
-- ============================================================================

-- A parent federation may keep group oversight ONLY while it still actually
-- holds the Federation plan (active / grace / trialing).
create or replace function public.federation_children(p_parent_club_id uuid)
returns table (
  id uuid, name text, short_name text, state_region text,
  player_count bigint, staff_count bigint, entity_verified boolean, linked_at timestamptz
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and not (public.club_is_federation(p_parent_club_id)
              and public.user_in_club_tree(p_parent_club_id)) then
    raise exception 'Federation (club_enterprise) access is required to manage a group' using errcode='42501';
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

-- A parent may read an academy's squad ONLY while it holds the Federation plan.
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
  if not public.is_admin()
     and not (public.club_is_federation(v_parent)
              and public.user_in_club_tree(v_parent)) then
    raise exception 'Federation (club_enterprise) access is required to view academy squads' using errcode='42501';
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

-- Player visibility. Rewritten so that:
--   * a club sees its OWN managed players (direct owner/staff membership) —
--     this is not a premium cross-org capability and is not withdrawn;
--   * a PARENT federation sees a child academy's players ONLY while the parent
--     still holds the Federation plan (club_enterprise active/grace/trial);
--   * the guardian-consent guard applies to every non-self/non-admin path.
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
            -- Direct: caller owns/members this managing club.
            public.is_club_staff(pl.managed_by_club_id)
            -- Federation oversight: caller belongs to an ACTIVE federation
            -- parent of this academy.
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
          and (
            not pl.is_minor
            or (pl.is_minor and pl.guardian_consent_at is not null)
          )
        )
        or (
          pl.visibility = 'verified_only'
          and public.has_active_sub()
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

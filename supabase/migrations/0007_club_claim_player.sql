-- ============================================================================
-- FutWeb — Club "Add player" (claim) support
-- ============================================================================
-- A club admin can attach an unattached registered player to their club.
-- All checks (caller is a real admin/owner of the club, the club is entity
-- verified, the player is not already attached to a club) happen in Postgres.
-- ============================================================================

-- Is the caller a club_admin or owner of at least one club?
create or replace function public.club_claim_player(p_player_id uuid)
returns uuid  -- returns the club id the player was added to
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_club   uuid;
  v_caller uuid := auth.uid();
begin
  -- Resolve which club the caller administers (prefer ownership).
  select c.id into v_club
    from public.clubs c
    where c.owner_id = v_caller
       or c.id in (
         select m.club_id from public.org_members m
         where m.user_id = v_caller
           and m.role = 'club_admin'
           and m.revoked_at is null
       )
    order by (c.owner_id = v_caller) desc
    limit 1;

  if v_club is null then
    raise exception 'You are not an administrator of any club' using errcode = '42501';
  end if;

  -- Entity-verified clubs may claim unattached players.
  if not exists (select 1 from public.clubs where id = v_club and entity_verified) then
    raise exception 'Your club must be entity verified before adding players'
      using errcode = 'P0001';
  end if;

  -- Only claim an unattached player (never steal one from another club).
  update public.players
     set managed_by_club_id = v_club,
         updated_at = now()
   where id = p_player_id
     and managed_by_club_id is null;

  if not found then
    raise exception 'Player is not available to claim' using errcode = 'P0001';
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (v_caller, 'club_admin', 'squad.player_added', 'player', p_player_id,
          jsonb_build_object('club_id', v_club));

  return v_club;
end;
$$;

grant execute on function public.club_claim_player(uuid) to authenticated;

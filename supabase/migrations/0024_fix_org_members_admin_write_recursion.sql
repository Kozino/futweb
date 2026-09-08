-- ============================================================================
-- FutWeb — Fix infinite recursion in org_members_admin_write
-- ----------------------------------------------------------------------------
-- Same defect class as 0023, one table over: `org_members_admin_write`'s
-- USING/WITH CHECK clauses queried `public.org_members` directly from within
-- a policy defined on `public.org_members`, which Postgres rejects with
-- 42P17 ("infinite recursion detected in policy for relation
-- \"org_members\"").
--
-- This was reachable from the profiles fix above: evaluating
-- `profiles_colleagues_read` (a permissive SELECT policy on profiles) reads
-- `public.org_members`, which in turn evaluates every policy defined on
-- org_members — including this one — even for a plain SELECT, because
-- `for all` policies apply to every command.
--
-- Fix: move the "is this caller a club_admin of this club" check into a
-- security-definer function, following the same pattern as is_club_staff()
-- (0014) and is_admin()/has_active_sub() (0002). Behaviour is unchanged.
-- ============================================================================

create or replace function public.is_club_admin_of(p_club_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.org_members m
    where m.club_id = p_club_id
      and m.user_id = auth.uid()
      and m.role = 'club_admin'
      and m.revoked_at is null
  )
$$;

revoke all on function public.is_club_admin_of(uuid) from public, anon;
grant execute on function public.is_club_admin_of(uuid) to authenticated;

drop policy if exists org_members_admin_write on public.org_members;
create policy org_members_admin_write on public.org_members
  for all using (
    public.is_admin()
    or public.is_club_admin_of(club_id)
  ) with check (
    public.is_admin()
    or public.is_club_admin_of(club_id)
  );

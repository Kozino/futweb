-- ============================================================================
-- FutWeb — Fix infinite recursion in profiles_self_update
-- ----------------------------------------------------------------------------
-- `profiles_self_update`'s WITH CHECK clause compared the incoming row against
-- the caller's existing row using a correlated subquery on `public.profiles`
-- itself. A policy defined on a relation may not query that same relation
-- directly — Postgres detects the cycle and raises 42P17 ("infinite recursion
-- detected in policy for relation \"profiles\"") the first time the policy is
-- actually evaluated for a client-side UPDATE.
--
-- This went unnoticed because most existing profile writes go through
-- security-definer RPCs/triggers, which bypass RLS entirely. The player CV
-- photo upload (0022) was the first path to run a plain client-side
-- `update profiles set avatar_url = ...` for a non-admin user, which is what
-- surfaced it.
--
-- Fix: move the "role/verification_tier/sub_status may not self-escalate"
-- check into a security-definer function, the same pattern already used by
-- is_admin() and has_active_sub() above. A security-definer function's
-- internal query is not subject to the caller's RLS, so no recursion occurs.
-- Behaviour is unchanged — a player still cannot alter these three fields on
-- their own row.
-- ============================================================================

create or replace function public.profiles_self_update_locked_fields_match(
  p_id uuid,
  p_role public.user_role,
  p_verification_tier public.verification_tier,
  p_sub_status public.sub_status
)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id
      and p.role = p_role
      and p.verification_tier = p_verification_tier
      and p.sub_status = p_sub_status
  )
$$;

revoke all on function public.profiles_self_update_locked_fields_match(
  uuid, public.user_role, public.verification_tier, public.sub_status
) from public, anon;

grant execute on function public.profiles_self_update_locked_fields_match(
  uuid, public.user_role, public.verification_tier, public.sub_status
) to authenticated;

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and public.profiles_self_update_locked_fields_match(auth.uid(), role, verification_tier, sub_status)
  );

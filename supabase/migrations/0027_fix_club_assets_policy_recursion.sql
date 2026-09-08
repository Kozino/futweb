-- ============================================================================
-- FutWeb — Fix club-assets storage policy to use a security-definer helper
-- ----------------------------------------------------------------------------
-- 0025 checked club ownership with a raw correlated subquery against
-- `public.clubs` directly inside a policy on `storage.objects`:
--
--   exists (select 1 from public.clubs c where c.id::text = ... and ...)
--
-- That subquery is itself subject to the caller's RLS on `public.clubs`
-- (`clubs_read`), which should have been satisfied for the actual owner —
-- but this repo has already hit this exact class of fragility twice (see
-- 0023, 0024): a policy that reaches into another RLS-protected table via a
-- plain subquery is unreliable. Their fix in both cases was to move the
-- check into a `security definer` function, which is not subject to the
-- caller's RLS at all and removes the ambiguity outright. Same fix here.
-- ============================================================================

create or replace function public.owns_club(p_club_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.clubs c
    where c.id = p_club_id
      and c.owner_id = auth.uid()
  )
$$;

revoke all on function public.owns_club(uuid) from public, anon;
grant execute on function public.owns_club(uuid) to authenticated;

drop policy if exists club_assets_owner_write on storage.objects;
create policy club_assets_owner_write on storage.objects
  for insert with check (
    bucket_id = 'club-assets'
    and (
      public.is_admin()
      or public.owns_club(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists club_assets_owner_update on storage.objects;
create policy club_assets_owner_update on storage.objects
  for update using (
    bucket_id = 'club-assets'
    and (
      public.is_admin()
      or public.owns_club(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists club_assets_owner_delete on storage.objects;
create policy club_assets_owner_delete on storage.objects
  for delete using (
    bucket_id = 'club-assets'
    and (
      public.is_admin()
      or public.owns_club(((storage.foldername(name))[1])::uuid)
    )
  );

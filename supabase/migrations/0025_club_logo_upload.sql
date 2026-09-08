-- ============================================================================
-- FutWeb — Club logo upload
-- ============================================================================
-- The `club-assets` bucket and its public-read policy already exist (see
-- migration 0004), but no one has ever been able to write to it — only
-- `avatars` got owner write/update/delete policies. This adds the equivalent
-- for club crests.
--
-- Path convention: <club_id>/logo  (mirrors <user_id>/player-cv for avatars).
-- Only the club's owner account may write to its folder, matching the
-- existing `clubs_owner_write` RLS policy on public.clubs itself — a
-- club-admin staff member who is not the owner cannot update club.logo_url
-- today, so granting them storage access alone would not be useful.

drop policy if exists club_assets_owner_write on storage.objects;
create policy club_assets_owner_write on storage.objects
  for insert with check (
    bucket_id = 'club-assets'
    and exists (
      select 1 from public.clubs c
      where c.id::text = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists club_assets_owner_update on storage.objects;
create policy club_assets_owner_update on storage.objects
  for update using (
    bucket_id = 'club-assets'
    and exists (
      select 1 from public.clubs c
      where c.id::text = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists club_assets_owner_delete on storage.objects;
create policy club_assets_owner_delete on storage.objects
  for delete using (
    bucket_id = 'club-assets'
    and exists (
      select 1 from public.clubs c
      where c.id::text = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or public.is_admin())
    )
  );

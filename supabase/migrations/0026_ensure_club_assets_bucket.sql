-- ============================================================================
-- FutWeb — Ensure the club-assets bucket exists
-- ============================================================================
-- Defensive re-seed. If this project's migration 0004 ran before the
-- club-assets bucket line existed (or was applied out of order), club logo
-- uploads fail with a raw storage 404 ("Object not found" / NoSuchKey) even
-- though the RLS policies from 0025 are correct — because there is no such
-- bucket at all. This is a no-op if the bucket already exists.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-assets', 'club-assets', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Re-assert the public-read policy too, in case it was dropped without the
-- bucket existing to back it.
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id in ('avatars','club-assets'));

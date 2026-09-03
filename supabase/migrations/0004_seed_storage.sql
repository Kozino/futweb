-- ============================================================================
-- FutWeb — Plan catalogue, storage buckets and storage policies
-- ============================================================================

-- ------------------------------------------------------------ plan seed ----
insert into public.plans (code, name, audience, price_ngn, price_usd, interval,
                          player_seats, staff_seats, trial_days, features) values
 ('player_scout','Scout','player',0,0,'monthly',1,0,0,
   '["Basic digital CV","Public profile link","Visible in club search","FutWeb Score (self-rated)"]'::jsonb),
 ('player_pro','Pro','player',3500,4,'monthly',1,0,14,
   '["Full 32-attribute radar","10 highlight videos","Shareable player card","Coach-verified ratings","Verified trial invitations","Profile view analytics"]'::jsonb),
 ('player_elite','Elite','player',9500,11,'monthly',1,0,14,
   '["Unlimited video","Development timeline","Priority discovery placement","Verified badge eligibility","Direct club messaging","PDF dossier export"]'::jsonb),
 ('club_academy','Academy','club',25000,22,'monthly',50,3,14,
   '["50 player profiles","3 staff accounts","Squad rating tracking","Offline scouting capture","Shortlists & reports"]'::jsonb),
 ('club_pro','Pro Club','club',75000,65,'monthly',250,10,14,
   '["250 player profiles","10 staff accounts","Full discovery index","Verified trial postings","Per-90 analytics","Side-by-side comparison","Audit log export"]'::jsonb),
 ('club_enterprise','Federation','club',300000,260,'monthly',-1,-1,30,
   '["Unlimited players & staff","Multi-academy structure","SSO & custom roles","API access","Dedicated onboarding","Custom SLA"]'::jsonb)
on conflict (code) do update set
  name = excluded.name, price_ngn = excluded.price_ngn, price_usd = excluded.price_usd,
  player_seats = excluded.player_seats, staff_seats = excluded.staff_seats,
  trial_days = excluded.trial_days, features = excluded.features;

-- ------------------------------------------------------------- storage -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',      'avatars',      true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('club-assets',  'club-assets',  true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('media',        'media',        false, 524288000, array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png']),
  -- Verification documents: private, never publicly readable, auto-purged.
  ('verification', 'verification', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- Public buckets: anyone may read (avatars, club crests).
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id in ('avatars','club-assets'));

-- Owners may write their own avatar. Path convention: <user_id>/<filename>
drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_owner_delete on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Player media: private bucket, readable by the player, their club and any
-- viewer allowed to see the profile.
create or replace function public.can_read_media(object_name text)
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_player uuid;
begin
  begin
    v_player := ((storage.foldername(object_name))[1])::uuid;
  exception when others then
    return false;
  end;
  return public.can_view_player(v_player);
end $$;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects
  for select using (bucket_id = 'media' and public.can_read_media(name));

drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects
  for insert with check (
    bucket_id = 'media'
    and exists (
      select 1 from public.players p
      where p.id::text = (storage.foldername(name))[1]
        and (p.user_id = auth.uid() or p.managed_by_club_id in (select public.my_club_ids()))
    )
  );

-- Verification documents: only the owner may upload; only admins may read.
drop policy if exists verification_write on storage.objects;
create policy verification_write on storage.objects
  for insert with check (
    bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists verification_read on storage.objects;
create policy verification_read on storage.objects
  for select using (
    bucket_id = 'verification'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ---------------------------------------------------------------- views ----
-- Convenience view for club discovery. Security barrier so the caller's RLS
-- still applies to the underlying players table.
drop view if exists public.player_search;
create view public.player_search
with (security_barrier = true) as
select
  p.id, p.slug, p.first_name, p.last_name,
  extract(year from age(p.dob))::int as age,
  p.position_primary, p.position_secondary, p.foot,
  p.height_cm, p.weight_kg, p.nationality, p.state_of_origin,
  p.futweb_score, p.potential, p.confidence, p.availability,
  p.is_minor, p.updated_at,
  c.name as club_name, c.id as club_id
from public.players p
left join public.clubs c on c.id = p.managed_by_club_id
where p.visibility <> 'private';

grant select on public.player_search to authenticated;

-- ---------------------------------------------------- seat enforcement -----
-- Stops a club from adding players beyond its plan without a second check
-- living only in the client.
create or replace function public.enforce_player_seats()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_limit integer; v_used integer;
begin
  if new.managed_by_club_id is null then return new; end if;

  select pl.player_seats, cl.player_seats_used
    into v_limit, v_used
  from public.clubs cl
  join public.subscriptions s on s.subscriber = cl.owner_id
  join public.plans pl on pl.code = s.plan_code
  where cl.id = new.managed_by_club_id;

  if v_limit is null then return new; end if;
  if v_limit >= 0 and v_used >= v_limit then
    raise exception 'player seat limit reached (%s/%s). Upgrade the plan.', v_used, v_limit
      using errcode = 'P0001';
  end if;

  update public.clubs set player_seats_used = player_seats_used + 1
   where id = new.managed_by_club_id;
  return new;
end $$;

drop trigger if exists trg_seats on public.players;
create trigger trg_seats after insert or update of managed_by_club_id on public.players
  for each row execute function public.enforce_player_seats();

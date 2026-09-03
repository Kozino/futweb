-- ============================================================================
-- FutWeb — Admin moderation tools + working verification submission
-- ============================================================================
-- Adds:
--   * suspended_at / suspended_reason on profiles & clubs (admin suspension).
--   * a `payload` jsonb column on verification_requests so identity, liveness
--     and reference details can be attached to a request.
--   * security-definer RPCs so the "is the caller an admin / is this their own
--     record" checks live in Postgres, not in client code:
--       - admin_set_suspension        (profiles | clubs)
--       - admin_verify_profile        (players: upgrade identity tier)
--       - admin_verify_club           (clubs: entity verification)
--       - admin_send_notification     (used for "message" actions)
--       - submit_verification_request (players & clubs self-submit; never lets
--         a user self-verify — only an admin can raise the tier afterwards)
-- ============================================================================

alter table public.profiles
  add column if not exists suspended_at   timestamptz,
  add column if not exists suspended_reason text;

alter table public.clubs
  add column if not exists suspended_at    timestamptz,
  add column if not exists suspended_reason text;

alter table public.verification_requests
  add column if not exists payload jsonb not null default '{}'::jsonb;

update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','application/pdf',
         'video/mp4','video/webm','video/quicktime'
       ],
       file_size_limit = 52428800
 where id = 'verification';

-- Suspend / reinstate a profile (player or club account owner).
create or replace function public.admin_set_suspension(
  p_target_type text,
  p_target_id   uuid,
  p_suspended   boolean,
  p_reason      text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'only administrators may moderate accounts' using errcode = '42501';
  end if;

  if p_target_type = 'profile' then
    update public.profiles
       set suspended_at   = case when p_suspended then now() else null end,
           suspended_reason = case when p_suspended then coalesce(p_reason, 'Suspended by FutWeb moderation') else null end,
           updated_at     = now()
     where id = p_target_id;
  elsif p_target_type = 'club' then
    update public.clubs
       set suspended_at   = case when p_suspended then now() else null end,
           suspended_reason = case when p_suspended then coalesce(p_reason, 'Suspended by FutWeb moderation') else null end,
           updated_at     = now()
     where id = p_target_id;
  else
    raise exception 'unknown target type' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin',
          case when p_suspended then 'account.suspended' else 'account.reinstated' end,
          p_target_type, p_target_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- Verify a person/player account: raises the identity tier + marks verified.
create or replace function public.admin_verify_profile(
  p_user_id uuid,
  p_tier    text default 'identity'
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_tier verification_tier;
begin
  if not public.is_admin() then
    raise exception 'only administrators may verify accounts' using errcode = '42501';
  end if;
  if p_tier = 'identity' then v_tier := 'identity'::verification_tier;
  elsif p_tier = 'entity' then v_tier := 'entity'::verification_tier;
  elsif p_tier = 'gold'   then v_tier := 'gold'::verification_tier;
  else v_tier := 'identity'::verification_tier;
  end if;

  update public.profiles
     set verification_tier   = v_tier,
         verification_status = 'verified',
         identity_verified_at = coalesce(identity_verified_at, now()),
         updated_at          = now()
   where id = p_user_id;

  perform public.refresh_trust_and_tier(p_user_id);

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'verification.profile.verified', 'profile', p_user_id,
          jsonb_build_object('tier', p_tier));
end;
$$;

-- Verify a club (CAC + NFF/state FA affiliation confirmed by an admin).
create or replace function public.admin_verify_club(p_club_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'only administrators may verify clubs' using errcode = '42501';
  end if;

  select owner_id into v_owner from public.clubs where id = p_club_id;
  if v_owner is null then
    raise exception 'club not found' using errcode = 'P0002';
  end if;

  update public.clubs
     set entity_verified = true,
         entity_verified_at = coalesce(entity_verified_at, now()),
         updated_at = now()
   where id = p_club_id;

  update public.profiles
     set verification_tier   = 'entity'::verification_tier,
         verification_status = 'verified',
         updated_at          = now()
   where id = v_owner
     and verification_tier not in ('gold');

  perform public.refresh_trust_and_tier(v_owner);

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'verification.club.verified', 'club', p_club_id,
          jsonb_build_object('owner', v_owner));
end;
$$;

-- "Message a user" — delivered through the in-app notification centre.
create or replace function public.admin_send_notification(
  p_to_user uuid,
  p_title   text,
  p_body    text default null,
  p_link    text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'only administrators may send platform messages' using errcode = '42501';
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (p_to_user, 'admin_message', p_title, p_body, p_link);

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', 'admin.message.sent', 'notification', null,
          jsonb_build_object('to_user', p_to_user, 'title', p_title));
end;
$$;

-- Self-service verification submission (players AND clubs)
create or replace function public.submit_verification_request(
  p_kind      text,
  p_payload   jsonb default '{}'::jsonb,
  p_docs      jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id        uuid;
  v_account   account_type;
  v_club      uuid;
  v_doc       jsonb;
  v_subject   uuid := auth.uid();
begin
  select account_type into v_account
    from public.profiles where id = v_subject;
  if v_account is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if v_account = 'club' then
    select id into v_club from public.clubs
      where owner_id = v_subject or id in (select public.my_club_ids())
      order by (owner_id = v_subject) desc limit 1;
  end if;

  insert into public.verification_requests
    (subject_id, club_id, kind, status, payload)
  values
    (v_subject, v_club, p_kind, 'pending', p_payload)
  returning id into v_id;

  for v_doc in select * from jsonb_array_elements(p_docs)
  loop
    insert into public.verification_documents (request_id, kind, storage_path)
    values (v_id, v_doc->>'kind', v_doc->>'storage_path');
  end loop;

  update public.profiles
     set verification_status = 'pending',
         updated_at = now()
   where id = v_subject
     and verification_status = 'none';

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (v_subject, 'authenticated', 'verification.requested', 'verification_request', v_id,
          jsonb_build_object('kind', p_kind));

  return v_id;
end;
$$;

grant execute on function public.admin_set_suspension(text, uuid, boolean, text) to authenticated;
grant execute on function public.admin_verify_profile(uuid, text) to authenticated;
grant execute on function public.admin_verify_club(uuid) to authenticated;
grant execute on function public.admin_send_notification(uuid, text, text, text) to authenticated;
grant execute on function public.submit_verification_request(text, jsonb, jsonb) to authenticated;

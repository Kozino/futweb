-- ============================================================================
-- 0008: staff invites + extended club profile fields
-- ============================================================================
-- Problem this fixes:
--   Staff.tsx could only attach a person who already had a `profiles` row.
--   There was no path for "invite someone who has never signed up yet".
--   handle_new_user() also always creates a brand-new club for any signup
--   with account_type = 'club', so simply inviting a stranger to register as
--   a "club" account would give *them* their own separate club, not seat
--   them inside the inviting club.
--
-- Fix:
--   invite-staff (edge function, service-role) either:
--     (a) attaches an existing profile to org_members directly, or
--     (b) calls supabase.auth.admin.inviteUserByEmail(...) with
--         invited_club_id / invited_role / invited_by in the user's
--         metadata. Supabase creates the auth.users row immediately and
--         emails them a "set your password" link.
--   handle_new_user() now reads that metadata: when present, it seats the
--   new profile straight into org_members under the *inviting* club with
--   the chosen role and skips the "spin up a new club" branch entirely, so
--   the person logs in with exactly the limited role they were given.
-- ============================================================================

-- --------------------------------------------------------- club profile ---
alter table public.clubs
  add column if not exists address    text,
  add column if not exists owner_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email citext;

-- ------------------------------------------------------- signup rewrite ---
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_account_type account_type := coalesce(
    (new.raw_user_meta_data->>'account_type')::account_type, 'player');
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_club_name text := new.raw_user_meta_data->>'club_name';
  v_club_id   uuid;
  -- Present only when this signup originated from an "Add staff" invite.
  v_invited_club_id uuid := nullif(new.raw_user_meta_data->>'invited_club_id', '')::uuid;
  v_invited_role     user_role := nullif(new.raw_user_meta_data->>'invited_role', '')::user_role;
  v_invited_by       uuid := nullif(new.raw_user_meta_data->>'invited_by', '')::uuid;
begin
  insert into public.profiles (id, email, full_name, account_type, role, phone,
                               email_verified, verification_status, sub_status, trial_ends_at)
  values (
    new.id, new.email, v_full_name,
    case when v_invited_club_id is not null then 'club'::account_type else v_account_type end,
    case
      when v_invited_club_id is not null then coalesce(v_invited_role, 'scout'::user_role)
      when v_account_type = 'club' then 'club_admin'::user_role
      else 'player'::user_role
    end,
    new.raw_user_meta_data->>'phone',
    coalesce(new.email_confirmed_at is not null, false),
    'none',
    'trialing',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;

  if v_invited_club_id is not null then
    -- Invited staff: seat them in the inviting club only. Never create a
    -- second club for them, no matter what account_type was requested.
    insert into public.org_members (club_id, user_id, role, invited_by, accepted_at)
    values (v_invited_club_id, new.id, coalesce(v_invited_role, 'scout'), v_invited_by, now())
    on conflict (club_id, user_id) do update
      set role = excluded.role, revoked_at = null, accepted_at = now();

  elsif v_account_type = 'club' then
    insert into public.clubs (owner_id, slug, name, short_name)
    values (
      new.id,
      regexp_replace(lower(coalesce(v_club_name, v_full_name)), '[^a-z0-9]+', '-', 'g'),
      coalesce(v_club_name, v_full_name || '''s Club'),
      upper(left(regexp_replace(coalesce(v_club_name, v_full_name), '[^a-zA-Z0-9]', '', 'g'), 3))
    )
    returning id into v_club_id;

    insert into public.org_members (club_id, user_id, role, accepted_at)
    values (v_club_id, new.id, 'club_admin', now());

    update public.profiles set sub_status = 'trialing' where id = new.id;
  end if;

  insert into public.consents (subject_id, kind, version, granted)
  values (new.id, 'terms_of_service', '2025-09-01', true);

  perform public.log_audit('user.created', 'profile', new.id,
                           jsonb_build_object('account_type', v_account_type, 'invited_club_id', v_invited_club_id));
  return new;
end $$;

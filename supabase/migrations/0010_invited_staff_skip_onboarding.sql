-- ============================================================================
-- 0010: invited staff should skip club onboarding
-- ============================================================================
-- Problem:
--   handle_new_user() (0008) correctly sets account_type = 'club' for anyone
--   invited via invited_club_id, so route guards like RequireRole('club')
--   treat them as club-side users. But it never marks onboarding as
--   complete for that path, so SmartRedirect (App.tsx) sends them to
--   /onboarding/club after they set their password on /accept-invite \u2014
--   the "create a new club" wizard, which is wrong for someone joining a
--   club that's already set up.
--
-- Fix:
--   When v_invited_club_id is not null, also set onboarding_complete = true
--   on their profile, so SmartRedirect takes them straight to /club instead.
--
-- NOTE: assumes the profiles column is named `onboarding_complete`
-- (snake_case, consistent with the rest of this function). Adjust the
-- column name below if your schema differs.
-- ============================================================================

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
  v_invited_club_id uuid := nullif(new.raw_user_meta_data->>'invited_club_id', '')::uuid;
  v_invited_role     user_role := nullif(new.raw_user_meta_data->>'invited_role', '')::user_role;
  v_invited_by       uuid := nullif(new.raw_user_meta_data->>'invited_by', '')::uuid;
begin
  insert into public.profiles (id, email, full_name, account_type, role, phone,
                               email_verified, verification_status, sub_status, trial_ends_at,
                               onboarding_complete)
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
    now() + interval '14 days',
    -- Invited staff join an already-onboarded club — skip the wizard.
    v_invited_club_id is not null
  )
  on conflict (id) do nothing;

  if v_invited_club_id is not null then
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

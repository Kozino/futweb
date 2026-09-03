-- ============================================================================
-- FutWeb — Real player onboarding
-- ============================================================================

-- The current schema already has:
--   unique (player_id, season)
-- on match_stats, so no duplicate index is required here.


-- ----------------------------------------------------------------------------
-- Secure player onboarding RPC
-- ----------------------------------------------------------------------------

create or replace function public.complete_player_onboarding(
  p_first_name text,
  p_last_name text,
  p_dob date,
  p_position_primary text,
  p_position_secondary text[] default '{}',
  p_foot text default 'right',
  p_height_cm smallint default null,
  p_weight_kg smallint default null,
  p_nationality text default 'Nigeria',
  p_state_of_origin text default null,
  p_bio text default null,
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_guardian_email text default null,
  p_guardian_consent_at timestamptz default null
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.profiles;
  v_existing public.players;
  v_player public.players;
  v_slug citext;
  v_base_slug text;
  v_is_minor boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.account_type <> 'player' then
    raise exception 'Only player accounts can complete player onboarding';
  end if;


  -- Idempotent: never create a second player for the same account.
  select *
  into v_existing
  from public.players
  where user_id = v_user_id
  limit 1;

  if found then
    update public.profiles
    set onboarding_complete = true,
        updated_at = now()
    where id = v_user_id;

    return v_existing;
  end if;


  -- --------------------------------------------------------------------------
  -- Validation
  -- --------------------------------------------------------------------------

  if nullif(trim(p_first_name), '') is null then
    raise exception 'First name is required';
  end if;

  if nullif(trim(p_last_name), '') is null then
    raise exception 'Last name is required';
  end if;

  if p_dob is null then
    raise exception 'Date of birth is required';
  end if;

  if p_dob > current_date then
    raise exception 'Date of birth cannot be in the future';
  end if;

  if nullif(trim(p_position_primary), '') is null then
    raise exception 'Primary position is required';
  end if;

  if p_foot not in ('left', 'right', 'both') then
    raise exception 'Invalid preferred foot';
  end if;

  if p_height_cm is not null
     and (p_height_cm < 120 or p_height_cm > 230) then
    raise exception 'Invalid height';
  end if;

  if p_weight_kg is not null
     and (p_weight_kg < 35 or p_weight_kg > 160) then
    raise exception 'Invalid weight';
  end if;


  v_is_minor :=
    p_dob > (current_date - interval '18 years');


  -- Guardian information is required for minors.
  if v_is_minor then
    if nullif(trim(p_guardian_name), '') is null then
      raise exception 'Guardian name is required for under-18 players';
    end if;

    if p_guardian_consent_at is null then
      raise exception 'Guardian consent is required for under-18 players';
    end if;
  end if;


  -- --------------------------------------------------------------------------
  -- Generate a stable player slug.
  -- --------------------------------------------------------------------------

  v_base_slug :=
    lower(
      regexp_replace(
        trim(p_first_name) || '-' || trim(p_last_name),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    );

  v_base_slug := trim(both '-' from v_base_slug);

  v_slug :=
    (
      v_base_slug
      || '-'
      || left(replace(v_user_id::text, '-', ''), 8)
    )::citext;


  -- --------------------------------------------------------------------------
  -- Create the actual player record.
  -- --------------------------------------------------------------------------

  insert into public.players (
    user_id,
    slug,
    first_name,
    last_name,
    dob,
    nationality,
    state_of_origin,
    position_primary,
    position_secondary,
    foot,
    height_cm,
    weight_kg,
    bio,
    availability,
    visibility,
    guardian_name,
    guardian_phone,
    guardian_email,
    guardian_consent_at
  )
  values (
    v_user_id,
    v_slug,
    trim(p_first_name),
    trim(p_last_name),
    p_dob,
    coalesce(nullif(trim(p_nationality), ''), 'Nigeria'),
    nullif(trim(p_state_of_origin), ''),
    trim(p_position_primary),
    coalesce(p_position_secondary, '{}'),
    p_foot,
    p_height_cm,
    p_weight_kg,
    nullif(trim(p_bio), ''),
      'available'::availability,
    case
      when v_is_minor then 'verified_only'::visibility_scope
      else 'public'::visibility_scope
    end,
    nullif(trim(p_guardian_name), ''),
    nullif(trim(p_guardian_phone), ''),
    nullif(trim(p_guardian_email), ''),
    p_guardian_consent_at
  )
  returning *
  into v_player;


  -- Every player gets an attributes record.
  insert into public.player_attributes (player_id)
  values (v_player.id)
  on conflict (player_id) do nothing;


  -- Mark onboarding complete only after the player row exists.
  update public.profiles
  set onboarding_complete = true,
      updated_at = now()
  where id = v_user_id;


  return v_player;
end;
$$;


-- ----------------------------------------------------------------------------
-- Permissions
-- ----------------------------------------------------------------------------

revoke all
on function public.complete_player_onboarding(
  text,
  text,
  date,
  text,
  text[],
  text,
  smallint,
  smallint,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
from public;

revoke all
on function public.complete_player_onboarding(
  text,
  text,
  date,
  text,
  text[],
  text,
  smallint,
  smallint,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
from anon;

grant execute
on function public.complete_player_onboarding(
  text,
  text,
  date,
  text,
  text[],
  text,
  smallint,
  smallint,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
to authenticated;

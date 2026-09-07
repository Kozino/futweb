-- ============================================================================
-- FutWeb — Direct player ↔ club messaging (Elite player feature)
-- ----------------------------------------------------------------------------
-- A private, reciprocal conversation between ONE player and ONE club.
--
-- Security & trust model (mirrors the rest of the codebase):
--   * Conversations are only ever created through the security-definer RPC
--     open_conversation(p_player_id, p_club_id), which:
--       - requires the caller to BE the player (owner of the players row) or a
--         staff/admin of the club;
--       - requires the PLAYER's account to be entitled to direct_messaging
--         (Elite, full-access trial, or site admin) — messaging is sold to the
--         player, so a free Scout account cannot use it;
--       - only permits the CLUB to be one that is ENTITY-VERIFIED (a real,
--         admin-confirmed organisation) — keeps trust high and blocks spam;
--   * No direct table insert/update policy exists; all reads & writes go
--     through security-definer RPCs so participants are always re-derived from
--     auth.uid() — never from the client.
--   * Minors: a club may not message a minor player unless guardian consent is
--     recorded. Every message involving a minor is mirrored to the audit log so
--     the (documented) guardian-copy email worker can pick it up.
-- ============================================================================

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (player_id, club_id)
);
create index if not exists conversations_player_idx on public.conversations (player_id, updated_at desc);
create index if not exists conversations_club_idx   on public.conversations (club_id, updated_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id),
  sender_role     text not null check (sender_role in ('player','club')),
  body            text not null check (char_length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
drop policy if exists conversations_any on public.conversations;
drop policy if exists messages_any on public.messages;
revoke all on table public.conversations from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
grant select, insert, update on table public.conversations to authenticated;
grant select, insert, update on table public.messages to authenticated;

-- Is the caller a staff member / owner of this club?
create or replace function public.is_club_staff(p_club_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.clubs c
     where c.id = p_club_id and c.owner_id = auth.uid()
    union all
    select 1 from public.org_members m
     where m.club_id = p_club_id and m.user_id = auth.uid()
       and m.revoked_at is null
  )
$$;

-- Player's account entitled to direct messaging (Elite / full trial / admin).
create or replace function public.player_can_message(p_player_id uuid)
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_user uuid;
begin
  select user_id into v_user from public.players where id = p_player_id;
  if v_user is null then return false; end if;
  if public.is_admin() then return true; end if;
  return exists (
    select 1 from public.profiles p
     where p.id = v_user
       and p.sub_status = 'trialing'
    union all
    select 1 from public.profiles p
     where p.id = v_user
       and p.sub_status in ('active','grace')
       and p.plan_code = 'player_elite'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Open (or fetch) a conversation between a player and an entity-verified club.
-- Caller must be the player or a staff member of the club.
-- ---------------------------------------------------------------------------
create or replace function public.open_conversation(p_player_id uuid, p_club_id uuid)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_owner    uuid;
  v_verified boolean;
  v_id       uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode='42501'; end if;

  select user_id into v_owner from public.players where id = p_player_id;
  if v_owner is null then raise exception 'player not found' using errcode='P0002'; end if;

  -- Caller must be the player OR club staff.
  if v_owner <> auth.uid() and not public.is_club_staff(p_club_id) then
    raise exception 'you are not a participant in this conversation' using errcode='42501';
  end if;

  -- Messaging is an Elite player feature.
  if not public.player_can_message(p_player_id) then
    raise exception 'direct messaging is included with the Elite plan' using errcode='42501';
  end if;

  -- Only entity-verified clubs participate (trust + anti-spam).
  select entity_verified into v_verified from public.clubs where id = p_club_id;
  if coalesce(v_verified, false) is false then
    raise exception 'this club is not verified to message yet' using errcode='42501';
  end if;

  select id into v_id from public.conversations
   where player_id = p_player_id and club_id = p_club_id;
  if v_id is null then
    insert into public.conversations (player_id, club_id, created_by)
    values (p_player_id, p_club_id, auth.uid())
    returning id into v_id;
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), (select role::text from public.profiles where id = auth.uid()),
            'conversation.opened', 'conversation', v_id,
            jsonb_build_object('player_id', p_player_id, 'club_id', p_club_id));
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Send a message into a conversation the caller belongs to.
-- ---------------------------------------------------------------------------
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid; v_club uuid;
  v_minor boolean; v_consent boolean; v_role text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select player_id, club_id into v_player, v_club
    from public.conversations where id = p_conversation_id;
  if v_player is null then raise exception 'conversation not found' using errcode='P0002'; end if;

  -- Determine sender side.
  if (select user_id from public.players where id = v_player) = auth.uid() then
    v_role := 'player';
  elsif public.is_club_staff(v_club) then
    v_role := 'club';
  else
    raise exception 'you are not a participant in this conversation' using errcode='42501';
  end if;

  -- Player must still be entitled (Elite) to keep messaging open.
  if not public.player_can_message(v_player) then
    raise exception 'direct messaging is included with the Elite plan' using errcode='42501';
  end if;

  -- Minor safeguard.
  select is_minor, guardian_consent_at is not null into v_minor, v_consent
    from public.players where id = v_player;
  if v_minor and not v_consent then
    raise exception 'guardian consent is required before messaging a minor' using errcode='42501';
  end if;

  insert into public.messages (conversation_id, sender_id, sender_role, body)
  values (p_conversation_id, auth.uid(), v_role, btrim(p_body))
  returning id into v_id;

  update public.conversations set updated_at = now() where id = p_conversation_id;

  if v_minor then
    -- Mirrored for the guardian-copy email worker (documented separately).
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (auth.uid(), v_role, 'minor.message.sent', 'message', v_id,
            jsonb_build_object('conversation_id', p_conversation_id, 'club_id', v_club,
                               'player_id', v_player, 'role', v_role));
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark every message in a conversation the caller is a participant of as read.
-- ---------------------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_player uuid; v_club uuid;
begin
  select player_id, club_id into v_player, v_club
    from public.conversations where id = p_conversation_id;
  if v_player is null then return; end if;

  if (select user_id from public.players where id = v_player) <> auth.uid()
     and not public.is_club_staff(v_club) then
    raise exception 'you are not a participant in this conversation' using errcode='42501';
  end if;

  update public.messages
     set read_at = now()
   where conversation_id = p_conversation_id
     and sender_id <> auth.uid()
     and read_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read helpers.
-- ---------------------------------------------------------------------------
create or replace function public.my_conversations()
returns table (
  id uuid, player_id uuid, club_id uuid,
  club_name text, player_name text, other_name text, other_role text,
  last_message text, last_message_at timestamptz,
  unread bigint
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  return query
    select c.id, c.player_id, c.club_id,
           cl.name,
           coalesce(pl.first_name || ' ' || pl.last_name, 'Player'),
           case when c.club_id in (select id from public.clubs where owner_id = v_user)
                     or exists (select 1 from public.org_members m where m.club_id = c.club_id and m.user_id = v_user and m.revoked_at is null)
                then coalesce(pl.first_name || ' ' || pl.last_name, 'Player')
                else cl.name end,
           case when c.club_id in (select id from public.clubs where owner_id = v_user)
                     or exists (select 1 from public.org_members m where m.club_id = c.club_id and m.user_id = v_user and m.revoked_at is null)
                then 'club' else 'player' end,
           (select body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
           c.updated_at,
           (select count(*) from public.messages m
             where m.conversation_id = c.id and m.sender_id <> v_user and m.read_at is null)
      from public.conversations c
      join public.clubs cl on cl.id = c.club_id
      join public.players pl on pl.id = c.player_id
     where (select user_id from public.players where id = c.player_id) = v_user
        or c.club_id in (select id from public.clubs where owner_id = v_user)
        or exists (select 1 from public.org_members m where m.club_id = c.club_id and m.user_id = v_user and m.revoked_at is null)
     order by c.updated_at desc;
end;
$$;

create or replace function public.conversation_messages(p_conversation_id uuid)
returns table (
  id uuid, sender_id uuid, sender_role text, body text, read_at timestamptz, created_at timestamptz
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_player uuid; v_club uuid;
begin
  select player_id, club_id into v_player, v_club
    from public.conversations where id = p_conversation_id;
  if v_player is null then raise exception 'conversation not found' using errcode='P0002'; end if;

  if (select user_id from public.players where id = v_player) <> auth.uid()
     and not public.is_club_staff(v_club) and not public.is_admin() then
    raise exception 'you are not a participant in this conversation' using errcode='42501';
  end if;

  return query
    select m.id, m.sender_id, m.sender_role, m.body, m.read_at, m.created_at
      from public.messages m
     where m.conversation_id = p_conversation_id
     order by m.created_at asc;
end;
$$;

grant execute on function public.open_conversation(uuid, uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.conversation_messages(uuid) to authenticated;

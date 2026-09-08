-- ============================================================================
-- FutWeb — Guardian copy pipeline for club→minor messaging
-- ----------------------------------------------------------------------------
-- Makes the minor-protection guarantee real: EVERY message a club sends to a
-- minor player produces a durable, auditable copy addressed to that minor's
-- registered guardian, and the platform exposes a delivery outbox so the copy
-- is actually sent (via a deployable worker) rather than merely commented on.
--
-- Prior behaviour: send_message only wrote an `audit_log` row with a comment
-- saying a "guardian-copy email worker (documented separately)" would pick it
-- up — the copy was never captured. This migration:
--   1. adds a `guardian_copies` outbox (per-message durable copy),
--   2. rewrites `send_message` so every club message to a minor inserts a copy
--      addressed to the minor's guardian (name/email from the player record),
--   3. grants a read RPC so a player/guardian-side account and admins can see
--      copies, and an admin health function,
--   4. ships a deployable worker (supabase/functions/guardian-copy-deliver)
--      that sends pending copies and marks them delivered.
-- The actual email/SMS send is external/credential-bound, so it is wired as a
-- runbook-deployable edge function (mirrors api-webhook-deliver); it is NOT
-- faked as product code that pretends delivery already happened.
--
-- Idempotent (create or replace / add column if not exists). Safe to re-run.
-- ============================================================================

-- Durable per-message copy outbox.
create table if not exists public.guardian_copies (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.messages(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  guardian_name text,
  guardian_email citext,
  message_body  text not null,
  sender_role   text not null check (sender_role in ('club','player')),
  status        text not null default 'pending'
                  check (status in ('pending','delivered','failed','unreachable')),
  attempts      int  not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  next_attempt_at timestamptz not null default now()
);
create index if not exists guardian_copies_pending_idx
  on public.guardian_copies (next_attempt_at) where status = 'pending';
create index if not exists guardian_copies_player_idx
  on public.guardian_copies (player_id, created_at desc);

alter table public.guardian_copies enable row level security;
drop policy if exists guardian_copies_read on public.guardian_copies;
create policy guardian_copies_read on public.guardian_copies
  for select using (
    public.is_admin()
    or player_id in (
      select id from public.players pl
      where pl.user_id = auth.uid()
         or pl.guardian_email = (select email::citext from public.profiles where id = auth.uid())
    )
  );
revoke all on table public.guardian_copies from anon;
grant select on table public.guardian_copies to authenticated;

-- Rewrite send_message so a minor-bound club message also captures the copy.
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid; v_club uuid;
  v_minor boolean; v_consent boolean; v_role text;
  v_id uuid;
  v_g_name text; v_g_email citext;
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

  -- Minor safeguard: messaging requires recorded guardian consent.
  select is_minor, guardian_consent_at is not null,
         guardian_name, guardian_email
    into v_minor, v_consent, v_g_name, v_g_email
    from public.players where id = v_player;
  if v_minor and not v_consent then
    raise exception 'guardian consent is required before messaging a minor' using errcode='42501';
  end if;

  insert into public.messages (conversation_id, sender_id, sender_role, body)
  values (p_conversation_id, auth.uid(), v_role, btrim(p_body))
  returning id into v_id;

  update public.conversations set updated_at = now() where id = p_conversation_id;

  -- Guardian copy: every message involving a minor is captured for the
  -- guardian, regardless of sender role. Audit is secondary evidence.
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_role, 'minor.message.sent', 'message', v_id,
          jsonb_build_object('conversation_id', p_conversation_id, 'club_id', v_club,
                             'player_id', v_player, 'role', v_role));

  if v_minor then
    insert into public.guardian_copies
      (message_id, player_id, club_id, guardian_name, guardian_email,
       message_body, sender_role)
    values (v_id, v_player, v_club, v_g_name, v_g_email, btrim(p_body), v_role);
  end if;
  return v_id;
end;
$$;

-- RPC: list guardian copies visible to this account (as player, or as the
-- registered guardian whose email matches). Admins see everything.
create or replace function public.my_guardian_copies(p_limit int default 50)
returns table (
  id uuid, message_body text, sender_role text, club_name text,
  guardian_name text, status text, created_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select gc.id, gc.message_body, gc.sender_role,
           coalesce(cl.name, 'club') as club_name,
           gc.guardian_name, gc.status, gc.created_at
      from public.guardian_copies gc
      left join public.clubs cl on cl.id = gc.club_id
     where public.is_admin()
        or gc.player_id in (
          select pl.id from public.players pl
           where pl.user_id = auth.uid()
              or pl.guardian_email = (select email::citext from public.profiles where id = auth.uid())
        )
     order by gc.created_at desc
     limit greatest(1, least(p_limit, 500));
end;
$$;

-- Admin health: pending / unreachable copies awaiting delivery.
create or replace function public.admin_guardian_copies_health(p_limit int default 40)
returns table (
  player_name text, guardian_name text, guardian_email text,
  message_body text, sender_role text, status text, attempts int, last_error text,
  created_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(pl.first_name || ' ' || pl.last_name, 'player') as player_name,
         gc.guardian_name, gc.guardian_email::text, gc.message_body,
         gc.sender_role, gc.status, gc.attempts, gc.last_error, gc.created_at
    from public.guardian_copies gc
    left join public.players pl on pl.id = gc.player_id
   where public.is_admin()
   order by gc.created_at desc
   limit greatest(1, least(p_limit, 500))
$$;

grant execute on function public.my_guardian_copies(int) to authenticated;
grant execute on function public.admin_guardian_copies_health(int) to authenticated;

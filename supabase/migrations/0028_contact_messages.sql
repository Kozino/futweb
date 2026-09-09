-- ============================================================================
-- Contact Us submissions (public marketing site -> admin console)
--
-- The /contact page on the public site is reachable by anyone, signed in or
-- not, so inserts must be allowed for the Postgres "anon" role. Reading and
-- updating is restricted to admins via public.is_admin() (see 0002_rls.sql).
-- ============================================================================

create table if not exists public.contact_messages (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  email          text not null,
  topic          text not null default 'other'
                   check (topic in ('sales','player','trust','press','other')),
  organisation   text,
  message        text not null,
  status         text not null default 'new'
                   check (status in ('new','read','replied','archived')),
  created_at     timestamptz not null default now()
);

create index if not exists contact_messages_status_idx
  on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_submit on public.contact_messages;
create policy contact_messages_submit on public.contact_messages
  for insert
  with check (
    char_length(trim(full_name)) > 0
    and char_length(trim(email)) > 0
    and char_length(trim(message)) > 0
  );

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages
  for select using (public.is_admin());

drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update on public.contact_messages
  for update using (public.is_admin()) with check (public.is_admin());

-- Anyone (including signed-out visitors) may submit; only admins may read/update.
revoke all on table public.contact_messages from anon, authenticated;
grant insert on table public.contact_messages to anon, authenticated;
grant select, update on table public.contact_messages to authenticated;

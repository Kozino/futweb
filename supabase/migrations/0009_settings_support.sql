-- ============================================================================
-- 0009: settings page support (notification prefs + data requests)
-- ============================================================================
-- Settings.tsx previously only toasted on click; nothing was persisted or
-- sent anywhere. This adds the minimum backing store needed to make those
-- controls real:
--   * profiles.notification_prefs — per-channel toggle state.
--   * data_requests — an auditable queue for "export my data" / "delete my
--     data" requests under the Nigeria Data Protection Act 2023, so a
--     click creates a real, staff-visible record instead of nothing.
-- ============================================================================

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default
    '{"trial": true, "message": true, "report": true, "digest": false}'::jsonb;

create table if not exists public.data_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('export', 'deletion')),
  status      text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  note        text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists data_requests_user_idx on public.data_requests (user_id);

alter table public.data_requests enable row level security;

drop policy if exists data_requests_self on public.data_requests;
create policy data_requests_self on public.data_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists data_requests_self_insert on public.data_requests;
create policy data_requests_self_insert on public.data_requests
  for insert with check (user_id = auth.uid());

-- Only staff resolve requests; a user can never mark their own as completed.
drop policy if exists data_requests_admin_update on public.data_requests;
create policy data_requests_admin_update on public.data_requests
  for update using (public.is_admin()) with check (public.is_admin());

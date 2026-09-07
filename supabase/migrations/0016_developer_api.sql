-- ============================================================================
-- FutWeb — Federation developer access: API keys, webhooks & custom roles
-- ----------------------------------------------------------------------------
-- Scaffolding for the Federation "API access + webhook streams" and "custom
-- roles & RBAC" add-on capabilities. All are additive and gated to the
-- Federation (club_enterprise) tier, or full trial / admin.
--
-- HONEST ENFORCEMENT NOTE:
--   * The platform's core RBAC still keys off the `user_role` enum on
--     profiles/org_members, which RLS reads. True arbitrary role names cannot
--     be honoured by RLS without a wider schema migration (changing the enum),
--     so a `custom_role` defined here is honoured at the APPLICATION layer
--     (the UI/route guards read it) and stored as data — it does NOT yet
--     override DB-level RLS. Keep that in mind before offering arbitrary
--     role names as a hard security boundary.
--   * API keys are the real, working part: an external system presents an
--     API key and is resolved to the owning club via `resolve_api_key`. A
--     production rollout then exposes read-only player/search endpoints through
--     a deployed edge function that calls this function.
--   * Webhook delivery is scaffolded end-to-end in SQL + a worker edge-function
--     template (supabase/functions/api-webhook-deliver) — deploy that to run it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Custom role definitions (Federation-level; data + app-layer enforcement)
-- ---------------------------------------------------------------------------
create table if not exists public.club_custom_roles (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  permissions text[] not null default '{}',
  created_at  timestamptz not null default now(),
  unique (club_id, name)
);
alter table public.club_custom_roles enable row level security;
drop policy if exists custom_roles_manage on public.club_custom_roles;
create policy custom_roles_manage on public.club_custom_roles
  for all using (
    public.is_admin()
    or club_id in (select public.my_club_ids())
  ) with check (
    public.is_admin()
    or club_id in (select public.my_club_ids())
  );
revoke all on table public.club_custom_roles from anon;
grant select, insert, update, delete on table public.club_custom_roles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. API keys (Federation). We store only a SHA-256 hash of the key.
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  key_hash    text not null unique,   -- sha256 hex of the raw key
  key_prefix  text not null,          -- e.g. 'fw_...' first 10 chars for display
  scope       text[] not null default '{read}' check (scope <@ '{read,write,admin}'),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);
create index if not exists api_keys_club_idx on public.api_keys (club_id);
alter table public.api_keys enable row level security;
drop policy if exists api_keys_manage on public.api_keys;
create policy api_keys_manage on public.api_keys
  for all using (
    public.is_admin()
    or club_id in (select public.my_club_ids())
  ) with check (
    public.is_admin()
    or club_id in (select public.my_club_ids())
  );
revoke all on table public.api_keys from anon;
grant select, update on table public.api_keys to authenticated;

-- Create an API key. Returns the raw key ONCE so the caller can display it.
create or replace function public.create_api_key(p_name text, p_scope text[] default '{read}')
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
  v_raw  text;
  v_prefix text;
begin
  -- Resolve the caller's club (owner club or first active membership).
  select c.id into v_club from public.clubs c where c.owner_id = auth.uid();
  if v_club is null then
    select m.club_id into v_club from public.org_members m
      where m.user_id = auth.uid() and m.revoked_at is null limit 1;
  end if;
  if v_club is null then raise exception 'no club on this account' using errcode='P0002'; end if;
  if not public.club_is_federation(v_club) then
    raise exception 'API access is a Federation (club_enterprise) capability' using errcode='42501';
  end if;

  v_raw := 'fw_' || encode(gen_random_bytes(24), 'hex');
  v_prefix := left(v_raw, 10);

  insert into public.api_keys (club_id, name, key_hash, key_prefix, scope, created_by)
  values (v_club, btrim(p_name), encode(sha256(v_raw::bytea), 'hex'), v_prefix,
          array(select unnest(p_scope) intersect select unnest(array['read','write','admin'])),
          auth.uid());

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), (select role::text from public.profiles where id=auth.uid()),
          'apikey.created', 'api_key', v_club, jsonb_build_object('name', p_name));

  return v_raw;
end;
$$;

-- Resolve an API key to a club. External systems present the raw key; we look
-- up its hash. Touches last_used_at. Returns the club id + scopes.
create or replace function public.resolve_api_key(p_raw_key text)
returns table (club_id uuid, scope text[])
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_hash text;
begin
  v_hash := encode(sha256(p_raw_key::bytea), 'hex');
  return query
    select k.club_id, k.scope
      from public.api_keys k
     where k.key_hash = v_hash and k.revoked_at is null;
  update public.api_keys set last_used_at = now()
   where key_hash = v_hash and revoked_at is null;
end;
$$;

create or replace function public.revoke_api_key(p_key_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and not exists (
       select 1 from public.api_keys k
        where k.id = p_key_id and k.club_id in (select public.my_club_ids())
     ) then
    raise exception 'not permitted' using errcode='42501';
  end if;
  update public.api_keys set revoked_at = now() where id = p_key_id and revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Webhook endpoints (Federation) + delivery log
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_endpoints (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  url        text not null check (url like 'https://%'),
  secret     text,                     -- used to HMAC-sign deliveries
  events     text[] not null default '{}',
  active     boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.webhook_endpoints enable row level security;
drop policy if exists webhook_manage on public.webhook_endpoints;
create policy webhook_manage on public.webhook_endpoints
  for all using (
    public.is_admin()
    or club_id in (select public.my_club_ids())
  ) with check (
    public.is_admin()
    or club_id in (select public.my_club_ids())
  );
revoke all on table public.webhook_endpoints from anon;
grant select, insert, update, delete on table public.webhook_endpoints to authenticated;

create table if not exists public.webhook_deliveries (
  id           bigint generated always as identity primary key,
  endpoint_id  uuid not null references public.webhook_endpoints(id) on delete cascade,
  event        text not null,
  payload      jsonb not null default '{}',
  status       text not null default 'pending'
                 check (status in ('pending','delivered','failed','dead')),
  attempts     int  not null default 0,
  last_error   text,
  response_status int,
  created_at   timestamptz not null default now(),
  next_attempt_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_pending_idx
  on public.webhook_deliveries (next_attempt_at) where status = 'pending';
alter table public.webhook_deliveries enable row level security;
drop policy if exists webhook_deliveries_manage on public.webhook_deliveries;
create policy webhook_deliveries_manage on public.webhook_deliveries
  for all using (
    public.is_admin()
    or endpoint_id in (
      select e.id from public.webhook_endpoints e
      where e.club_id in (select public.my_club_ids())
    )
  ) with check (
    public.is_admin()
    or endpoint_id in (
      select e.id from public.webhook_endpoints e
      where e.club_id in (select public.my_club_ids())
    )
  );
revoke all on table public.webhook_deliveries from anon;
grant select, update on table public.webhook_deliveries to authenticated;

-- Register a webhook endpoint for the caller's club (Federation).
create or replace function public.register_webhook_endpoint(
  p_url text, p_secret text default null, p_events text[] default '{}'
) returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_club uuid; v_id uuid;
begin
  select c.id into v_club from public.clubs c where c.owner_id = auth.uid();
  if v_club is null then
    select m.club_id into v_club from public.org_members m
      where m.user_id = auth.uid() and m.revoked_at is null limit 1;
  end if;
  if v_club is null then raise exception 'no club on this account' using errcode='P0002'; end if;
  if not public.club_is_federation(v_club) then
    raise exception 'webhooks are a Federation capability' using errcode='42501';
  end if;

  insert into public.webhook_endpoints (club_id, url, secret, events, created_by)
  values (v_club, btrim(p_url), nullif(btrim(p_secret),''), p_events, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Queue an event to every active matching endpoint of a club. Called by app
-- code (e.g. from a trigger or the worker) — admin/service path.
create or replace function public.queue_webhook_event(p_club_id uuid, p_event text, p_payload jsonb)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.webhook_deliveries (endpoint_id, event, payload)
  select e.id, p_event, coalesce(p_payload, '{}')
    from public.webhook_endpoints e
   where e.club_id = p_club_id and e.active and (e.events = '{}' or p_event = any (e.events));
end;
$$;

grant execute on function public.create_api_key(text, text[]) to authenticated;
grant execute on function public.resolve_api_key(text) to anon, authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;
grant execute on function public.register_webhook_endpoint(text, text, text[]) to authenticated;
grant execute on function public.queue_webhook_event(uuid, text, jsonb) to authenticated;

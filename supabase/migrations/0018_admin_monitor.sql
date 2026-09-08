-- ============================================================================
-- FutWeb — Admin monitoring for Federation & developer access
-- ----------------------------------------------------------------------------
-- Read-only, admin-only reporting functions that power the Admin →
-- "Federation & API" monitoring page. Each is `security definer` and hard-gates
-- on `public.is_admin()` — a non-admin always gets a 42501. They deliberately
-- return SANITISED rows only (e.g. API-key `key_prefix`, never the full secret
-- or hash), because an admin-facing surface must not leak credentials even to
-- a misbehaving admin session.
--
-- Idempotent: `create or replace function`. No table changes.
-- ============================================================================

-- Federation / multi-academy tree: every child academy and its parent group.
create or replace function public.admin_federation_tree()
returns table (
  parent_id   uuid,
  parent_name text,
  academy_id  uuid,
  academy_name text,
  academy_state text,
  academy_verified boolean,
  player_count bigint,
  linked_at   timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    c.parent_club_id                                     as parent_id,
    coalesce(p.name, 'unknown')                          as parent_name,
    c.id                                                 as academy_id,
    c.name                                               as academy_name,
    c.state_region                                       as academy_state,
    c.entity_verified                                    as academy_verified,
    (select count(*) from public.players pl
      where pl.managed_by_club_id = c.id)::bigint        as player_count,
    c.updated_at                                         as linked_at
  from public.clubs c
  left join public.clubs p on p.id = c.parent_club_id
  where c.parent_club_id is not null
    and public.is_admin()
  order by parent_name, c.name
$$;

-- API keys issued across clubs (sanitised: prefix only, never the secret/hash).
create or replace function public.admin_api_keys_view()
returns table (
  key_id        uuid,
  club_name     text,
  key_name      text,
  key_prefix    text,
  scope         text[],
  created_by    text,
  created_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    k.id,
    coalesce(cl.name, 'unknown')                    as club_name,
    k.name                                          as key_name,
    k.key_prefix,
    k.scope,
    coalesce(pr.full_name, pr.email, 'unknown')     as created_by,
    k.created_at,
    k.last_used_at,
    k.revoked_at
  from public.api_keys k
  left join public.clubs cl   on cl.id = k.club_id
  left join public.profiles pr on pr.id = k.created_by
  where public.is_admin()
  order by k.created_at desc
$$;

-- Webhook delivery health: recent attempts with their owning club + endpoint.
create or replace function public.admin_webhook_health(p_limit int default 40)
returns table (
  club_name   text,
  endpoint_url text,
  event       text,
  status      text,
  attempts    int,
  last_error  text,
  response_status int,
  created_at  timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(cl.name, 'unknown')      as club_name,
    we.url                            as endpoint_url,
    wd.event,
    wd.status,
    wd.attempts,
    wd.last_error,
    wd.response_status,
    wd.created_at
  from public.webhook_deliveries wd
  left join public.webhook_endpoints we on we.id = wd.endpoint_id
  left join public.clubs cl             on cl.id = we.club_id
  where public.is_admin()
  order by wd.created_at desc
  limit greatest(1, least(p_limit, 500))
$$;

-- Summary counters for stat tiles (whole-platform, admin).
create or replace function public.admin_platform_monitor()
returns table (
  clubs_total       bigint,
  clubs_federation  bigint,
  api_keys_active   bigint,
  webhook_endpoints bigint,
  deliveries_pending bigint,
  deliveries_failed bigint,
  deliveries_dead   bigint,
  enterprise_new    bigint
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.clubs)                                              as clubs_total,
    (select count(*) from public.clubs c join public.profiles o on o.id = c.owner_id
       where o.sub_status in ('active','grace','trialing')
         and (o.sub_status = 'trialing' or o.plan_code = 'club_enterprise'))         as clubs_federation,
    (select count(*) from public.api_keys k where k.revoked_at is null)              as api_keys_active,
    (select count(*) from public.webhook_endpoints we where we.active)               as webhook_endpoints,
    (select count(*) from public.webhook_deliveries wd where wd.status = 'pending')  as deliveries_pending,
    (select count(*) from public.webhook_deliveries wd where wd.status = 'failed')   as deliveries_failed,
    (select count(*) from public.webhook_deliveries wd where wd.status = 'dead')     as deliveries_dead,
    (select count(*) from public.enterprise_requests er where er.status = 'new')     as enterprise_new
  where public.is_admin()
$$;

-- ---------------------------------------------------------------------------
-- At-risk clubs: an owner's subscription has lapsed (no longer active/trial/
-- grace) yet the club still holds premium artefacts that SHOULD have been
-- withdrawn — open verified trials, live academy links, active API keys or
-- active webhook endpoints. Surfaces the downgrade/lapse withdrawal risk the
-- platform otherwise can't see until the UI re-gates. Read-only, admin-only.
-- ---------------------------------------------------------------------------
create or replace function public.admin_at_risk_clubs()
returns table (
  club_id            uuid,
  club_name          text,
  owner_sub_status   text,
  open_verified_trials bigint,
  academy_links      bigint,
  active_api_keys    bigint,
  active_webhooks    bigint
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.name,
    o.sub_status                                    as owner_sub_status,
    (select count(*) from public.trial_postings t
      where t.club_id = c.id and t.status = 'open' and t.verified)::bigint
                                                    as open_verified_trials,
    (select count(*) from public.clubs cc
      where cc.parent_club_id = c.id)::bigint       as academy_links,
    (select count(*) from public.api_keys k
      where k.club_id = c.id and k.revoked_at is null)::bigint
                                                    as active_api_keys,
    (select count(*) from public.webhook_endpoints we
      where we.club_id = c.id and we.active)::bigint as active_webhooks
  from public.clubs c
  join public.profiles o on o.id = c.owner_id
  where public.is_admin()
    and o.sub_status not in ('active','trialing','grace')
    and (
      exists (select 1 from public.trial_postings t
               where t.club_id = c.id and t.status = 'open' and t.verified)
      or exists (select 1 from public.clubs cc where cc.parent_club_id = c.id)
      or exists (select 1 from public.api_keys k
                  where k.club_id = c.id and k.revoked_at is null)
      or exists (select 1 from public.webhook_endpoints we
                  where we.club_id = c.id and we.active)
    )
  order by o.sub_status, c.name
$$;

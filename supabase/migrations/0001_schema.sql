-- ============================================================================
-- FutWeb — Core schema
-- Postgres 15 (Supabase)
--
-- Design principles:
--   1. Tenancy is explicit. A club row owns its players/staff/reports, and
--      every tenant-scoped table carries the owner id so RLS can be a simple,
--      auditable equality check rather than a join maze.
--   2. Money and trust events are append-only. Subscriptions mutate, but
--      payments and audit rows never do.
--   3. Minors are structurally protected, not merely discouraged.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enums ----
create type user_role        as enum ('player','club_admin','club_staff','scout','admin');
create type account_type     as enum ('player','club');
create type verification_tier   as enum ('unverified','identity','entity','gold');
create type verification_status as enum ('none','pending','in_review','verified','rejected','expired');
create type sub_status       as enum ('trialing','active','past_due','grace','cancelled','expired','paused');
create type plan_interval    as enum ('monthly','annual');
create type availability     as enum ('available','trial_only','under_contract','not_looking');
create type visibility_scope as enum ('public','verified_only','private');
create type media_kind       as enum ('highlight','full_match','photo','document');
create type trial_status     as enum ('draft','pending_verification','open','closed','cancelled');
create type recommendation   as enum ('sign','trial','monitor','pass');
create type dispute_status   as enum ('open','in_review','escalated','upheld','dismissed','resolved');
create type severity_level   as enum ('low','medium','high','critical');

-- ------------------------------------------------------------- profiles ----
-- Mirrors auth.users. Never store secrets here.
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role     not null default 'player',
  account_type    account_type  not null default 'player',
  full_name       text          not null check (char_length(full_name) between 2 and 120),
  email           citext        not null,
  phone           text,
  avatar_url      text,
  country         text          not null default 'Nigeria',
  locale          text          not null default 'en-NG',
  email_verified  boolean       not null default false,
  phone_verified  boolean       not null default false,

  -- Trust layer
  verification_tier    verification_tier   not null default 'unverified',
  verification_status  verification_status not null default 'none',
  trust_score          smallint  not null default 0 check (trust_score between 0 and 100),
  identity_verified_at timestamptz,
  liveness_verified_at timestamptz,
  disputes_upheld      integer   not null default 0,

  -- Billing
  sub_status    sub_status not null default 'trialing',
  plan_code     text,
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,

  -- Minors: an account holder under 18 may not act alone.
  is_minor          boolean generated always as (false) stored, -- players table is authoritative
  guardian_required boolean not null default false,

  onboarding_complete boolean not null default false,
  last_seen_at  timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (email);
create index profiles_role_idx  on public.profiles (role);
create index profiles_sub_idx   on public.profiles (sub_status);

-- ---------------------------------------------------------------- clubs ----
create table public.clubs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  slug         citext not null unique,
  name         text   not null check (char_length(name) between 2 and 160),
  short_name   text   check (char_length(short_name) between 2 and 8),
  country      text   not null default 'Nigeria',
  state_region text,
  city         text,
  league_code  text,
  stadium      text,
  founded_year smallint check (founded_year between 1800 and date_part('year', now())::int),
  logo_url     text,
  website      text,

  -- Entity verification (Nigeria: CAC + NFF/state FA)
  cac_number      text,
  nff_affiliation text,
  entity_verified boolean not null default false,
  entity_verified_at timestamptz,

  -- Seats consumed, enforced against the plan
  player_seats_used integer not null default 0,
  staff_seats_used  integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clubs_owner_idx on public.clubs (owner_id);
create index clubs_league_idx on public.clubs (league_code);

-- ------------------------------------------------------- club membership ---
-- Staff belong to a club with a scoped role. This is the RBAC join table.
create table public.org_members (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       user_role not null default 'scout',
  invited_by uuid references public.profiles(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  unique (club_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id) where revoked_at is null;

-- --------------------------------------------------------------- players ---
create table public.players (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  -- A club may manage a player who has not yet claimed their own account.
  managed_by_club_id uuid references public.clubs(id) on delete set null,
  slug       citext not null unique,

  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name  text not null check (char_length(last_name)  between 1 and 80),
  dob        date not null,
  nationality text not null default 'Nigeria',
  state_of_origin text,

  position_primary   text not null,
  position_secondary text[] not null default '{}',
  foot        text not null default 'right' check (foot in ('left','right','both')),
  height_cm   smallint check (height_cm  between 120 and 230),
  weight_kg   smallint check (weight_kg  between 35  and 160),
  bio         text check (char_length(bio) <= 600),

  availability availability     not null default 'available',
  visibility   visibility_scope not null default 'verified_only',
  contract_expiry date,

  -- Headline computed values, denormalised for fast discovery.
  futweb_score  smallint check (futweb_score between 0 and 99),
  potential     smallint check (potential     between 0 and 99),
  confidence    smallint check (confidence    between 0 and 100),

  -- ---------------- Minors protection ----------------
  -- FIFA Art.19 + NDPA 2023. A minor profile without guardian consent
  -- cannot be made visible to clubs; enforced by RLS and by check constraint.
  is_minor           boolean generated always as ((dob > (now() - interval '18 years')::date)) stored,
  guardian_name      text,
  guardian_phone     text,
  guardian_email     citext,
  guardian_consent_at timestamptz,
  constraint minor_requires_guardian
    check (not (dob > (now() - interval '18 years')::date)
           or (guardian_name is not null and guardian_consent_at is not null)),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_club_idx      on public.players (managed_by_club_id);
create index players_pos_idx       on public.players (position_primary);
create index players_score_idx     on public.players (futweb_score desc);
create index players_visibility_idx on public.players (visibility);
-- Partial index for the discovery hot path.
create index players_discoverable_idx on public.players (futweb_score desc, position_primary)
  where visibility = 'public';

-- ------------------------------------------------------------ attributes ---
-- 32 attributes, 0–99. Stored as a wide table for cheap comparison queries;
-- the alternative (jsonb) makes indexed range scans awkward.
create table public.player_attributes (
  player_id uuid primary key references public.players(id) on delete cascade,

  -- Technical
  finishing smallint, passing smallint, dribbling smallint, first_touch smallint,
  crossing smallint, technique smallint, heading smallint,
  -- Physical
  acceleration smallint, sprint_speed smallint, agility smallint, stamina smallint,
  strength smallint, jumping smallint, balance smallint,
  -- Mental
  vision smallint, positioning smallint, decision_making smallint, work_rate smallint,
  composure smallint, aggression smallint, leadership smallint,
  -- Defending
  marking smallint, tackling smallint, interceptions smallint, aerial_duels smallint,
  -- Goalkeeping
  reflexes smallint, handling smallint, gk_distribution smallint, shot_stopping smallint,

  updated_at timestamptz not null default now(),

  constraint attrs_in_range check (
    finishing between 0 and 99 and passing between 0 and 99 and dribbling between 0 and 99
    and acceleration between 0 and 99 and sprint_speed between 0 and 99
    and reflexes between 0 and 99 and shot_stopping between 0 and 99
  )
);

-- Every rating is a historical fact. We never overwrite; we append.
create table public.rating_snapshots (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  rated_by     uuid not null references public.profiles(id) on delete cascade,
  rated_by_role text not null check (rated_by_role in ('self','coach','scout','analyst','academy')),
  context      text check (context in ('training','match','tournament','combine')),
  attributes   jsonb not null,
  futweb_score smallint not null check (futweb_score between 0 and 99),
  position_fit jsonb not null default '{}',
  confidence   smallint not null default 0,
  offline_captured boolean not null default false,
  created_at   timestamptz not null default now()
);
create index rating_snap_player_idx on public.rating_snapshots (player_id, created_at desc);

-- -------------------------------------------------------------- match data --
create table public.match_stats (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season    text not null,
  competition text,
  appearances integer not null default 0,
  minutes     integer not null default 0,
  goals integer not null default 0, assists integer not null default 0,
  shots integer not null default 0, shots_on_target integer not null default 0,
  pass_attempts integer not null default 0, passes_completed integer not null default 0,
  duels integer not null default 0, duels_won integer not null default 0,
  tackles integer not null default 0, interceptions integer not null default 0,
  fouls_committed integer not null default 0,
  yellow_cards integer not null default 0, red_cards integer not null default 0,
  clean_sheets integer not null default 0, goals_conceded integer not null default 0, saves integer not null default 0,
  -- Provenance: is this federation-confirmed or self-reported?
  verified boolean not null default false,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (player_id, season)
);

-- ------------------------------------------------------------------ media --
create table public.media_assets (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  kind       media_kind not null,
  storage_path text not null,
  title      text not null,
  duration_s integer,
  size_bytes bigint,
  -- Provenance defeats stolen / mislabelled footage.
  recorded_at timestamptz,
  recorded_location text,
  verified   boolean not null default false,
  uploaded_at timestamptz not null default now()
);
create index media_player_idx on public.media_assets (player_id, uploaded_at desc);

create table public.career_entries (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  club_name text not null,
  season    text not null,
  competition text,
  appearances integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  verified boolean not null default false,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index career_player_idx on public.career_entries (player_id);

-- --------------------------------------------------------------- billing ----
create table public.plans (
  code         text primary key,
  name         text not null,
  audience     text not null check (audience in ('player','club','both')),
  price_ngn    integer not null check (price_ngn >= 0),   -- kobo-free minor units? Naira, integer
  price_usd    integer not null check (price_usd >= 0),
  interval     plan_interval not null default 'monthly',
  player_seats integer not null default 1,  -- -1 = unlimited
  staff_seats  integer not null default 0,
  trial_days   integer not null default 0,
  features     jsonb not null default '[]',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  subscriber   uuid not null unique references public.profiles(id) on delete cascade,
  plan_code    text not null references public.plans(code),
  status       sub_status not null default 'trialing',
  interval     plan_interval not null default 'monthly',
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null default (now() + interval '30 days'),
  trial_ends_at  timestamptz,
  grace_ends_at  timestamptz,
  cancel_at_period_end boolean not null default false,
  flw_subscription_id text,
  seats_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subs_status_idx on public.subscriptions (status);

-- Append-only ledger. A payment row is never updated except to record a
-- terminal state transition, which the trigger enforces.
create table public.payments (
  id        uuid primary key default gen_random_uuid(),
  tx_ref    text not null unique,          -- our idempotency key
  flw_id    text unique,
  subscriber uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null references public.plans(code),
  amount    integer not null check (amount > 0),
  currency  text not null default 'NGN',
  status    text not null default 'pending'
              check (status in ('pending','successful','failed','refunded','cancelled')),
  channel   text,
  raw       jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index payments_subscriber_idx on public.payments (subscriber, created_at desc);

-- ----------------------------------------------------------- recruitment ----
create table public.trial_postings (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubs(id) on delete cascade,
  title     text not null,
  description text not null,
  positions text[] not null default '{}',
  age_min smallint not null default 16 check (age_min >= 14),
  age_max smallint not null default 25 check (age_max <= 45),
  location text not null,
  trial_date date not null,
  -- HARD RULE: players may never be charged. Enforced at the database level so
  -- no client, bug or compromised token can create a fee-bearing trial.
  fee_charged_to_player integer not null default 0
    check (fee_charged_to_player = 0),
  verified boolean not null default false,
  verified_by uuid references public.profiles(id),
  status trial_status not null default 'pending_verification',
  created_at timestamptz not null default now(),
  constraint trial_age_order check (age_max >= age_min)
);
create index trials_club_idx   on public.trial_postings (club_id);
create index trials_status_idx on public.trial_postings (status, trial_date);

create table public.trial_applications (
  id        uuid primary key default gen_random_uuid(),
  trial_id  uuid not null references public.trial_postings(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  message   text,
  status    text not null default 'applied'
              check (status in ('applied','shortlisted','invited','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  unique (trial_id, player_id)
);
create index trial_apps_player_idx on public.trial_applications (player_id);

create table public.shortlists (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  stage     text not null default 'watching'
              check (stage in ('watching','shortlisted','trial_invited','signed','rejected')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, player_id)
);
create index shortlists_club_stage_idx on public.shortlists (club_id, stage);

create table public.scout_reports (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  club_id   uuid references public.clubs(id) on delete cascade,
  recommendation recommendation not null,
  rating smallint not null check (rating between 1 and 5),
  text   text not null check (char_length(text) between 1 and 4000),
  offline_captured boolean not null default false,
  created_at timestamptz not null default now()
);
create index reports_player_idx on public.scout_reports (player_id, created_at desc);

-- ----------------------------------------------------------- trust layer ----
create table public.verification_requests (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.profiles(id) on delete cascade,
  club_id     uuid references public.clubs(id) on delete cascade,
  kind        text not null check (kind in ('identity','entity','liveness','references')),
  status      verification_status not null default 'pending',
  reviewer_id uuid references public.profiles(id),
  reviewer_note text,
  submitted_at timestamptz not null default now(),
  decided_at   timestamptz
);
create index verification_status_idx on public.verification_requests (status, submitted_at);

create table public.verification_documents (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests(id) on delete cascade,
  kind       text not null,
  storage_path text not null,
  uploaded_at  timestamptz not null default now(),
  -- Deleted automatically once a decision is made (NDPA data minimisation).
  purge_after  timestamptz not null default (now() + interval '90 days')
);

create table public.disputes (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  accused_id  uuid references public.profiles(id) on delete set null,
  accused_club_id uuid references public.clubs(id) on delete set null,
  kind        text not null check (kind in ('fee','impersonation','phantom','minor','documents','other')),
  severity    severity_level not null default 'medium',
  summary     text not null check (char_length(summary) between 10 and 4000),
  status      dispute_status not null default 'open',
  handler_id  uuid references public.profiles(id),
  resolution  text,
  escalated_to_nff boolean not null default false,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index disputes_status_idx on public.disputes (status, severity desc, created_at desc);

-- Immutable audit trail. See 0003 for the trigger that makes it append-only.
create table public.audit_log (
  id         bigserial primary key,
  actor_id   uuid,
  actor_role text,
  action     text not null,
  entity_type text not null,
  entity_id  uuid,
  metadata   jsonb not null default '{}',
  ip         inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_log (created_at desc);
create index audit_entity_idx  on public.audit_log (entity_type, entity_id);
create index audit_actor_idx   on public.audit_log (actor_id, created_at desc);

-- ------------------------------------------------------------ compliance ----
-- NDPA 2023: consent must be recorded with what, when and which version.
create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  version    text not null,
  granted    boolean not null,
  ip         inet,
  created_at timestamptz not null default now()
);

create table public.data_subject_requests (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('export','erasure','rectification')),
  status     text not null default 'received'
               check (status in ('received','in_progress','completed','rejected')),
  handler_id uuid references public.profiles(id),
  due_at     timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.notifications (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null,
  title   text not null,
  body    text,
  link    text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notif_user_idx on public.notifications (user_id, created_at desc) where read_at is null;

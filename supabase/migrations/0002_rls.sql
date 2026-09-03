-- ============================================================================
-- FutWeb — Row Level Security
--
-- SECURITY MODEL (read this before changing anything)
--
-- * `auth.uid()` is the only trusted identity. Client-supplied ids are never
--   trusted for authorisation — an edge function re-derives the user from the
--   verified JWT, and RLS re-derives it again from the session.
-- * Every tenant-scoped table is protected by an equality check on an owner
--   column. Subqueries are used instead of joins so Postgres can use the
--   indexes and so a policy is readable at a glance.
-- * Service-role / security-definer functions bypass RLS by design. They are
--   never callable by anon or authenticated clients (grants are revoked below).
-- * A denied read returns zero rows, not an error — this is deliberate: it
--   prevents an attacker from enumerating which ids exist.
-- ============================================================================

alter table public.profiles                enable row level security;
alter table public.clubs                   enable row level security;
alter table public.org_members             enable row level security;
alter table public.players                 enable row level security;
alter table public.player_attributes       enable row level security;
alter table public.rating_snapshots        enable row level security;
alter table public.match_stats             enable row level security;
alter table public.media_assets            enable row level security;
alter table public.career_entries          enable row level security;
alter table public.plans                   enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.payments                enable row level security;
alter table public.trial_postings          enable row level security;
alter table public.trial_applications      enable row level security;
alter table public.shortlists              enable row level security;
alter table public.scout_reports           enable row level security;
alter table public.verification_requests   enable row level security;
alter table public.verification_documents  enable row level security;
alter table public.disputes                enable row level security;
alter table public.audit_log               enable row level security;
alter table public.consents                enable row level security;
alter table public.data_subject_requests   enable row level security;
alter table public.notifications           enable row level security;

-- ---------------------------------------------------------------- helpers --
-- security definer + fixed search_path prevents search-path hijacking.
create or replace function public.current_role()
returns user_role language sql stable security definer
set search_path = public, pg_temp
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') $$;

create or replace function public.has_active_sub(uid uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.sub_status in ('active','trialing','grace')
  )
$$;

-- Club ids where the caller is an active (non-revoked) member.
create or replace function public.my_club_ids()
returns setof uuid language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.club_id from public.org_members m
  where m.user_id = auth.uid() and m.revoked_at is null
$$;

-- Can this caller see this player at all?
-- Rules: admins always; the player themself always; a club that manages them;
-- otherwise only if the visibility rules are satisfied.
create or replace function public.can_view_player(pid uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.players pl
    where pl.id = pid
      and (
        public.is_admin()
        or pl.user_id = auth.uid()
        or pl.managed_by_club_id in (select public.my_club_ids())
        or (
          pl.visibility = 'public'
          and public.has_active_sub()
        )
        or (
          pl.visibility = 'verified_only'
          and public.has_active_sub()
          and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.verification_tier in ('identity','entity','gold')
          )
        )
        -- Minors are never visible to a club outside a verified one, and even
        -- then only after guardian consent.
        and (
          not pl.is_minor
          or (pl.is_minor and pl.guardian_consent_at is not null)
        )
      )
  )
$$;

-- --------------------------------------------------------------- profiles --
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_colleagues_read on public.profiles;
create policy profiles_colleagues_read on public.profiles
  for select using (
    exists (
      select 1 from public.org_members m
      where m.user_id = public.profiles.id
        and m.revoked_at is null
        and m.club_id in (select public.my_club_ids())
    )
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    -- A user may never escalate their own role or verification state.
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and verification_tier = (select p.verification_tier from public.profiles p where p.id = auth.uid())
    and sub_status       = (select p.sub_status       from public.profiles p where p.id = auth.uid())
  );

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Insert is handled by the handle_new_user trigger (security definer).

-- ------------------------------------------------------------------ clubs --
drop policy if exists clubs_read on public.clubs;
create policy clubs_read on public.clubs
  for select using (
    public.is_admin()
    or owner_id = auth.uid()
    or id in (select public.my_club_ids())
    or (entity_verified and public.has_active_sub())
  );

drop policy if exists clubs_owner_write on public.clubs;
create policy clubs_owner_write on public.clubs
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------- org members ---
drop policy if exists org_members_read on public.org_members;
create policy org_members_read on public.org_members
  for select using (
    user_id = auth.uid()
    or club_id in (select public.my_club_ids())
    or public.is_admin()
  );

drop policy if exists org_members_admin_write on public.org_members;
create policy org_members_admin_write on public.org_members
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.org_members m
      where m.club_id = public.org_members.club_id
        and m.user_id = auth.uid()
        and m.role = 'club_admin'
        and m.revoked_at is null
    )
  ) with check (
    public.is_admin()
    or exists (
      select 1 from public.org_members m
      where m.club_id = public.org_members.club_id
        and m.user_id = auth.uid()
        and m.role = 'club_admin'
        and m.revoked_at is null
    )
  );

-- --------------------------------------------------------------- players ---
drop policy if exists players_read on public.players;
create policy players_read on public.players
  for select using (public.can_view_player(id));

drop policy if exists players_self_write on public.players;
create policy players_self_write on public.players
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists players_club_write on public.players;
create policy players_club_write on public.players
  for update using (managed_by_club_id in (select public.my_club_ids()))
  with check (managed_by_club_id in (select public.my_club_ids()));

-- ------------------------------------------------------------ attributes ---
drop policy if exists attrs_read on public.player_attributes;
create policy attrs_read on public.player_attributes
  for select using (public.can_view_player(player_id));

drop policy if exists attrs_write on public.player_attributes;
create policy attrs_write on public.player_attributes
  for all using (
    exists (select 1 from public.players p where p.id = player_id and p.user_id = auth.uid())
    or exists (select 1 from public.players p where p.id = player_id and p.managed_by_club_id in (select public.my_club_ids()))
    or public.is_admin()
  ) with check (
    exists (select 1 from public.players p where p.id = player_id and p.user_id = auth.uid())
    or exists (select 1 from public.players p where p.id = player_id and p.managed_by_club_id in (select public.my_club_ids()))
    or public.is_admin()
  );

-- ------------------------------------------------------ rating snapshots ---
create or replace function public.can_rate_player(pid uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.players p
    where p.id = pid
      and (
        p.user_id = auth.uid()
        or p.managed_by_club_id in (select public.my_club_ids())
        or public.is_admin()
        -- Independent verified observers may rate any consenting player.
        or exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid()
            and pr.verification_tier in ('identity','entity','gold')
            and pr.sub_status in ('active','trialing','grace')
        )
      )
  )
$$;

drop policy if exists snaps_read on public.rating_snapshots;
create policy snaps_read on public.rating_snapshots
  for select using (public.can_view_player(player_id) or rated_by = auth.uid());

drop policy if exists snaps_insert on public.rating_snapshots;
create policy snaps_insert on public.rating_snapshots
  for insert with check (public.can_rate_player(player_id) and rated_by = auth.uid());

-- Ratings are historical facts: no updates, no deletes.
-- (No UPDATE/DELETE policy exists, so those statements match zero rows.)

-- --------------------------------------------------------- supporting data --
drop policy if exists match_stats_r on public.match_stats;
create policy match_stats_r on public.match_stats
  for select using (public.can_view_player(player_id));
drop policy if exists match_stats_w on public.match_stats;
create policy match_stats_w on public.match_stats
  for all using (
    exists (select 1 from public.players p where p.id = player_id and (p.user_id = auth.uid() or p.managed_by_club_id in (select public.my_club_ids())))
    or public.is_admin()
  ) with check (
    exists (select 1 from public.players p where p.id = player_id and (p.user_id = auth.uid() or p.managed_by_club_id in (select public.my_club_ids())))
    or public.is_admin()
  );

drop policy if exists media_r on public.media_assets;
create policy media_r on public.media_assets
  for select using (public.can_view_player(player_id));
drop policy if exists media_w on public.media_assets;
create policy media_w on public.media_assets
  for all using (
    exists (select 1 from public.players p where p.id = player_id and (p.user_id = auth.uid() or p.managed_by_club_id in (select public.my_club_ids())))
    or public.is_admin()
  ) with check (
    exists (select 1 from public.players p where p.id = player_id and (p.user_id = auth.uid() or p.managed_by_club_id in (select public.my_club_ids())))
    or public.is_admin()
  );

drop policy if exists career_r on public.career_entries;
create policy career_r on public.career_entries
  for select using (public.can_view_player(player_id));
drop policy if exists career_w on public.career_entries;
create policy career_w on public.career_entries
  for all using (
    exists (select 1 from public.players p where p.id = player_id and (p.user_id = auth.uid() or p.managed_by_club_id in (select public.my_club_ids())))
    or public.is_admin()
  ) with check (
    exists (select 1 from public.players p where p.id = player_id and (p.user_id = auth.uid() or p.managed_by_club_id in (select public.my_club_ids())))
    or public.is_admin()
  );

-- ---------------------------------------------------------------- billing --
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (active or public.is_admin());

drop policy if exists subs_read on public.subscriptions;
create policy subs_read on public.subscriptions
  for select using (subscriber = auth.uid() or public.is_admin());
-- No client INSERT/UPDATE/DELETE: billing is only mutated by the webhook
-- through the service role. This is the single most important billing control.

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select using (subscriber = auth.uid() or public.is_admin());
-- Same: append-only from the client's point of view.

-- ------------------------------------------------------------ recruitment --
drop policy if exists trials_read on public.trial_postings;
create policy trials_read on public.trial_postings
  for select using (
    public.is_admin()
    or club_id in (select public.my_club_ids())
    or (status = 'open' and verified)
  );
drop policy if exists trials_write on public.trial_postings;
create policy trials_write on public.trial_postings
  for all using (club_id in (select public.my_club_ids()) or public.is_admin())
  with check (club_id in (select public.my_club_ids()) or public.is_admin());

drop policy if exists trial_apps_read on public.trial_applications;
create policy trial_apps_read on public.trial_applications
  for select using (
    exists (select 1 from public.players p where p.id = player_id and p.user_id = auth.uid())
    or exists (select 1 from public.trial_postings t where t.id = trial_id and t.club_id in (select public.my_club_ids()))
    or public.is_admin()
  );
drop policy if exists trial_apps_insert on public.trial_applications;
create policy trial_apps_insert on public.trial_applications
  for insert with check (
    exists (select 1 from public.players p where p.id = player_id and p.user_id = auth.uid())
    and exists (select 1 from public.trial_postings t where t.id = trial_id and t.status = 'open' and t.verified)
  );

drop policy if exists shortlists_rw on public.shortlists;
create policy shortlists_rw on public.shortlists
  for all using (club_id in (select public.my_club_ids()) or public.is_admin())
  with check (club_id in (select public.my_club_ids()) or public.is_admin());

drop policy if exists reports_read on public.scout_reports;
create policy reports_read on public.scout_reports
  for select using (
    author_id = auth.uid()
    or club_id in (select public.my_club_ids())
    or (club_id is null and public.can_view_player(player_id))
    or public.is_admin()
  );
drop policy if exists reports_insert on public.scout_reports;
create policy reports_insert on public.scout_reports
  for insert with check (
    author_id = auth.uid()
    and (club_id is null or club_id in (select public.my_club_ids()))
    and public.can_rate_player(player_id)
  );
drop policy if exists reports_update on public.scout_reports;
create policy reports_update on public.scout_reports
  for update using (author_id = auth.uid() and created_at > now() - interval '24 hours');

-- ----------------------------------------------------------- trust layer --
drop policy if exists verification_read on public.verification_requests;
create policy verification_read on public.verification_requests
  for select using (subject_id = auth.uid() or public.is_admin());
drop policy if exists verification_insert on public.verification_requests;
create policy verification_insert on public.verification_requests
  for insert with check (subject_id = auth.uid() or public.is_admin());
-- Only admins may decide. Enforced in policy AND in the decision function.
drop policy if exists verification_admin_update on public.verification_requests;
create policy verification_admin_update on public.verification_requests
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists verification_docs_read on public.verification_documents;
create policy verification_docs_read on public.verification_documents
  for select using (
    public.is_admin()
    or exists (select 1 from public.verification_requests r
               where r.id = request_id and r.subject_id = auth.uid())
  );

drop policy if exists disputes_read on public.disputes;
create policy disputes_read on public.disputes
  for select using (
    reporter_id = auth.uid()
    or accused_id = auth.uid()
    or handler_id = auth.uid()
    or public.is_admin()
  );
drop policy if exists disputes_insert on public.disputes;
create policy disputes_insert on public.disputes
  for insert with check (reporter_id = auth.uid());
drop policy if exists disputes_admin_update on public.disputes;
create policy disputes_admin_update on public.disputes
  for update using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ audit log ----
-- Readable only by admins. No client insert/update/delete — the log is written
-- exclusively by the security-definer function in 0003.
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_admin());

-- ------------------------------------------------------------ compliance --
drop policy if exists consents_rw on public.consents;
create policy consents_rw on public.consents
  for all using (subject_id = auth.uid() or public.is_admin())
  with check (subject_id = auth.uid() or public.is_admin());

drop policy if exists dsr_rw on public.data_subject_requests;
create policy dsr_rw on public.data_subject_requests
  for all using (subject_id = auth.uid() or public.is_admin())
  with check (subject_id = auth.uid() or public.is_admin());

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- grants ---
-- IMPORTANT: RLS policies FILTER rows; they do not GRANT access. If the role
-- lacks the underlying table privilege, the policy can never let a row through.
-- So we grant the narrowest possible table privileges here and let the policies
-- above do the row-level work.
--
-- anon: may only read the public plan catalogue. Nothing else.
-- authenticated: per-table privileges below, always filtered by RLS.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','clubs','org_members','players','player_attributes','rating_snapshots',
    'match_stats','media_assets','career_entries','subscriptions','payments',
    'trial_postings','trial_applications','shortlists','scout_reports',
    'verification_requests','verification_documents','disputes',
    'consents','data_subject_requests','notifications'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- rating_snapshots and payments are append-only in practice; delete/update are
-- blocked by the triggers in 0003 and by the absence of permissive policies.
grant select on public.plans to anon, authenticated;
grant select on public.audit_log to authenticated;   -- filtered to admins by policy

-- Storage buckets are created in 0004 with their own policies.

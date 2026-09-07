-- ============================================================================
-- FutWeb — reconcile players.futweb_score / confidence from rating snapshots
-- ============================================================================
-- Why:
--   players.futweb_score (the canonical column that the player dashboard, the
--   admin player list and all discovery/ordering queries read) was left NULL.
--   Each rating snapshot already carries a confidence-adjusted score, so we
--   backfill every player from their most recent snapshot.
--
-- How to run (NOT a numbered migration — run manually once, idempotent):
--   Supabase Dashboard > SQL Editor > New query > paste > Run
--   (or: psql "$DATABASE_URL" -f supabase/sql/reconcile_futweb_score.sql)
--
-- This is safe to re-run at any time; it only overwrites the two score
-- columns from the latest snapshot and never touches anything else.
-- ============================================================================

begin;

-- 1) Backfill current rows from each player's most recent rating snapshot.
update public.players p
   set futweb_score = s.futweb_score,
       confidence    = s.confidence
  from (
    select distinct on (player_id)
           player_id, futweb_score, confidence
      from public.rating_snapshots
     where futweb_score is not null
     order by player_id, created_at desc
  ) s
 where s.player_id = p.id
   and (p.futweb_score is distinct from s.futweb_score
        or p.confidence  is distinct from s.confidence);

-- 2) (Recommended, optional) Keep it in sync going forward so future inserts
--    into rating_snapshots automatically update the player's canonical score.
--    Uncomment if you want the DB to be the single source of truth. Requires
--    the players / rating_snapshots tables to exist with these columns.

-- create or replace function public.sync_player_score_from_snapshot()
-- returns trigger language plpgsql security definer set search_path = public as $$
-- begin
--   update public.players
--      set futweb_score = coalesce(new.futweb_score, futweb_score),
--          confidence    = coalesce(new.confidence, confidence)
--    where id = new.player_id;
--   return new;
-- end;
-- $$;
--
-- drop trigger if exists trg_sync_player_score_from_snapshot
--   on public.rating_snapshots;
-- create trigger trg_sync_player_score_from_snapshot
--   after insert or update of futweb_score, confidence
--   on public.rating_snapshots
--   for each row execute function public.sync_player_score_from_snapshot();

commit;

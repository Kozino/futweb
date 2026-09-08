-- ============================================================================
-- FutWeb — Wire the public "Report a suspicious approach" page into disputes
-- ----------------------------------------------------------------------------
-- The landing / Trust-page report form was previously cosmetic (it showed a
-- fake confirmation and wrote nothing). Disputes RLS already requires
-- reporter_id = auth.uid(), so reports are necessarily filed by an
-- authenticated account (in practice a player who was approached).
--
-- This migration adds a metadata jsonb column so the report's structured
-- details (who approached, contact channel, amount demanded) survive alongside
-- the prose summary, and are surfaced in the Admin → Disputes review modal.
-- Idempotent.
-- ============================================================================
alter table public.disputes
  add column if not exists metadata jsonb not null default '{}'::jsonb;

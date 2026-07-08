-- ============================================================================
-- Migration: Fix broken v_farm_summary refresh trigger
-- framedInsight — 20260708_fix_farm_summary_refresh_trigger.sql
--
-- ROOT CAUSE:
-- 20260612_materialize_farm_summary.sql added AFTER-statement triggers on
-- farms, cows, milk_records, coffee_plots, small_ruminants, poultry_batches
-- and poultry_egg_records that call REFRESH MATERIALIZED VIEW CONCURRENTLY
-- inside the trigger function.
--
-- Postgres does not allow REFRESH MATERIALIZED VIEW CONCURRENTLY to run
-- inside a transaction block. An AFTER trigger always fires inside the same
-- transaction as the statement that triggered it, so this was guaranteed to
-- raise:
--   ERROR: REFRESH MATERIALIZED VIEW CONCURRENTLY cannot run inside a
--   transaction block
-- ...which rolled back the *entire* triggering statement, not just the
-- refresh. Every INSERT/UPDATE/DELETE against any of the 7 tables above has
-- been failing since 20260612. This was masked on some endpoints (e.g.
-- PATCH /api/farms) because a broken CSRF check was already rejecting those
-- requests with a 403 before they reached Postgres; removing the CSRF check
-- in 9b121f7 exposed this trigger bug as the new failure point (surfacing
-- as "Failed to update farm" / "Failed to update" from the generic catch
-- blocks in each route).
--
-- FIX:
-- Drop the synchronous AFTER-statement triggers entirely and replace them
-- with a pg_cron job that refreshes the view on a short interval instead.
-- This keeps the non-blocking-reads goal from the original migration (no
-- ACCESS EXCLUSIVE lock on every write) while making the refresh run in its
-- own background transaction, where CONCURRENTLY is actually legal.
--
-- Trade-off: dashboard summary data can be up to ~1 minute stale instead of
-- being refreshed synchronously on every write. That's the right trade for
-- an aggregate dashboard view and was already flagged as the "ideal
-- long-term fix" in the original migration's own comments.
-- ============================================================================

-- ── 1. Remove the triggers that were breaking every write ──────────────────
DROP TRIGGER IF EXISTS trigger_refresh_farm_summary_farms ON farms;
DROP TRIGGER IF EXISTS trigger_refresh_farm_summary_cows ON cows;
DROP TRIGGER IF EXISTS trigger_refresh_farm_summary_milk ON milk_records;
DROP TRIGGER IF EXISTS trigger_refresh_farm_summary_coffee ON coffee_plots;
DROP TRIGGER IF EXISTS trigger_refresh_farm_summary_ruminants ON small_ruminants;
DROP TRIGGER IF EXISTS trigger_refresh_farm_summary_poultry_batches ON poultry_batches;
DROP TRIGGER IF EXISTS trigger_refresh_farm_summary_poultry_eggs ON poultry_egg_records;

-- The trigger function is no longer attached to anything; drop it so nobody
-- accidentally wires a new trigger to it later and reintroduces this bug.
DROP FUNCTION IF EXISTS refresh_farm_summary();

-- ── 2. Schedule an out-of-transaction refresh via pg_cron ───────────────────
-- pg_cron runs each scheduled job as its own standalone transaction, which
-- is exactly what REFRESH MATERIALIZED VIEW CONCURRENTLY requires.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove any pre-existing job with this name so re-running the migration is
-- idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'refresh-farm-summary';
EXCEPTION WHEN OTHERS THEN
  -- cron.job may not exist yet on first run — ignore.
  NULL;
END $$;

SELECT cron.schedule(
  'refresh-farm-summary',
  '*/1 * * * *', -- every minute
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_farm_summary$$
);

-- ── 3. Refresh once now so the view isn't stale until the first cron tick ──
REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_farm_summary;

-- ============================================================================
-- FALLBACK (only if pg_cron is not available on your Supabase plan/project):
-- Comment out section 2 above and uncomment the block below to fall back to
-- a plain (non-materialized) view. You lose the read-performance benefit at
-- scale, but writes will work correctly and reads stay perfectly fresh.
--
-- DROP MATERIALIZED VIEW IF EXISTS public.v_farm_summary CASCADE;
-- CREATE VIEW public.v_farm_summary AS
--   SELECT ... -- (same SELECT body as in 20260612_materialize_farm_summary.sql)
-- GRANT SELECT ON public.v_farm_summary TO authenticated, anon;
-- ============================================================================
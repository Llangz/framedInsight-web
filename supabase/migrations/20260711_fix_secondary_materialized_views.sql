-- ============================================================================
-- Migration: Fix v_eudr_summary / v_plot_status / v_compliance_timeline /
--            v_daily_production_new / v_active_alerts
-- framedInsight — 20260711_fix_secondary_materialized_views.sql
--
-- ROOT CAUSE (same class of bug as 20260708_fix_farm_summary_refresh_trigger.sql,
-- just never applied to this file):
--
-- 1. supabase/migrations/materialized-views.sql created v_eudr_summary and
--    v_plot_status with AFTER-statement triggers that call
--    REFRESH MATERIALIZED VIEW CONCURRENTLY from inside the trigger function.
--    An AFTER trigger always runs inside the same transaction as the
--    triggering statement, and Postgres does not allow CONCURRENTLY inside a
--    transaction block, so:
--      trigger_refresh_eudr_summary        (on coffee_eudr_compliance)
--      trigger_refresh_plot_status_eudr    (on coffee_eudr_compliance)
--      trigger_refresh_plot_status_plots   (on coffee_plots)
--    have been failing EVERY insert/update/delete against coffee_plots and
--    coffee_eudr_compliance since this migration was applied — i.e. "Add
--    plot", "Edit plot", and "Run EUDR check" have been silently rolling
--    back. This is very likely the actual reason /dashboard/coffee/eudr-check
--    renders "This page didn't load": once a farmer's EUDR check attempt
--    rolled back mid-write, the page's own read of coffee_eudr_compliance /
--    v_compliance_timeline can throw on retry too (see point 2), and even
--    when it doesn't, the plot never actually got assessed.
--
-- 2. None of the 5 materialized views in materialized-views.sql ever received
--    a `GRANT SELECT ... TO authenticated, anon`. Unlike regular views,
--    materialized views can't carry Row Level Security, so PostgREST access
--    is controlled purely by GRANT. With no grant, every SELECT against
--    these views from the app (which queries as `authenticated`, not as the
--    table owner) returns a 42501 permission-denied error from PostgREST.
--    app/dashboard/coffee/eudr-check/page.tsx queries v_compliance_timeline
--    directly and, since the 20260709/20260710 unwrap migration, throws that
--    error into app/dashboard/error.tsx instead of masking it — which is
--    exactly the "This page didn't load" screen in the screenshot.
--
-- FIX (mirrors 20260708 exactly):
--   - Drop the triggers/functions that break every write to coffee_plots and
--     coffee_eudr_compliance.
--   - Refresh all 5 views on a short pg_cron interval instead (their own
--     standalone transaction, where CONCURRENTLY is legal).
--   - GRANT SELECT to authenticated and anon on all 5 views.
--   - Refresh once now so nothing is stale until the first cron tick.
--   - NOTIFY pgrst to reload its schema cache (same reasoning as
--     20260710_reload_postgrest_schema_cache.sql — grants and dropped
--     functions are exactly the kind of catalog change PostgREST needs to be
--     told about).
-- ============================================================================

-- ── 1. Remove the triggers that were silently rolling back writes ──────────
DROP TRIGGER IF EXISTS trigger_refresh_eudr_summary      ON coffee_eudr_compliance;
DROP TRIGGER IF EXISTS trigger_refresh_plot_status_eudr  ON coffee_eudr_compliance;
DROP TRIGGER IF EXISTS trigger_refresh_plot_status_plots ON coffee_plots;

DROP FUNCTION IF EXISTS refresh_eudr_summary();
DROP FUNCTION IF EXISTS refresh_plot_status();

-- ── 2. Grant read access so PostgREST can actually serve these views ───────
GRANT SELECT ON public.v_eudr_summary          TO authenticated, anon;
GRANT SELECT ON public.v_plot_status           TO authenticated, anon;
GRANT SELECT ON public.v_daily_production_new  TO authenticated, anon;
GRANT SELECT ON public.v_compliance_timeline   TO authenticated, anon;
GRANT SELECT ON public.v_active_alerts         TO authenticated, anon;

-- ── 3. Schedule out-of-transaction refreshes via pg_cron ───────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
  WHERE jobname IN (
    'refresh-eudr-summary', 'refresh-plot-status',
    'refresh-daily-production', 'refresh-compliance-timeline', 'refresh-active-alerts'
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- cron.job may not exist yet on first run
END $$;

SELECT cron.schedule('refresh-eudr-summary',       '*/1 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_eudr_summary$$);
SELECT cron.schedule('refresh-plot-status',         '*/1 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_plot_status$$);
SELECT cron.schedule('refresh-daily-production',    '*/2 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_daily_production_new$$);
SELECT cron.schedule('refresh-compliance-timeline', '*/1 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_compliance_timeline$$);
SELECT cron.schedule('refresh-active-alerts',       '*/1 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_active_alerts$$);

-- ── 4. Refresh once now so reads aren't stale until the first cron tick ────
REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_eudr_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_plot_status;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_daily_production_new;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_compliance_timeline;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_active_alerts;

-- ── 5. Tell PostgREST to pick up the new grants immediately ────────────────
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FALLBACK: if pg_cron is not enabled on this Supabase project's plan, the
-- CREATE EXTENSION / cron.schedule calls above will error. In that case,
-- comment out section 3 and either (a) call these five REFRESH ... CONCURRENTLY
-- statements from the existing app/api/cron/ews route on its schedule, or
-- (b) drop MATERIALIZED and recreate as plain VIEWs (loses read-caching, reads
-- stay perfectly fresh, writes stop breaking either way since the broken
-- triggers are already gone in step 1).
-- ============================================================================

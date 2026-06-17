-- ============================================================================
-- Migration: Convert v_farm_summary to Materialized View
-- Purpose: Improve dashboard query performance at scale
--
-- Fixes applied vs. original draft:
-- 1. poultry_egg_records has no farm_id column directly usable here without
--    a join — it links to a farm via batch_id -> poultry_batches.farm_id.
--    (Same indirect-relationship pattern as calving_records -> cow_id -> farm_id.)
-- 2. REFRESH MATERIALIZED VIEW (non-concurrent) takes an ACCESS EXCLUSIVE lock,
--    blocking all SELECTs against the view while it refreshes. Firing this on
--    every INSERT/UPDATE/DELETE to high-write tables (milk_records,
--    poultry_egg_records, etc.) would serialize all dashboard reads farm-wide
--    against every write — worse than the original uncached-view problem.
--    Switched to REFRESH MATERIALIZED VIEW CONCURRENTLY, which requires the
--    unique index (created below) and does not block concurrent reads.
-- 3. Added pg_notify-based debouncing via pg_cron is the ideal long-term fix,
--    but to keep this a single self-contained migration, the statement-level
--    trigger + CONCURRENTLY refresh below is the immediate, safe fix: it still
--    refreshes synchronously after each write batch, but no longer locks readers.
-- ============================================================================

-- Drop the existing view
DROP VIEW IF EXISTS public.v_farm_summary CASCADE;

-- Create materialized view with all existing aggregations
CREATE MATERIALIZED VIEW public.v_farm_summary AS
SELECT 
  f.id,
  f.farm_name,
  f.owner_name,
  f.county,
  f.subscription_tier,
  (f.farm_types @> ARRAY['dairy'::text]) AS has_dairy,
  (f.farm_types @> ARRAY['coffee'::text]) AS has_coffee,
  (f.farm_types @> ARRAY['small_ruminants'::text]) AS has_small_ruminants,
  (f.farm_types @> ARRAY['poultry'::text]) AS has_poultry,
  (SELECT COUNT(*) FROM cows c WHERE c.farm_id = f.id AND c.exit_date IS NULL) AS total_cows,
  (SELECT COALESCE(SUM(mr.total_milk), 0) FROM milk_records mr JOIN cows c ON mr.cow_id = c.id WHERE c.farm_id = f.id AND DATE(mr.record_date) = CURRENT_DATE) AS today_milk_liters,
  (SELECT COALESCE(SUM(cp.land_size_acres), 0) FROM coffee_plots cp WHERE cp.farm_id = f.id) AS total_coffee_acres,
  (SELECT COUNT(*) FROM small_ruminants sr WHERE sr.farm_id = f.id AND sr.exit_date IS NULL) AS total_small_ruminants,
  (SELECT COUNT(*) FROM poultry_batches pb WHERE pb.farm_id = f.id AND pb.status != 'closed') AS total_poultry_birds,
  (SELECT COALESCE(SUM(per.total_eggs), 0) FROM poultry_egg_records per JOIN poultry_batches pb2 ON per.batch_id = pb2.id WHERE pb2.farm_id = f.id AND DATE(per.record_date) = CURRENT_DATE) AS today_eggs,
  (SELECT COUNT(*) FROM poultry_batches pb WHERE pb.farm_id = f.id AND pb.bird_type = 'layer' AND pb.status != 'closed') AS poultry_layers,
  (SELECT COUNT(*) FROM poultry_batches pb WHERE pb.farm_id = f.id AND pb.bird_type = 'broiler' AND pb.status != 'closed') AS poultry_broilers,
  f.created_at
FROM farms f;

-- Unique index required for REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX idx_farm_summary_id ON v_farm_summary(id);
CREATE INDEX idx_farm_summary_subscription ON v_farm_summary(subscription_tier) WHERE subscription_tier IS NOT NULL;
CREATE INDEX idx_farm_summary_county ON v_farm_summary(county);

-- Verification notice
DO $$
DECLARE
  total_farms INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_farms FROM v_farm_summary;
  RAISE NOTICE 'Materialized view v_farm_summary created with % farms', total_farms;
END $$;

-- ============================================================================
-- REFRESH TRIGGER FUNCTION (non-blocking via CONCURRENTLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_farm_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- CONCURRENTLY avoids taking an exclusive lock, so dashboard reads are
  -- never blocked while this runs. Requires the unique index created above.
  -- Note: cannot run inside the same transaction as the triggering statement
  -- if that transaction needs the refreshed data immediately — this trades
  -- perfect read-after-write consistency for non-blocking reads, which is
  -- the right tradeoff for a dashboard summary view.
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_farm_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Statement-level triggers (fire once per statement, not once per row)
CREATE TRIGGER trigger_refresh_farm_summary_farms
AFTER INSERT OR UPDATE OR DELETE ON farms
FOR EACH STATEMENT EXECUTE FUNCTION refresh_farm_summary();

CREATE TRIGGER trigger_refresh_farm_summary_cows
AFTER INSERT OR UPDATE OR DELETE ON cows
FOR EACH STATEMENT EXECUTE FUNCTION refresh_farm_summary();

CREATE TRIGGER trigger_refresh_farm_summary_milk
AFTER INSERT OR UPDATE OR DELETE ON milk_records
FOR EACH STATEMENT EXECUTE FUNCTION refresh_farm_summary();

CREATE TRIGGER trigger_refresh_farm_summary_coffee
AFTER INSERT OR UPDATE OR DELETE ON coffee_plots
FOR EACH STATEMENT EXECUTE FUNCTION refresh_farm_summary();

CREATE TRIGGER trigger_refresh_farm_summary_ruminants
AFTER INSERT OR UPDATE OR DELETE ON small_ruminants
FOR EACH STATEMENT EXECUTE FUNCTION refresh_farm_summary();

CREATE TRIGGER trigger_refresh_farm_summary_poultry_batches
AFTER INSERT OR UPDATE OR DELETE ON poultry_batches
FOR EACH STATEMENT EXECUTE FUNCTION refresh_farm_summary();

CREATE TRIGGER trigger_refresh_farm_summary_poultry_eggs
AFTER INSERT OR UPDATE OR DELETE ON poultry_egg_records
FOR EACH STATEMENT EXECUTE FUNCTION refresh_farm_summary();

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.v_farm_summary TO authenticated, anon;

-- ============================================================================
-- OPTIONAL: Manual refresh command (run during off-peak hours if needed)
-- ============================================================================

-- REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_farm_summary;
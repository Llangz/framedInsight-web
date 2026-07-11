-- ============================================================================
-- MATERIALIZED VIEWS for Hot Paths
--
-- DDIA Pattern: Denormalization + caching for fast reads
-- These views are updated by triggers when underlying tables change
-- Queries can hit these views instead of expensive JOINs
-- ============================================================================

-- This file was previously named `materialized-views.sql`, with no leading
-- timestamp — invisible to the Supabase CLI's migration tooling (which
-- requires `<YYYYMMDD[HHMMSS]>_description.sql`), so it never actually ran
-- against the live database despite being in git since the initial commit.
-- Given that history, this DROP block makes the file safe to run now
-- regardless of what partial state the live DB is already in (e.g. from an
-- earlier manual copy-paste of parts of this SQL into the Supabase SQL
-- editor) — every CREATE below is preceded by a DROP ... IF EXISTS.
DROP MATERIALIZED VIEW IF EXISTS v_eudr_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_plot_status CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_daily_production_new CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_compliance_timeline CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_active_alerts CASCADE;

-- ─── 1. EUDR Summary (for dashboard) ───────────────────────────────────────
CREATE MATERIALIZED VIEW v_eudr_summary AS
SELECT
  farm_id,
  COUNT(*) as total_plots,
  COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as plots_cleared,
  COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as plots_verify,
  COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as plots_blocked,
  MAX(updated_at) as last_assessment,
  AVG(forest_cover_pct) as avg_forest_cover,
  COUNT(CASE WHEN compliance_status = 'verified' THEN 1 END) as verified_plots
FROM coffee_eudr_compliance
GROUP BY farm_id;

-- Was a plain (non-unique) index. REFRESH MATERIALIZED VIEW CONCURRENTLY —
-- which 20260711_fix_secondary_materialized_views.sql switches all 5 of
-- these views to, to get the trigger-in-a-transaction bug out of the
-- write path — requires at least one UNIQUE index on the view, or it
-- fails outright with "cannot refresh materialized view concurrently
-- because it does not have a unique index". farm_id is already unique
-- per row here (GROUP BY farm_id), so this is just marking that.
CREATE UNIQUE INDEX idx_eudr_summary_farm ON v_eudr_summary(farm_id);

-- ─── 2. Plot Status (enriched with latest satellite + EUDR) ───────────────
CREATE MATERIALIZED VIEW v_plot_status AS
SELECT
  p.id,
  p.farm_id,
  p.plot_name,
  p.area_hectares,
  p.region_name,
  ec.risk_level,
  ec.forest_cover_pct,
  ec.compliance_status,
  ec.assessment_date,
  si.ndvi_mean,
  si.health_label,
  si.image_date as satellite_date,
  CASE
    WHEN ec.risk_level = 'low' AND ec.compliance_status = 'verified' THEN 'green'
    WHEN ec.risk_level = 'high' OR ec.deforestation_risk = true THEN 'red'
    ELSE 'yellow'
  END as traffic_light_status
FROM coffee_plots p
LEFT JOIN LATERAL (
  SELECT * FROM coffee_eudr_compliance
  WHERE plot_id = p.id
  ORDER BY assessment_date DESC NULLS LAST
  LIMIT 1
) ec ON true
LEFT JOIN LATERAL (
  SELECT * FROM coffee_satellite_indices
  WHERE plot_id = p.id
  ORDER BY image_date DESC
  LIMIT 1
) si ON true;

-- id is unique per plot here since the LATERAL join above guarantees at
-- most one coffee_eudr_compliance row per plot (a plain join could return
-- 0, 1, or many rows per plot depending on assessment history, which would
-- make `id` non-unique and break CONCURRENTLY refresh below).
CREATE UNIQUE INDEX idx_plot_status_id ON v_plot_status(id);

CREATE INDEX idx_plot_status_farm ON v_plot_status(farm_id);
CREATE INDEX idx_plot_status_risk ON v_plot_status(risk_level);

-- ─── 3. Daily Production Summary (for dairy) ───────────────────────────────
CREATE MATERIALIZED VIEW v_daily_production_new AS
SELECT
  farm_id,
  DATE(record_date) as production_date,
  COUNT(*) as num_animals,
  COALESCE(SUM(milk_liters), 0) as total_milk_liters,
  AVG(milk_liters) as avg_milk_per_animal,
  COUNT(CASE WHEN health_status = 'sick' THEN 1 END) as sick_count
FROM dairy_records
GROUP BY farm_id, DATE(record_date);

-- UNIQUE so REFRESH MATERIALIZED VIEW CONCURRENTLY works — see the
-- v_eudr_summary comment above for why this is required, not optional.
-- (farm_id, production_date) is already unique per the GROUP BY.
CREATE UNIQUE INDEX idx_daily_prod_farm_date_unique ON v_daily_production_new(farm_id, production_date);
CREATE INDEX idx_daily_prod_farm_date ON v_daily_production_new(farm_id, production_date DESC);

-- ─── 4. Compliance Audit Log (for disputes/traceability) ──────────────────
-- Was missing `id` entirely — a farm/plot can have many events, so there
-- was no column on this view that was ever guaranteed unique per row,
-- which meant no UNIQUE index (below) could ever be created on it, which
-- meant REFRESH MATERIALIZED VIEW CONCURRENTLY (what
-- 20260711_fix_secondary_materialized_views.sql switches this view to)
-- could never work. farm_events.id is the underlying table's primary key,
-- so carrying it through here is the direct fix.
CREATE MATERIALIZED VIEW v_compliance_timeline AS
SELECT
  fe.id,
  fe.farm_id,
  fe.plot_id,
  fe.actor_id,
  fe.actor_type,
  fe.event_type,
  fe.event_data->>'risk_level' as risk_level,
  fe.event_data->>'assessment_service' as assessment_service,
  fe.created_at,
  (fe.created_at AT TIME ZONE 'Africa/Nairobi') as created_at_local_tz
FROM farm_events fe
WHERE fe.event_type IN ('eudr_assessment_run', 'photo_evidence_uploaded', 'plot_boundary_recorded')
ORDER BY fe.created_at DESC;

CREATE UNIQUE INDEX idx_timeline_id ON v_compliance_timeline(id);
CREATE INDEX idx_timeline_plot ON v_compliance_timeline(plot_id, created_at DESC);
CREATE INDEX idx_timeline_farm ON v_compliance_timeline(farm_id, created_at DESC);

-- ─── 5. Hot Alerts (high-priority, not recently acknowledged) ──────────────
CREATE MATERIALIZED VIEW v_active_alerts AS
SELECT
  id,
  farm_id,
  alert_type,
  alert_priority,
  message,
  plot_id,
  created_at,
  acknowledged_at,
  CASE
    WHEN alert_priority = 'critical' THEN 0
    WHEN alert_priority = 'high' THEN 1
    WHEN alert_priority = 'medium' THEN 2
    ELSE 3
  END as sort_order
FROM alerts
WHERE acknowledged_at IS NULL
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY sort_order ASC, created_at DESC;

-- UNIQUE so REFRESH MATERIALIZED VIEW CONCURRENTLY works — id is already
-- selected above and is alerts' primary key, so it's already unique.
CREATE UNIQUE INDEX idx_active_alerts_id ON v_active_alerts(id);
CREATE INDEX idx_active_alerts_farm ON v_active_alerts(farm_id);

-- ─── Refresh Strategy ────────────────────────────────────────────────────────
-- For real-time data, use REFRESH MATERIALIZED VIEW CONCURRENTLY
-- For better performance, set refresh on triggers:

-- Trigger: Refresh v_eudr_summary when coffee_eudr_compliance changes
CREATE OR REPLACE FUNCTION refresh_eudr_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_eudr_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_eudr_summary
AFTER INSERT OR UPDATE OR DELETE ON coffee_eudr_compliance
FOR EACH STATEMENT EXECUTE FUNCTION refresh_eudr_summary();

-- Trigger: Refresh plot status when either plots or eudr changes
CREATE OR REPLACE FUNCTION refresh_plot_status()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_plot_status;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_plot_status_eudr
AFTER INSERT OR UPDATE OR DELETE ON coffee_eudr_compliance
FOR EACH STATEMENT EXECUTE FUNCTION refresh_plot_status();

CREATE TRIGGER trigger_refresh_plot_status_plots
AFTER INSERT OR UPDATE OR DELETE ON coffee_plots
FOR EACH STATEMENT EXECUTE FUNCTION refresh_plot_status();

-- ─── Caching Headers for Client ─────────────────────────────────────────────
-- These views are read-heavy and change infrequently
-- Supabase doesn't send cache headers by default, but you can in your API:

/*
// Example in your API route:
export async function GET(req: Request) {
  const { data } = await supabase.from('v_eudr_summary').select('*')

  return new Response(JSON.stringify(data), {
    headers: {
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'Content-Type': 'application/json',
    },
  })
}
*/

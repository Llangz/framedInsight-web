-- ============================================================================
-- MATERIALIZED VIEWS for Hot Paths
--
-- DDIA Pattern: Denormalization + caching for fast reads
-- These views are updated by triggers when underlying tables change
-- Queries can hit these views instead of expensive JOINs
-- ============================================================================

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

CREATE INDEX idx_eudr_summary_farm ON v_eudr_summary(farm_id);

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
LEFT JOIN coffee_eudr_compliance ec ON p.id = ec.plot_id
LEFT JOIN LATERAL (
  SELECT * FROM coffee_satellite_indices
  WHERE plot_id = p.id
  ORDER BY image_date DESC
  LIMIT 1
) si ON true;

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

CREATE INDEX idx_daily_prod_farm_date ON v_daily_production_new(farm_id, production_date DESC);

-- ─── 4. Compliance Audit Log (for disputes/traceability) ──────────────────
CREATE MATERIALIZED VIEW v_compliance_timeline AS
SELECT
  farm_id,
  plot_id,
  actor_id,
  actor_type,
  event_type,
  event_data->>'risk_level' as risk_level,
  event_data->>'assessment_service' as assessment_service,
  created_at,
  (created_at AT TIME ZONE 'Africa/Nairobi') as created_at_local_tz
FROM farm_events
WHERE event_type IN ('eudr_assessment_run', 'photo_evidence_uploaded', 'plot_boundary_recorded')
ORDER BY created_at DESC;

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

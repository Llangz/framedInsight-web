-- ============================================================================
-- Farm Events Table - Event Sourcing Foundation
--
-- DDIA Pattern: Event sourcing for complete audit trail
-- Stores all domain events (assessments, photo uploads, boundary changes, etc.)
-- Enables temporal queries, compliance audits, and offline-first sync
--
-- Each event is immutable; complex state is derived from event stream
-- ============================================================================

CREATE TABLE farm_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  plot_id           UUID,  -- NULL for farm-level events
  actor_id          UUID,  -- User who triggered the event
  actor_type        TEXT,  -- 'user' | 'system' | 'mobile_app' | 'ai_service'

  -- Event type determines schema of event_data
  event_type        TEXT NOT NULL,
    -- EUDR events: eudr_assessment_run, eudr_risk_changed, photo_evidence_uploaded, plot_boundary_recorded
    -- Dairy events: milk_record_added, health_alert_triggered, breed_recommended
    -- General events: plot_created, compliance_verified, land_use_updated

  -- Flexible event payload (stores all context-specific data)
  event_data        JSONB NOT NULL DEFAULT '{}',

  -- Metadata for traceability and offline sync
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at_unix   BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  synced_to_server  BOOLEAN DEFAULT FALSE,  -- Marks offline-captured events

  -- Aggregation hints (for materialized view refresh)
  affects_risk_level BOOLEAN DEFAULT FALSE,
  affects_compliance  BOOLEAN DEFAULT FALSE,

  CHECK (actor_type IN ('user', 'system', 'mobile_app', 'ai_service')),
  CHECK (event_data IS NOT NULL)
);

-- Indexes for fast queries
CREATE INDEX idx_farm_events_farm ON farm_events(farm_id, created_at DESC);
CREATE INDEX idx_farm_events_plot ON farm_events(plot_id, created_at DESC) WHERE plot_id IS NOT NULL;
CREATE INDEX idx_farm_events_type ON farm_events(event_type, created_at DESC);
CREATE INDEX idx_farm_events_actor ON farm_events(actor_id, created_at DESC);
CREATE INDEX idx_farm_events_synced ON farm_events(synced_to_server, created_at)
  WHERE synced_to_server = FALSE;  -- Fast lookup of unsync'd events (mobile offline)
CREATE INDEX idx_farm_events_risk ON farm_events(farm_id, created_at DESC)
  WHERE affects_risk_level = TRUE;  -- For compliance dashboard hot path

-- ─── Event-Sourced State: Latest EUDR Assessment ────────────────────────────
-- This view materializes the "current" assessment by taking the latest eudr_assessment_run event
CREATE OR REPLACE VIEW v_eudr_assessment_stream AS
SELECT
  farm_id,
  plot_id,
  event_data->>'risk_level' as risk_level,
  event_data->>'forest_cover_pct' as forest_cover_pct,
  (event_data->>'confidence_score')::NUMERIC as confidence_score,
  event_data->>'assessment_service' as assessment_service,
  event_data->>'notes' as notes,
  actor_id,
  created_at,
  created_at AT TIME ZONE 'Africa/Nairobi' as created_at_local_tz
FROM farm_events
WHERE event_type = 'eudr_assessment_run'
ORDER BY farm_id, plot_id, created_at DESC;

-- ─── Enable RLS (Row-Level Security) ─────────────────────────────────────────
ALTER TABLE farm_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farms can view own events"
  ON farm_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM farm_managers
      WHERE farm_managers.farm_id = farm_events.farm_id
        AND farm_managers.user_id = auth.uid()
    )
  );

CREATE POLICY "farms can insert own events"
  ON farm_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM farm_managers
      WHERE farm_managers.farm_id = farm_events.farm_id
        AND farm_managers.user_id = auth.uid()
    )
  );

-- Events are immutable; no UPDATE or DELETE policies

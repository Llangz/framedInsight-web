-- ============================================================================
-- Fix farm_events: bring it up to its own originally-designed schema
-- ============================================================================
--
-- Live `farm_events` currently has only: id, farm_id, event_type,
-- event_data (jsonb), created_at, processed_at.
--
-- 20260428_create_farm_events.sql's CREATE TABLE also defines plot_id,
-- actor_id, actor_type, created_at_unix, synced_to_server,
-- affects_risk_level, and affects_compliance — none of which are live.
-- The most likely explanation: a bare-bones farm_events already existed
-- (from some earlier ad-hoc setup) by the time 20260428 ran, so its
-- `CREATE TABLE farm_events` failed with "relation already exists" and
-- was silently skipped, the same class of drift as the materialized-views
-- rename bug this sits next to.
--
-- This isn't just about v_compliance_timeline (in the migration right
-- after this one). lib/event-sourcing.ts's EventStore.recordEvent() —
-- actively called from app/dashboard/coffee/plots/[plotId]/page.tsx and
-- app/dashboard/coffee/eudr-check/[plotId]/page.tsx on every EUDR
-- assessment save and photo-evidence upload — inserts plot_id, actor_id,
-- and actor_type as top-level columns, and getPlotAuditTrail() filters
-- `.eq('plot_id', plotId)`. Both must already be failing with "column
-- does not exist" against the live table, the same shape of bug as
-- recordActivity before it was fixed.
--
-- All ADD COLUMN / index statements are IF NOT EXISTS — safe to run
-- whether this has partially landed already or not at all.

ALTER TABLE farm_events
  ADD COLUMN IF NOT EXISTS plot_id UUID,
  ADD COLUMN IF NOT EXISTS actor_id UUID,
  ADD COLUMN IF NOT EXISTS actor_type TEXT,
  ADD COLUMN IF NOT EXISTS created_at_unix BIGINT,
  ADD COLUMN IF NOT EXISTS synced_to_server BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS affects_risk_level BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS affects_compliance BOOLEAN DEFAULT FALSE;

-- NOTE: deliberately NOT adding the original migration's
-- `CHECK (actor_type IN ('user','system','mobile_app','ai_service'))`.
-- The code's actual BaseEvent.actor_type values are 'farmer' | 'system' |
-- 'auditor' (see lib/event-sourcing.ts) — a different set entirely, drifted
-- from the original design just like the columns were. Adding that CHECK
-- as originally written would reject every real insert the app makes today.

-- Backfill created_at_unix for any existing rows.
UPDATE farm_events
SET created_at_unix = (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT
WHERE created_at_unix IS NULL;

-- Backfill plot_id / actor_id / actor_type for any rows written before this
-- fix. EventStore.recordEvent() stores the *entire* event object under the
-- `event_data` column — including a nested `event_data` key holding the
-- event-type-specific payload (e.g. `event_data.event_data.plot_id`) — so
-- that's where a pre-fix row's plot_id actually lives, not top-level.
UPDATE farm_events
SET
  plot_id    = COALESCE(plot_id, (event_data #>> '{event_data,plot_id}')::UUID),
  actor_id   = COALESCE(actor_id, (event_data ->> 'actor_id')::UUID),
  actor_type = COALESCE(actor_type, event_data ->> 'actor_type')
WHERE plot_id IS NULL OR actor_id IS NULL OR actor_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_farm_events_plot ON farm_events(plot_id, created_at DESC) WHERE plot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farm_events_actor ON farm_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farm_events_synced ON farm_events(synced_to_server, created_at)
  WHERE synced_to_server = FALSE;

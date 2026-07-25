-- ============================================================================
-- AI Intent Logs — Phase 0 data collection for future small language model
--
-- Every WhatsApp message that reaches processFarmerIntent()/executeIntent()
-- is logged here: raw message, the farm context it was classified against,
-- what GPT-4o parsed, and what actually happened when we tried to execute
-- that intent (recorded / needed clarification / not found / error).
--
-- This is deliberately NOT a farm_events event type. farm_events is a
-- farmer-visible/auditor-visible domain audit trail (RLS lets farm_managers
-- read their own events); this table holds raw farmer message text and
-- model internals, which farmers/cooperative officers have no reason to see
-- via the app. It stays service-role-only.
--
-- Nothing here is used for anything yet — this is purely instrumentation to
-- build a labeled dataset. `outcome` is a heuristic derived from the reply
-- text (see lib/ai/intent-logging.ts), not a guarantee of correctness — the
-- `reviewed`/`corrected_*` columns exist so a human pass can fix labels
-- before any of this is used to fine-tune a model.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_intent_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id             UUID REFERENCES farms(id) ON DELETE CASCADE,

  -- What the farmer sent, and what we told them back
  raw_message         TEXT NOT NULL,
  language            TEXT,                         -- session lang at time of message: 'en' | 'sw'
  reply_text          TEXT,

  -- Snapshot of the farm context available to the classifier at the time
  -- (cow tags/names, plot names, ruminant tags, poultry batch names) —
  -- needed later because the same message parses differently depending on
  -- what animals/plots exist on that farm.
  farm_context        JSONB,

  -- What the model returned
  model_provider      TEXT NOT NULL DEFAULT 'openai',
  model_name          TEXT NOT NULL DEFAULT 'gpt-4o',
  parsed_intent       TEXT NOT NULL,
  parsed_entities     JSONB NOT NULL DEFAULT '{}',
  confidence          NUMERIC,

  -- What happened when we tried to act on it (heuristic, see note above)
  outcome             TEXT NOT NULL DEFAULT 'unknown',
  latency_ms          INTEGER,

  -- Human QA pass, done later, before any export for fine-tuning
  reviewed            BOOLEAN NOT NULL DEFAULT FALSE,
  corrected_intent    TEXT,
  corrected_entities  JSONB,
  reviewer_notes      TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (outcome IN ('recorded', 'needs_clarification', 'not_found', 'informational', 'error', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_farm       ON ai_intent_logs(farm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_intent     ON ai_intent_logs(parsed_intent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_outcome    ON ai_intent_logs(outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_unreviewed ON ai_intent_logs(created_at) WHERE reviewed = FALSE;

-- Service-role-only: enable RLS, add no policies. The app inserts/reads this
-- exclusively via the service-role client (same client used elsewhere in
-- lib/ai/intent-processor.ts), so no farm_managers/auditor SELECT policy is
-- defined here on purpose — this table is never meant to render in the app.
ALTER TABLE ai_intent_logs ENABLE ROW LEVEL SECURITY;

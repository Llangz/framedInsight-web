-- ============================================================================
-- coffee_activities.total_cost integrity check
-- ============================================================================
-- Enforces total_cost = cost_labour + cost_inputs going forward, matching the
-- computation already done client-side in
-- app/dashboard/coffee/activities/record/ActivityRecordClient.tsx (totalCost
-- = labour + inputs). Without this, a direct API/SQL write — or a future UI
-- bug — can silently drift total_cost away from its components, which feeds
-- straight into the P&L view at app/dashboard/coffee/finance/page.tsx.
--
-- Uses a small tolerance (< 0.01) rather than strict equality to avoid false
-- positives from floating-point rounding; cost_labour/cost_inputs/total_cost
-- are entered as form strings and parsed with parseFloat() client-side.
--
-- Added NOT VALID: this defers validation of EXISTING rows so the migration
-- itself can't fail or get blocked by historical drift. New/updated rows are
-- checked immediately. Once you've audited and fixed any existing violations
-- (query below), run the VALIDATE CONSTRAINT statement to enforce it
-- retroactively too — Postgres will then scan existing rows without taking
-- the heavier lock that ADD CONSTRAINT would otherwise need up front.
-- ============================================================================

ALTER TABLE public.coffee_activities
  ADD CONSTRAINT coffee_activities_total_cost_check
  CHECK (
    total_cost IS NULL
    OR ABS(total_cost - (COALESCE(cost_labour, 0) + COALESCE(cost_inputs, 0))) < 0.01
  ) NOT VALID;

-- ── Run this first to find any existing violations before validating ──────
-- SELECT id, farm_id, activity_date, cost_labour, cost_inputs, total_cost
--   FROM public.coffee_activities
--  WHERE total_cost IS NOT NULL
--    AND ABS(total_cost - (COALESCE(cost_labour, 0) + COALESCE(cost_inputs, 0))) >= 0.01;
--
-- ── Once any violations above are fixed (or confirmed to be none), run ────
-- ALTER TABLE public.coffee_activities VALIDATE CONSTRAINT coffee_activities_total_cost_check;

-- ============================================================================
-- coffee_activities — realign application_method / activity_type CHECK
-- constraints with what the app actually writes
-- ============================================================================
-- Confirmed error (2026-07-11, in production):
--   new row for relation "coffee_activities" violates check constraint
--   "coffee_activities_application_method_check"
--
-- Root cause: same bug class as the total_cost GENERATED column fixed in
-- 20260625_coffee_activities_total_cost_check.sql's own commit and
-- documented at length in actions.ts — coffee_activities has no
-- `CREATE TABLE` anywhere in supabase/migrations/, because it was created
-- directly in the Supabase dashboard UI. `application_method_check` (and,
-- almost certainly, an `activity_type_check` sharing the same origin) is
-- one more constraint that exists live but was never captured in git, so
-- there is no source of truth to diff the app's form values against.
--
-- We don't have direct DB access from this session to introspect the
-- *current* definition of coffee_activities_application_method_check, so
-- rather than guess at what it currently allows, this migration DROPs and
-- explicitly re-creates both constraints from the actual value sets
-- ActivityRecordClient.tsx can send today. This is deliberately the same
-- approach already used for farm_events in
-- 20260612b_fix_farm_events_missing_columns.sql — match the constraint to
-- the code's real values rather than the other way around, since the code
-- (and the farmers using it) can't wait on reverse-engineering a
-- dashboard-only constraint.
--
-- ── application_method ──────────────────────────────────────────────────
-- Set in ActivityRecordClient.tsx (`applicationMethod`), one of three
-- source fields depending on activity_type:
--   • weeding         → form.weeding_method  (WEEDING_METHODS, line ~45)
--        manual_jembe | slashing | herbicide | combined
--   • nutrition        → form.nutrition_method (NUTRITION_METHODS, line ~57+)
--        basal | top_dressing | foliar
--   • crop_protection  → form.spray_equipment (SPRAY_EQUIPMENT, line ~125)
--        knapsack | motorized | boom
--   • pruning / mulching / other → application_method is left `null`
--     (never set for these activity types — see ActivityRecordClient.tsx
--     lines 304-307, only weeding/nutrition/crop_protection assign it)
--
-- ── activity_type ───────────────────────────────────────────────────────
-- ActivityRecordClient.tsx maps its own UI-level ActivityType to a
-- different set of DB values before insert (line ~315):
--   weeding → 'weeding' | nutrition → 'fertilizer' |
--   crop_protection → 'spraying' | pruning → 'pruning' |
--   mulching → 'mulching' | other → 'other'
-- If a dashboard-made activity_type_check still expects the pre-mapping
-- names ('nutrition', 'crop_protection'), every fertilizer/spray record
-- would fail the exact same way application_method just did. Realigning
-- both in one migration rather than waiting for the next crash report.
--
-- Both are added NOT VALID (same reasoning as the total_cost check): this
-- validates only new/updated rows immediately and does not scan or risk
-- failing on existing history. Run the VALIDATE CONSTRAINT statements at
-- the bottom once you've confirmed there's no historical drift (e.g. rows
-- inserted directly via SQL/dashboard with different values).
-- ============================================================================

-- ── Diagnostics: run this first if you want to see what's live today ──────
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.coffee_activities'::regclass
--   AND contype = 'c';
--
-- SELECT DISTINCT activity_type, application_method
-- FROM public.coffee_activities
-- ORDER BY 1, 2;

ALTER TABLE public.coffee_activities
  DROP CONSTRAINT IF EXISTS coffee_activities_application_method_check;

ALTER TABLE public.coffee_activities
  ADD CONSTRAINT coffee_activities_application_method_check
  CHECK (
    application_method IS NULL
    OR application_method IN (
      -- weeding
      'manual_jembe', 'slashing', 'herbicide', 'combined',
      -- nutrition
      'basal', 'top_dressing', 'foliar',
      -- crop protection
      'knapsack', 'motorized', 'boom'
    )
  ) NOT VALID;

ALTER TABLE public.coffee_activities
  DROP CONSTRAINT IF EXISTS coffee_activities_activity_type_check;

ALTER TABLE public.coffee_activities
  ADD CONSTRAINT coffee_activities_activity_type_check
  CHECK (
    activity_type IN (
      'weeding', 'fertilizer', 'spraying', 'pruning', 'mulching', 'other'
    )
  ) NOT VALID;

-- ── Run once any pre-existing rows are confirmed clean (see diagnostics
--    query above) ──────────────────────────────────────────────────────
-- ALTER TABLE public.coffee_activities VALIDATE CONSTRAINT coffee_activities_application_method_check;
-- ALTER TABLE public.coffee_activities VALIDATE CONSTRAINT coffee_activities_activity_type_check;

-- coffee_activities.application_method CHECK constraint mismatch
--
-- coffee_activities was created directly in the Supabase dashboard (no
-- CREATE TABLE migration in this repo — see handover doc §3), so its
-- constraints drifted from what the app actually writes.
--
-- ActivityRecordClient.tsx stores THREE different vocabularies in this one
-- column depending on activity_type:
--   nutrition       -> nutrition_method:  basal | top_dressing | foliar
--   crop_protection -> spray_equipment:   knapsack | motorized | boom
--   weeding         -> weeding_method:    manual_jembe | slashing | herbicide | combined
--
-- The live constraint only allowed a subset of these (most likely just the
-- spray-equipment values from when this column was originally scoped to
-- crop_protection only), which is why "Save activity" now fails with:
--   new row for relation "coffee_activities" violates check constraint
--   "coffee_activities_application_method_check"
--
-- Fix: drop and recreate the constraint to allow every value the app can
-- actually send, or NULL (other activity types like harvest/pruning/mulching
-- never set this field).

ALTER TABLE coffee_activities
  DROP CONSTRAINT IF EXISTS coffee_activities_application_method_check;

ALTER TABLE coffee_activities
  ADD CONSTRAINT coffee_activities_application_method_check
  CHECK (
    application_method IS NULL OR application_method IN (
      -- nutrition (NUTRITION_METHODS)
      'basal', 'top_dressing', 'foliar',
      -- crop_protection (SPRAY_EQUIPMENT)
      'knapsack', 'motorized', 'boom',
      -- weeding (WEEDING_METHODS)
      'manual_jembe', 'slashing', 'herbicide', 'combined'
    )
  );

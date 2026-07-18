-- ============================================================================
-- coffee_activities_quantity_unit_check — missing 'debe'
-- ============================================================================
-- Confirmed live definition (2026-07-18):
--   CHECK (quantity_unit = ANY (ARRAY['kg','g','litres','ml','bags','tonnes','wheelbarrows']))
--
-- ActivityRecordClient.tsx's fertilizer quantity-unit picker offers three
-- options: kg, bags, and debe (a ~20L tin, a real and commonly used
-- Kenyan farm measure — dropping it or silently remapping it to something
-- else would misrepresent what the farmer actually applied). 'debe' isn't
-- in the allowed list, so any basal/top-dress record saved with that unit
-- selected currently fails outright.
--
-- Fix: extend the constraint to include it, same pattern as this table's
-- other realignment migrations (match the constraint to what the app
-- actually sends).
-- ============================================================================

ALTER TABLE public.coffee_activities
  DROP CONSTRAINT IF EXISTS coffee_activities_quantity_unit_check;

ALTER TABLE public.coffee_activities
  ADD CONSTRAINT coffee_activities_quantity_unit_check
  CHECK (
    quantity_unit IS NULL
    OR quantity_unit = ANY (ARRAY['kg', 'g', 'litres', 'ml', 'bags', 'tonnes', 'wheelbarrows', 'debe'])
  );

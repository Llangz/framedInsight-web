-- ============================================================================
-- poultry_batches — add purchase_price_per_bird
-- ============================================================================
-- AddBatchClient.tsx already collects a "Purchase price / bird (KES)" field
-- (form.purchase_price_per_bird) at batch registration, but poultry_batches
-- has no matching column, so the value has always been silently discarded —
-- never sent in the insert() call. Same class of bug as the initial_count
-- fix already in this file: a field the farmer fills in that never reaches
-- the database.
--
-- This blocks any "profit on sale" calculation for poultry (sale price minus
-- acquisition cost), the same treatment dairy cows and small ruminants have
-- via purchase_price/exit_value on the animal record. Poultry batches don't
-- have a single "exit_value" the way an individual animal does — a batch is
-- sold down over time (cull sales, spent-layer sales, meat sales), often in
-- several transactions against poultry_sales — so acquisition cost is
-- tracked per-bird here and the app computes total cost as
-- current_count * purchase_price_per_bird at query time, not as a running
-- balance column (that would need to be decremented on every partial sale,
-- which is a bigger change than this migration's scope).
--
-- Existing batches (registered before this migration) will have
-- purchase_price_per_bird = NULL — there's no reliable original per-bird
-- cost to backfill from anywhere else in the schema. The app treats NULL as
-- "unknown cost" and excludes that batch from profit totals rather than
-- assuming 0, the same convention used for cows/small ruminants missing a
-- purchase_price.
-- ============================================================================

ALTER TABLE public.poultry_batches
  ADD COLUMN IF NOT EXISTS purchase_price_per_bird numeric(10,2);

COMMENT ON COLUMN public.poultry_batches.purchase_price_per_bird IS
  'KES cost per bird at acquisition (day-old chick price, or purchase price for started birds). NULL for batches registered before this column existed — treat as unknown cost, not zero.';

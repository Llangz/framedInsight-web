-- ============================================================
-- Migration: lot_farmer_deliveries schema drift correction
-- framedInsight — 20260630a_lot_farmer_deliveries_drift_fix.sql
--
-- ROOT CAUSE: lib/database.types.ts has declared accepted, plot_id,
-- cherry_condition, farmer_mbuni_kg, rejection_reason, and quality_grade
-- on lot_farmer_deliveries for some time, but no migration in this repo
-- ever added them. The live database does not have these columns
-- (confirmed by: ERROR 42703 column lfd.accepted does not exist, raised
-- when applying 20260701_financial_transparency_and_documents.sql).
--
-- This migration makes the live schema match what the codebase has
-- assumed exists for a while now (getBuyerLotGeoJson() in
-- lib/passport/buyer-access.service.ts already queries plot_id and
-- accepted on this table). MUST run before
-- 20260701_financial_transparency_and_documents.sql, which joins
-- lot_farmer_deliveries ON accepted = true.
--
-- IMPORTANT: this migration cannot know which historical deliveries were
-- actually accepted vs rejected — that data was never captured. Existing
-- rows are backfilled to accepted = true (the safe assumption: a
-- delivery that made it into lot_farmer_deliveries was, by definition,
-- received and counted into the lot's cherry total — rejections likely
-- never created a row in the first place under the prior implicit
-- model). Going forward, the intake UI should explicitly set this flag.
-- ============================================================

ALTER TABLE public.lot_farmer_deliveries
  ADD COLUMN IF NOT EXISTS plot_id            uuid REFERENCES public.coffee_plots(id),
  ADD COLUMN IF NOT EXISTS accepted           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cherry_condition   text,
  ADD COLUMN IF NOT EXISTS farmer_mbuni_kg    numeric(10,2),
  ADD COLUMN IF NOT EXISTS rejection_reason   text,
  ADD COLUMN IF NOT EXISTS quality_grade      text;

COMMENT ON COLUMN public.lot_farmer_deliveries.plot_id IS
  'Which specific coffee_plot this cherry was harvested from. Nullable '
  'because historical deliveries predate per-plot tracking — required '
  'for new deliveries going forward to support EUDR geolocation export '
  '(see getBuyerLotGeoJson in lib/passport/buyer-access.service.ts).';

COMMENT ON COLUMN public.lot_farmer_deliveries.accepted IS
  'Whether the factory clerk accepted this delivery into the lot''s '
  'cherry total. Backfilled to true for all pre-existing rows (see '
  'migration header note) — going forward the intake UI should let '
  'clerks reject sub-standard or mbuni deliveries explicitly.';

CREATE INDEX IF NOT EXISTS idx_lot_farmer_deliveries_plot_id
  ON public.lot_farmer_deliveries (plot_id);

-- ── Verification query (run manually after applying) ─────────────────────────
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'lot_farmer_deliveries'
-- ORDER BY ordinal_position;
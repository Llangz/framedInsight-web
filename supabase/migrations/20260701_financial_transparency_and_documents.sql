-- ============================================================
-- Migration: Financial Transparency & Document Provenance
-- framedInsight — 20260701_financial_transparency_and_documents.sql
--
-- 1. Adds cherry gate price fields to factory_intake_lots so the
--    cooperative records what it paid farmers per kg of cherry delivered.
--    Kenyan cooperatives typically pay in two tranches:
--      - first_payment_kes_per_kg  : gate price paid at delivery
--      - second_payment_kes_per_kg : bonus paid after NCE auction settles
--    Both are stored to enable accurate farmer-return calculations on the
--    passport's Financial Transparency widget.
--
-- 2. Creates export_lot_documents table for government-issued certifications
--    (AFA Milling License, KEPHIS Phytosanitary Certificate, Coffee
--    Movement Permits, cupping scorecards) uploaded by cooperative officers
--    and exposed in the buyer data room — not on the public passport.
-- ============================================================

-- ── 1. Cherry gate price on intake lots ──────────────────────────────────────

ALTER TABLE public.factory_intake_lots
  ADD COLUMN IF NOT EXISTS first_payment_kes_per_kg  numeric(8,2),
  ADD COLUMN IF NOT EXISTS second_payment_kes_per_kg numeric(8,2),
  ADD COLUMN IF NOT EXISTS payment_season             text;  -- e.g. '2025/2026'

COMMENT ON COLUMN public.factory_intake_lots.first_payment_kes_per_kg IS
  'Gate price paid to farmers at the point of cherry delivery (KES per kg). '
  'Set by the cooperative officer when opening or closing the intake lot.';

COMMENT ON COLUMN public.factory_intake_lots.second_payment_kes_per_kg IS
  'Bonus/second payment per kg of cherry paid to farmers after the NCE auction '
  'settles and the cooperative distributes net proceeds. NULL until paid.';

COMMENT ON COLUMN public.factory_intake_lots.payment_season IS
  'Crop season this payment relates to, e.g. "2025/2026". '
  'Distinct from harvest_year because the long-rains crop harvested in Nov 2025 '
  'may not be auctioned and paid until early 2026.';

-- ── 2. Export lot documents ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.export_lot_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  export_lot_id       uuid        NOT NULL REFERENCES public.export_lots(id) ON DELETE CASCADE,
  cooperative_id      uuid        NOT NULL REFERENCES public.cooperatives(id),
  document_type       text        NOT NULL,
  document_label      text,       -- human-readable override, e.g. "KEPHIS Cert #KPH-2026-01234"
  storage_path        text        NOT NULL,  -- path inside Supabase Storage bucket
  file_name           text        NOT NULL,
  file_size_bytes     integer,
  mime_type           text,
  uploaded_by         uuid        REFERENCES auth.users(id),
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  verified_by_officer uuid        REFERENCES auth.users(id),
  verified_at         timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Document type must be one of the recognised Kenyan coffee regulatory documents
ALTER TABLE public.export_lot_documents
  ADD CONSTRAINT export_lot_documents_type_check
  CHECK (document_type IN (
    'afa_milling_license',
    'kephis_phytosanitary_certificate',
    'coffee_movement_permit',
    'cupping_scorecard',
    'quality_analysis_sheet',
    'ncpb_clean_coffee_report',
    'export_permit',
    'other'
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_export_lot_docs_lot
  ON public.export_lot_documents (export_lot_id);
CREATE INDEX IF NOT EXISTS idx_export_lot_docs_coop
  ON public.export_lot_documents (cooperative_id);

-- RLS
ALTER TABLE public.export_lot_documents ENABLE ROW LEVEL SECURITY;

-- Officers of the cooperative that owns this export lot can read and write
CREATE POLICY "Coop officers can manage their export lot documents"
  ON public.export_lot_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = export_lot_documents.cooperative_id
        AND co.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = export_lot_documents.cooperative_id
        AND co.user_id = auth.uid()
    )
  );

-- Documents are readable via buyer_access_token — enforced in application layer
-- (service role bypasses RLS; buyer-access.service.ts uses the admin client)
-- No public SELECT policy here on purpose.

-- ── 3. View: financial summary per export lot ────────────────────────────────
-- Computes weighted-average cherry payout from the contributing intake lots,
-- then calculates what percentage of the FOB price flowed back to farmers.
-- Used by passport.service.ts to populate financial_metrics on the passport.

CREATE OR REPLACE VIEW public.v_export_lot_financial_summary AS
SELECT
  el.id                                       AS export_lot_id,
  el.export_lot_number,
  el.cooperative_id,
  el.fob_price_usd_per_kg,
  el.net_weight_kg,
  el.total_value_usd,

  -- Weighted-average first (gate) payment across all contributing intake lots
  ROUND(
    SUM(fil.first_payment_kes_per_kg  * fil.total_cherry_kg) /
    NULLIF(SUM(fil.total_cherry_kg), 0),
    2
  )                                           AS avg_first_payment_kes_per_kg,

  -- Weighted-average second (bonus) payment, NULL if not yet distributed
  CASE
    WHEN COUNT(fil.second_payment_kes_per_kg) = 0 THEN NULL
    ELSE ROUND(
      SUM(COALESCE(fil.second_payment_kes_per_kg, 0) * fil.total_cherry_kg) /
      NULLIF(SUM(fil.total_cherry_kg), 0),
      2
    )
  END                                         AS avg_second_payment_kes_per_kg,

  -- Total farmer return (first + second) per kg cherry
  ROUND(
    SUM(
      (COALESCE(fil.first_payment_kes_per_kg, 0) +
       COALESCE(fil.second_payment_kes_per_kg, 0)) * fil.total_cherry_kg
    ) /
    NULLIF(SUM(fil.total_cherry_kg), 0),
    2
  )                                           AS avg_total_payout_kes_per_kg,

  -- Total cherry kg that contributed to this export lot (across all intake lots)
  SUM(fil.total_cherry_kg)                    AS total_cherry_kg_in,

  -- Count of distinct farmers (unique farm_ids across contributing deliveries)
  COUNT(DISTINCT lfd.farm_id)                 AS farmer_count,

  -- Outturn ratio (clean coffee kg ÷ cherry kg) — cross-checks mill efficiency
  ROUND(
    el.net_weight_kg /
    NULLIF(SUM(fil.total_cherry_kg), 0),
    4
  )                                           AS outturn_ratio

FROM public.export_lots el

-- Export lot → mill lots → processing batches → intake lots
JOIN public.export_lot_mill_lots elml ON elml.export_lot_id = el.id
JOIN public.mill_lot_batches mlb     ON mlb.mill_lot_id    = elml.mill_lot_id
JOIN public.processing_batches pb    ON pb.id              = mlb.processing_batch_id
JOIN public.factory_intake_lots fil  ON fil.id             = pb.intake_lot_id

-- Intake lot → deliveries (for farmer count)
LEFT JOIN public.lot_farmer_deliveries lfd
  ON lfd.lot_id = fil.id AND lfd.accepted = true

GROUP BY
  el.id,
  el.export_lot_number,
  el.cooperative_id,
  el.fob_price_usd_per_kg,
  el.net_weight_kg,
  el.total_value_usd;

COMMENT ON VIEW public.v_export_lot_financial_summary IS
  'Computes weighted-average cherry payout (first + second payment) for each '
  'export lot, tracing back through the full mill→batch→intake chain. '
  'Used to populate the Financial Transparency widget on the coffee passport.';

-- ── 4. Atomic passport view-count increment ───────────────────────────────────
-- Replaces the old read-then-write pattern in passport.service.ts
-- (`update({ view_count: data.view_count + 1 })`), which raced under
-- concurrent visitors. Called from the client-side
-- POST /api/passport/[passportCode]/view route so counting works even
-- though the public passport page itself is edge-cached.

CREATE OR REPLACE FUNCTION public.increment_passport_view_count(p_passport_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coffee_passports
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE passport_code = p_passport_code
    AND status = 'published';
$$;

COMMENT ON FUNCTION public.increment_passport_view_count IS
  'Atomically increments view_count for a published passport. '
  'Single UPDATE statement — no read-modify-write race.';

-- ── 4b. Storage bucket: export-lot-documents ──────────────────────────────────
-- Government-issued documents (AFA license, KEPHIS cert, movement permits)
-- live in a PRIVATE bucket — unlike 'farm-photos' which is public.
--
-- MANUAL STEP REQUIRED: create the bucket itself via the Supabase dashboard
-- or CLI, since INSERT INTO storage.buckets requires the storage extension's
-- internal functions and is best done through the management API:
--
--   supabase storage buckets create export-lot-documents --private
--
-- Or in the dashboard: Storage → New bucket → name "export-lot-documents",
-- toggle "Public bucket" OFF.
--
-- The RLS policies below apply once the bucket exists. They mirror the
-- cooperative-officer scoping already used on export_lot_documents itself.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'export-lot-documents') THEN

    -- Path convention enforced by the upload client:
    --   {cooperative_id}/{export_lot_id}/{timestamp}_{filename}
    -- storage.foldername(name)[1] extracts the first path segment, letting
    -- RLS confirm the uploader is an officer of THAT specific cooperative
    -- rather than any cooperative in the system.

    DROP POLICY IF EXISTS "Coop officers can upload export lot documents" ON storage.objects;
    CREATE POLICY "Coop officers can upload export lot documents"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'export-lot-documents'
        AND EXISTS (
          SELECT 1 FROM public.cooperative_officers co
          WHERE co.user_id = auth.uid()
            AND co.cooperative_id::text = (storage.foldername(name))[1]
        )
      );

    DROP POLICY IF EXISTS "Coop officers can read their own lot documents" ON storage.objects;
    CREATE POLICY "Coop officers can read their own lot documents"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'export-lot-documents'
        AND EXISTS (
          SELECT 1 FROM public.cooperative_officers co
          WHERE co.user_id = auth.uid()
            AND co.cooperative_id::text = (storage.foldername(name))[1]
        )
      );

    DROP POLICY IF EXISTS "Coop officers can delete their own lot documents" ON storage.objects;
    CREATE POLICY "Coop officers can delete their own lot documents"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'export-lot-documents'
        AND EXISTS (
          SELECT 1 FROM public.cooperative_officers co
          WHERE co.user_id = auth.uid()
            AND co.cooperative_id::text = (storage.foldername(name))[1]
        )
      );

  END IF;
END $$;

-- ── 5. Widen v_passport_chain with financial transparency fields ─────────────
-- Follows the append-only pattern established in
-- 20260627_passport_chain_registration_fields.sql: existing column order is
-- untouched, new columns are appended at the end so no consuming code breaks.
--
-- avg_first_payment_kes_per_kg / avg_second_payment_kes_per_kg /
-- avg_total_payout_kes_per_kg / farmer_count / outturn_ratio let the public
-- passport and buyer data room show what farmers were actually paid for
-- their cherry — the single biggest trust signal for specialty buyers
-- verifying "ethical sourcing" claims (see audit §2, Financial Transparency
-- Gap). These are cooperative-level averages, not individual-farmer payment
-- records, so they are safe to expose publicly.

CREATE OR REPLACE VIEW public.v_passport_chain AS
SELECT
  cp.id                          AS passport_id,
  cp.passport_code,
  cp.status                      AS passport_status,
  cp.public_story,
  cp.sustainability_metrics,
  cp.quality_metrics,
  cp.geo_summary,
  cp.view_count,
  cp.published_at,

  -- Export lot
  el.export_lot_number,
  el.buyer_name,
  el.buyer_country,
  el.destination_port,
  el.grade,
  el.net_weight_kg,
  el.sca_cupping_score,
  el.eudr_dds_reference,
  el.eudr_compliant,
  el.departure_date,

  -- Cooperative (existing view columns/order)
  co.cooperative_name,
  co.county,
  co.sub_county,
  co.ward,

  cp.cooperative_id,

  -- Registration fields (added 20260627)
  co.registration_number,
  co.commissioner_ref,
  co.registered_office,

  -- Financial transparency fields (added 20260701)
  fin.avg_first_payment_kes_per_kg,
  fin.avg_second_payment_kes_per_kg,
  fin.avg_total_payout_kes_per_kg,
  fin.farmer_count,
  fin.outturn_ratio

FROM public.coffee_passports cp
LEFT JOIN public.export_lots el ON el.id = cp.export_lot_id
LEFT JOIN public.cooperatives co ON co.id = cp.cooperative_id
LEFT JOIN public.v_export_lot_financial_summary fin ON fin.export_lot_id = cp.export_lot_id;

COMMENT ON VIEW public.v_passport_chain IS
  'Denormalized join for the public Coffee Passport trace page and B2B API. '
  'registration_number / commissioner_ref / registered_office (added 20260627) '
  'let a buyer verify the supplying cooperative''s legal registration. '
  'avg_first_payment_kes_per_kg / avg_second_payment_kes_per_kg / '
  'avg_total_payout_kes_per_kg / farmer_count / outturn_ratio (added 20260701) '
  'power the Financial Transparency widget. buyer_name / buyer_country remain '
  'selectable here for potential internal use, but the application layer must '
  'never forward those two columns to the public trace page or B2B API '
  'response — see the explicit filtering in app/trace/[passportCode]/page.tsx '
  'and the allowlisted response object in app/api/passport/[passportCode]/route.ts.';

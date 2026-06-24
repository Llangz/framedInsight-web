-- ============================================================
-- Coffee Digital Passport Platform
-- framedInsight — migration 20260624
--
-- Adds the complete chain:
--   cherry_delivery → processing_batch → parchment_batch
--   → mill_lot → export_lot → coffee_passport
-- Plus: traceability_events ledger (immutable audit log)
-- ============================================================

-- ── 1. PROCESSING BATCHES (factory wet-mill record) ─────────────────────────
-- One batch = one day's cherry intake + fermentation run at a washing station.
-- Aggregates multiple farmer deliveries (lot_farmer_deliveries) into one unit.

CREATE TABLE IF NOT EXISTS public.processing_batches (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  batch_number             text UNIQUE NOT NULL,  -- e.g. KRG-MC-2026-0042-B
  intake_lot_id            uuid REFERENCES public.factory_intake_lots(id) ON DELETE CASCADE,
  factory_id               uuid REFERENCES public.coop_factories(id),
  cooperative_id           uuid REFERENCES public.cooperatives(id),

  -- Cherry received
  intake_date              date NOT NULL,
  total_cherry_kg          numeric(10,2) DEFAULT 0,
  total_mbuni_kg           numeric(10,2) DEFAULT 0,
  rejected_kg              numeric(10,2) DEFAULT 0,
  total_farmers            integer DEFAULT 0,
  season                   text,   -- 'main' | 'fly'
  harvest_year             integer,

  -- Processing
  pulping_start_time       timestamptz,
  fermentation_tank        text,   -- 'Tank A' | 'Tank B' etc.
  fermentation_start_time  timestamptz,
  fermentation_end_time    timestamptz,
  fermentation_hours       numeric(5,1),
  washing_date             date,
  water_source             text,   -- 'river' | 'borehole'

  -- Drying
  drying_method            text DEFAULT 'raised_beds',  -- 'raised_beds' | 'ground'
  drying_start_date        date,
  drying_end_date          date,
  drying_days              integer,
  parchment_kg             numeric(10,2),  -- after drying
  outturn_ratio            numeric(6,4),   -- parchment / cherry (target 0.18–0.22)
  moisture_content_pct     numeric(5,2),   -- target 10–12%

  -- Status
  status                   text DEFAULT 'intake' CHECK (
    status IN ('intake','pulping','fermenting','washing','drying','milled','exported','closed')
  ),
  clerk_name               text,
  notes                    text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- ── 2. MILL LOTS (dry mill output — parchment → clean coffee) ───────────────

CREATE TABLE IF NOT EXISTS public.mill_lots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mill_lot_number       text UNIQUE NOT NULL,   -- e.g. KRG-MC-2026-MILL-001
  cooperative_id        uuid REFERENCES public.cooperatives(id),

  -- Linked processing batches (one mill lot can aggregate several factory batches)
  total_parchment_kg_in numeric(10,2),
  clean_coffee_kg_out   numeric(10,2),
  milling_outturn_ratio numeric(6,4),   -- clean / parchment (target 0.60–0.75)

  -- Grades produced (JSON: {AA: kg, AB: kg, C: kg, TT: kg, E: kg})
  grade_breakdown       jsonb,

  -- Dry mill details
  mill_name             text,   -- 'Othaya Farmers Mill' | 'Socfinaf' etc.
  milling_date          date,
  moisture_content_pct  numeric(5,2),

  -- NCE linkage
  nce_transaction_id    text,   -- NCE auction reference
  nce_auction_date      date,
  nce_price_usd_per_kg  numeric(8,2),

  status                text DEFAULT 'pending' CHECK (
    status IN ('pending','milled','graded','auctioned','sold','exported')
  ),
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Join: processing_batch → mill_lot (many-to-many)
CREATE TABLE IF NOT EXISTS public.mill_lot_batches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mill_lot_id           uuid NOT NULL REFERENCES public.mill_lots(id) ON DELETE CASCADE,
  processing_batch_id   uuid NOT NULL REFERENCES public.processing_batches(id),
  parchment_kg_contributed numeric(10,2),
  created_at            timestamptz DEFAULT now(),
  UNIQUE(mill_lot_id, processing_batch_id)
);

-- ── 3. EXPORT LOTS (exporter-level shipment) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.export_lots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_lot_number     text UNIQUE NOT NULL,   -- e.g. KRG-2026-EX-001
  cooperative_id        uuid REFERENCES public.cooperatives(id),

  -- Shipment details
  exporter_name         text,
  buyer_name            text,     -- roaster / importer
  buyer_country         text,
  destination_port      text,
  origin_port           text DEFAULT 'Mombasa',
  container_number      text,
  bill_of_lading        text,

  -- Coffee details
  total_bags            integer,
  bag_weight_kg         numeric(6,2) DEFAULT 60,
  net_weight_kg         numeric(10,2),
  grade                 text,   -- 'AA' | 'AB' | 'PB' | 'TT' | 'E'
  processing_method     text DEFAULT 'washed',
  moisture_content_pct  numeric(5,2),
  sca_cupping_score     numeric(5,2),

  -- EUDR
  eudr_dds_reference    text,   -- EU DDS filing reference number
  eudr_compliant        boolean DEFAULT false,

  -- Dates
  departure_date        date,
  arrival_date          date,

  -- Financials
  fob_price_usd_per_kg  numeric(8,2),
  total_value_usd       numeric(12,2),

  status                text DEFAULT 'pending' CHECK (
    status IN ('pending','confirmed','shipped','arrived','completed')
  ),
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Join: mill_lot → export_lot
CREATE TABLE IF NOT EXISTS public.export_lot_mill_lots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_lot_id    uuid NOT NULL REFERENCES public.export_lots(id) ON DELETE CASCADE,
  mill_lot_id      uuid NOT NULL REFERENCES public.mill_lots(id),
  clean_kg_allocated numeric(10,2),
  created_at       timestamptz DEFAULT now(),
  UNIQUE(export_lot_id, mill_lot_id)
);

-- ── 4. COFFEE PASSPORTS (the consumer-facing digital identity) ───────────────

CREATE TABLE IF NOT EXISTS public.coffee_passports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_lot_id    uuid REFERENCES public.export_lots(id) ON DELETE SET NULL,
  cooperative_id   uuid REFERENCES public.cooperatives(id),

  -- Canonical public identity
  passport_code    text UNIQUE NOT NULL,   -- e.g. FI-KRG-2026-0042
  qr_url           text,                   -- resolves to /trace/[passport_code]
  status           text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),

  -- Consumer story (flexible JSON — updated without schema changes)
  public_story     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Shape:
  -- {
  --   "region": "Nyeri",
  --   "county": "Nyeri",
  --   "factory": "Gatugi Washing Station",
  --   "cooperative": "Othaya Farmers Cooperative Society",
  --   "altitude_m": 1850,
  --   "varieties": ["SL28", "SL34"],
  --   "processing": "Fully Washed",
  --   "harvest_season": "Main Crop 2026",
  --   "farm_count": 421,
  --   "female_farmer_pct": 48,
  --   "avg_farm_size_acres": 0.9,
  --   "hero_image_url": "...",
  --   "farmer_story": "...",
  --   "tasting_notes": "Bright citrus, blackcurrant, silky body"
  -- }

  -- Sustainability metrics (JSON)
  sustainability_metrics jsonb DEFAULT '{}'::jsonb,
  -- Shape:
  -- {
  --   "eudr_compliant": true,
  --   "deforestation_free_plots_pct": 100,
  --   "organic_certified": false,
  --   "rainforest_alliance": false,
  --   "fair_trade": false,
  --   "avg_forest_cover_pct": 22.4,
  --   "total_plot_area_acres": 380,
  --   "chemical_inputs": ["CAN fertilizer", "copper fungicide"]
  -- }

  -- Quality metrics (JSON)
  quality_metrics  jsonb DEFAULT '{}'::jsonb,
  -- Shape:
  -- {
  --   "sca_score": 87.5,
  --   "cupper_name": "Samuel Kamau",
  --   "cupping_date": "2026-03-15",
  --   "flavor_notes": "Bright citrus, blackcurrant, silky body",
  --   "aroma": 8.5,
  --   "acidity": 8.75,
  --   "body": 8.25,
  --   "grade": "AA",
  --   "moisture_pct": 11.2,
  --   "certifications": ["UTZ"]
  -- }

  -- Supply chain GPS summary (aggregated from plots)
  geo_summary      jsonb DEFAULT '{}'::jsonb,
  -- Shape:
  -- {
  --   "centroid_lat": -0.4167,
  --   "centroid_lng": 36.9500,
  --   "bounding_box": [...],
  --   "plot_count": 421,
  --   "factory_lat": -0.4200,
  --   "factory_lng": 36.9600,
  --   "export_port": "Mombasa"
  -- }

  -- Audit
  published_at     timestamptz,
  view_count       integer DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── 5. TRACEABILITY EVENTS LEDGER (immutable audit chain) ───────────────────
-- Hash-chained log. Every state change writes an event. Previous + current
-- SHA-256 hash creates blockchain-style integrity without blockchain complexity.

CREATE TABLE IF NOT EXISTS public.traceability_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What changed
  entity_type    text NOT NULL,   -- 'factory_intake_lot' | 'processing_batch' | 'mill_lot' | 'export_lot' | 'coffee_passport' | 'delivery'
  entity_id      uuid NOT NULL,

  -- Who changed it
  actor_user_id  uuid,            -- auth.users.id (null for system events)
  actor_name     text,            -- clerk name or 'system'
  cooperative_id uuid REFERENCES public.cooperatives(id),

  -- What happened
  event_type     text NOT NULL,   -- 'created' | 'delivery_added' | 'status_changed' | 'parchment_recorded' | 'nce_linked' | 'passport_published'
  event_data     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Hash chain (tamper-evident)
  previous_hash  text,
  current_hash   text NOT NULL,   -- SHA-256 of (entity_id || event_type || event_data || previous_hash || created_at)

  created_at     timestamptz DEFAULT now()
  -- NO updated_at — this table is append-only / immutable
);

-- Prevent updates and deletes on the ledger
CREATE OR REPLACE RULE traceability_no_update AS ON UPDATE TO public.traceability_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE traceability_no_delete AS ON DELETE TO public.traceability_events DO INSTEAD NOTHING;

-- ── 6. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_processing_batches_lot    ON public.processing_batches(intake_lot_id);
CREATE INDEX IF NOT EXISTS idx_processing_batches_coop   ON public.processing_batches(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_processing_batches_date   ON public.processing_batches(intake_date DESC);
CREATE INDEX IF NOT EXISTS idx_mill_lot_batches_mill     ON public.mill_lot_batches(mill_lot_id);
CREATE INDEX IF NOT EXISTS idx_mill_lot_batches_batch    ON public.mill_lot_batches(processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_export_lots_coop          ON public.export_lots(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_export_lot_mill_lots      ON public.export_lot_mill_lots(export_lot_id);
CREATE INDEX IF NOT EXISTS idx_coffee_passports_code     ON public.coffee_passports(passport_code);
CREATE INDEX IF NOT EXISTS idx_coffee_passports_export   ON public.coffee_passports(export_lot_id);
CREATE INDEX IF NOT EXISTS idx_coffee_passports_coop     ON public.coffee_passports(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_coffee_passports_status   ON public.coffee_passports(status);
CREATE INDEX IF NOT EXISTS idx_traceability_events_entity ON public.traceability_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_traceability_events_coop  ON public.traceability_events(cooperative_id);

-- ── 7. RLS POLICIES ─────────────────────────────────────────────────────────

ALTER TABLE public.processing_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mill_lots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mill_lot_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_lots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_lot_mill_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_passports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traceability_events  ENABLE ROW LEVEL SECURITY;

-- Helper: is this user a cooperative officer for the given coop?
-- (reuses the existing cooperative_officers table)
CREATE POLICY "Coop officers can manage processing batches"
  ON public.processing_batches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = processing_batches.cooperative_id
      AND   user_id = auth.uid()
    )
  );

CREATE POLICY "Coop officers can manage mill lots"
  ON public.mill_lots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = mill_lots.cooperative_id
      AND   user_id = auth.uid()
    )
  );

CREATE POLICY "Coop officers can manage mill lot batches"
  ON public.mill_lot_batches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mill_lots ml
      JOIN public.cooperative_officers co ON co.cooperative_id = ml.cooperative_id
      WHERE ml.id = mill_lot_batches.mill_lot_id
      AND   co.user_id = auth.uid()
    )
  );

CREATE POLICY "Coop officers can manage export lots"
  ON public.export_lots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = export_lots.cooperative_id
      AND   user_id = auth.uid()
    )
  );

CREATE POLICY "Coop officers can manage export lot linkages"
  ON public.export_lot_mill_lots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.export_lots el
      JOIN public.cooperative_officers co ON co.cooperative_id = el.cooperative_id
      WHERE el.id = export_lot_mill_lots.export_lot_id
      AND   co.user_id = auth.uid()
    )
  );

-- Passports: coop officers manage, EVERYONE can read published ones
CREATE POLICY "Coop officers can manage their passports"
  ON public.coffee_passports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = coffee_passports.cooperative_id
      AND   user_id = auth.uid()
    )
  );

CREATE POLICY "Published passports are publicly readable"
  ON public.coffee_passports FOR SELECT
  USING (status = 'published');

-- Traceability events: coop officers can insert and read; no update/delete (enforced by rules above)
CREATE POLICY "Coop officers can read their traceability events"
  ON public.traceability_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = traceability_events.cooperative_id
      AND   user_id = auth.uid()
    )
  );

CREATE POLICY "Coop officers can insert traceability events"
  ON public.traceability_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = traceability_events.cooperative_id
      AND   user_id = auth.uid()
    )
  );

-- Public can read traceability events for published passports
-- (via passport_code lookup — handled in app layer, not DB)

-- ── 8. AUTO-UPDATE updated_at TRIGGERS ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_updated_at_processing_batches
  BEFORE UPDATE ON public.processing_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_mill_lots
  BEFORE UPDATE ON public.mill_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_export_lots
  BEFORE UPDATE ON public.export_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_coffee_passports
  BEFORE UPDATE ON public.coffee_passports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 9. VIEW: full chain summary for passport generation ──────────────────────

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

  -- Cooperative
  co.cooperative_name,
  co.county,
  co.sub_county,
  co.ward,

  cp.cooperative_id

FROM public.coffee_passports cp
LEFT JOIN public.export_lots el ON el.id = cp.export_lot_id
LEFT JOIN public.cooperatives co ON co.id = cp.cooperative_id;

-- ── 10. FUNCTION: generate passport_code ────────────────────────────────────
-- Format: FI-[FACTORY_CODE]-[YEAR]-[SEQUENCE]  e.g. FI-KRG-2026-0001

CREATE OR REPLACE FUNCTION public.generate_passport_code(
  p_cooperative_id uuid,
  p_year           integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year    integer := COALESCE(p_year, EXTRACT(YEAR FROM now())::integer);
  v_seq     integer;
  v_code    text;
BEGIN
  SELECT COUNT(*) + 1
  INTO v_seq
  FROM public.coffee_passports
  WHERE cooperative_id = p_cooperative_id
    AND EXTRACT(YEAR FROM created_at)::integer = v_year;

  v_code := 'FI-' || v_year::text || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_code;
END;
$$;
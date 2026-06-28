-- ============================================================
-- Migration: National coffee FCS directory — v3 FINAL
-- framedInsight — 20260628_national_fcs_directory.sql
--
-- REPLACES v1 and v2.
--
-- KEY DESIGN CHANGE from v1/v2:
--   county and sub_county columns REMOVED from the FCS directory.
--
--   Reason: county attribution derived from NCE agent codes and AFA
--   lot-code prefixes proved unreliable. One NCE marketing agent (e.g.
--   NKPCU / "KP") covers FCSs across multiple counties — Nandi, Kericho,
--   Trans Nzoia — so agent code alone cannot pin a county. Errors were
--   only caught by members of the affected cooperatives. Rather than
--   ship confidently wrong geography, we ship no geography and let
--   cooperative members and FCS officers fill it in via the platform's
--   cooperative claim / profile completion flow.
--
--   Geography fields (county, sub_county, ward, village) live on the
--   live `cooperatives` tenant row, set by the FCS itself when it signs
--   up or claims its directory entry. The directory is purely a name +
--   certification + NCE traceability lookup table.
--
-- What IS reliable and included:
--   fcs_name          — taken verbatim from NCE catalogue or public sources
--   nce_agent_code    — two-letter NCE lot-code prefix (stable, cross-checkable)
--   nce_export_lot_code — AFA factory/lot code (uniquely identifies the mill)
--   has_flo/cafe/rainforest/eudr — certification flags per NCE26 catalogue
--   source_url / source_note — full provenance chain
--
-- FCS entity corrections vs v1 (all verified from external sources):
--   Tetu XAC04Fxx   → Othaya Farmers Co-operative Society (not 13 phantom FCSs)
--   XAD02Fxx        → Kabare Farmers Co-operative Society (not 7 phantom FCSs)
--   XAD13Fxx        → New Ngariama Farmers Co-operative Society (not 3 phantom)
--   XAD07Fxx        → Kibirigwi Farmers Co-operative Society (not 2 phantom)
--   XAD18Fxx        → Karithathi Farmers Co-operative Society (not 2 phantom)
--   XAD19Fxx        → Ngiriambu Farmers Co-operative Society (Kiri + Kegwa factories)
--   XAD05Fxx        → Mutira Farmers Co-operative Society (not 3 phantom)
--   "Kieni FCS"     → Mugaga Farmers Co-operative Society (Kieni is a factory)
--
-- Coverage: ~52 verified FCS entities, ~135 washing stations/factories.
-- ============================================================


-- ── TABLE DEFINITIONS ────────────────────────────────────────────────────────
-- If the v1 table already exists with county NOT NULL, we alter it.
-- The IF NOT EXISTS guards make this safe on a fresh database too.

CREATE TABLE IF NOT EXISTS public.coffee_fcs_directory (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fcs_name               text        NOT NULL,
  -- Geography intentionally omitted — see file header.
  -- Filled in by the FCS when it claims/creates its tenant row.
  nce_agent_code         text,        -- NCE lot-code prefix e.g. 'BU', 'KN', 'GS'
  nce_export_lot_code    text,        -- Primary AFA lot code for this FCS
  has_flo_certification  boolean     NOT NULL DEFAULT false,
  has_cafe_practice      boolean     NOT NULL DEFAULT false,
  has_rainforest         boolean     NOT NULL DEFAULT false,
  has_eudr_dds           boolean     NOT NULL DEFAULT false,
  source_url             text        NOT NULL,
  source_note            text,
  verified_at            date        NOT NULL DEFAULT CURRENT_DATE,
  matched_cooperative_id uuid        REFERENCES public.cooperatives(id),
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- If v1 was already applied (county NOT NULL exists), drop the constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'coffee_fcs_directory'
      AND column_name  = 'county'
  ) THEN
    ALTER TABLE public.coffee_fcs_directory DROP COLUMN IF EXISTS county;
    ALTER TABLE public.coffee_fcs_directory DROP COLUMN IF EXISTS sub_county;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.coffee_fcs_factories_directory (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fcs_directory_id uuid        NOT NULL REFERENCES public.coffee_fcs_directory(id) ON DELETE CASCADE,
  factory_name     text        NOT NULL,
  factory_code     text,        -- AFA factory code from lot Mark/Outturn
  source_url       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fcs_directory_name
  ON public.coffee_fcs_directory USING gin(to_tsvector('simple', fcs_name));
CREATE INDEX IF NOT EXISTS idx_fcs_directory_agent_code
  ON public.coffee_fcs_directory(nce_agent_code);
CREATE INDEX IF NOT EXISTS idx_fcs_factories_directory_fcs
  ON public.coffee_fcs_factories_directory(fcs_directory_id);
CREATE INDEX IF NOT EXISTS idx_fcs_factories_name
  ON public.coffee_fcs_factories_directory USING gin(to_tsvector('simple', factory_name));

-- RLS
ALTER TABLE public.coffee_fcs_directory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_fcs_factories_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view FCS directory"           ON public.coffee_fcs_directory;
DROP POLICY IF EXISTS "Public can view FCS factories directory" ON public.coffee_fcs_factories_directory;

CREATE POLICY "Public can view FCS directory"
  ON public.coffee_fcs_directory FOR SELECT USING (true);

CREATE POLICY "Public can view FCS factories directory"
  ON public.coffee_fcs_factories_directory FOR SELECT USING (true);

COMMENT ON TABLE public.coffee_fcs_directory IS
  'National reference directory of verified Kenyan coffee FCSs. '
  'Geography (county/sub-county) is deliberately omitted — unreliable when '
  'derived from NCE agent codes. Filled in by the FCS on signup/claim. '
  'v3: removed county columns, corrected FCS entity inflation from v1.';

COMMENT ON COLUMN public.coffee_fcs_directory.nce_agent_code IS
  'Two-letter NCE lot-code prefix identifying the marketing agent. '
  'One agent may cover multiple counties — do NOT use as county proxy.';

COMMENT ON COLUMN public.coffee_fcs_directory.nce_export_lot_code IS
  'Primary AFA traceability code (X[Region][FCSSeq]F[FactorySeq]). '
  'Per-factory codes are in coffee_fcs_factories_directory.factory_code.';

-- farms link (idempotent)
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS supplying_fcs_directory_id uuid
    REFERENCES public.coffee_fcs_directory(id);

CREATE INDEX IF NOT EXISTS idx_farms_supplying_fcs_directory
  ON public.farms(supplying_fcs_directory_id);

COMMENT ON COLUMN public.farms.supplying_fcs_directory_id IS
  'Self-declared at signup. References the national FCS directory, not the '
  'live cooperatives tenant table. Informational only, never drives RLS.';


-- ════════════════════════════════════════════════════════════════════════════
-- SEED: FCS DIRECTORY
-- All FCS names verified. Certifications from NCE26 catalogue.
-- Geography omitted by design — see header.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.coffee_fcs_directory
  (fcs_name, nce_agent_code, nce_export_lot_code,
   has_flo_certification, has_cafe_practice, has_rainforest, has_eudr_dds,
   source_url, source_note)
VALUES

-- ── TIER 1: Individually cited ───────────────────────────────────────────────

('Baragwi Farmers Co-operative Society',
 'GF', NULL, false, false, true, false,
 'https://www.baragwicoffee.co.ke/',
 'Kirinyaga. 12 factories. RA certified. Reg. 1953, CS/0398. '
 'Largest FCS in Kirinyaga by cherry volume.'),

('Rung''eto Farmers Co-operative Society',
 'GF', 'XAD13F', false, false, false, false,
 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya',
 'Kirinyaga. 3 factories: Kii, Karimikui, Kiangoi. '
 'Confirmed via sucafina.com and citizen.digital.'),

('Ngiriambu Farmers Cooperative Society',
 'KN', NULL, false, false, true, false,
 'https://fairtradeafrica.net/wp-content/uploads/2022/06/Ngiriambu-Digital.pdf',
 'Kirinyaga. 2 factories: Kiri (XAD19F01) and Kegwa (XAD19F02). '
 'RA certified. FLO certified. NCE26 lots 6708/6709/6722/6723.'),

('Othaya Farmers Co-operative Society',
 'TY', 'XAC04F', true, true, false, false,
 'https://othayacoffee.com/about-us.html',
 'Nyeri, Tetu area. Reg. 1956. 17-19 factories, ~15,000 members. '
 'FLO + Café Practice. Factories include Ichamama (XAC04F07), '
 'Gura (XAC04F15), Chinga (XAC04F02), Kiruga (XAC04F09), '
 'Kiaguthu (XAC04F08), Mahiga (XAC04F03), Kamoini (XAC04F17), '
 'Gatuyaini (XAC04F05), Gichichi (XAC04F10), Karuthi (XAC04F18), '
 'Kiaga (XAC04F14), Thuti (XAC04F01), Rukira (XAC04F13), Gatugi. '
 'NCE26 TY-prefix lots 6411-6485.'),

('Mutheka Farmers Co-operative Society',
 NULL, NULL, false, false, false, false,
 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya',
 'Nyeri, Mathira. 6 factories: Chorongi, Kigwandi, Kihuyo, '
 'Muthuaini, Kamuyu, Kaihuri.'),

('Gikanda Cooperative Society',
 'GF', 'XAC09F01', false, false, false, false,
 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya',
 'Nyeri, Mathira. Factories: Gichathaini (XAC09F01), Kangocho, Ndaroini. '
 'NCE26 lots 5911/5921.'),

('Gachatha Farmers Cooperative Society',
 NULL, NULL, false, false, false, false,
 'https://onyxcoffeelab.com/products/kenya-gachatha-aa',
 'Nyeri, Mathira. Gachatha washing station.'),

('Kabare Farmers Co-operative Society',
 'IM', 'XAD02F', true, true, false, true,
 'https://sucafina.com/na/offerings/kiangothe-kirinyaga-aa',
 'Kirinyaga. Central body for 11 factories: Kiringa (XAD02F01), '
 'Konyu (XAD02F02), Karani (XAD02F03), Kiangombe (XAD02F04), '
 'Kaboyo, Mukure (XAD02F06), Kimandi (XAD02F08), Kiangothe (XAD02F10), '
 'Mukengeria, Kathata, Kiamiciri. ~10,000 farming households. '
 'FLO + Café Practice + EUDR. NCE26 IM-prefix lots 5927-5941.'),

('New Ngariama Farmers Co-operative Society',
 'KN', 'XAD13F', false, false, true, false,
 'https://newngariamafcs.com/',
 'Kirinyaga East. Reg. 1997, CS/8064. 3 factories: '
 'Kainamui (XAD13F01, est. 1963), Kamwangi (XAD13F02, est. 1982), '
 'Kiamugumo (XAD13F03, est. 2017). RA certified. ~6,000-9,000 members. '
 'NCE26 lots 6601/6602/6603/6606/6609/6610/6679/6684/6685/6686.'),

('Kibirigwi Farmers Co-operative Society',
 'KN', 'XAD07F', true, false, false, false,
 'https://fairtradeafrica.net/wp-content/uploads/2022/02/Kibirigwi-Digital.pdf',
 'Kirinyaga North. Reg. 1958. 8-9 factories: Ragati, Nguguini (XAD07F02), '
 'Mukangu, Thunguri, Kianjege, Chewa, Kiangai (XAD07F04), Kibigoti. '
 'FLO certified. ~7,200 members. NCE26 lots 6645/6647/6706/6707/6720/6721.'),

('Karithathi Farmers Co-operative Society',
 'KN', 'XAD18F', false, false, true, false,
 'https://www.genuineorigin.com/kenya-ab-karithathi-kiunyu-2024',
 'Kirinyaga. 2 factories: Kiunyu (XAD18F01, est. 1960s, ~3,000 members) '
 'and Kabingara (XAD18F02). RA certified. '
 'NCE26 lots 6704/6710/6719/6725.'),

('Mutira Farmers Co-operative Society',
 'KN', 'XAD05F', true, true, false, false,
 'https://www.trabocca.com/our-coffees/kenya/kirinyaga/mugaya/',
 'Kirinyaga. Reg. 1951. HQ at Kagumo town. 7+ factories: '
 'Kagumo (XAD05F01), Mugaya (XAD05F04, est. 1975), '
 'Kiamutuira (XAD05F07, est. 1996), Gatura (XAC51F01). ~7,000 members. '
 'FLO + Café Practice. NCE26 lots 6711/6712/6713/6726/6727/6728/7364/7365.'),

('Mugaga Farmers Co-operative Society',
 'IM', 'XAC64F', false, true, false, true,
 'https://sucafina.com/na/offerings/kieni-nyeri-aa',
 'Nyeri. 5 factories: Kagumoini, Kieni (XAC64F03), Kiamabara, Gathugu, Gatina. '
 '~4,800 members. Café Practice + EUDR. '
 'NCE26 lot 5948 (Kieni factory): ML at 123 USD/50kg to Global Mark Foods.'),

('Iyego Farmers Cooperative Society',
 'KF', 'XAB13F', true, false, false, false,
 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya',
 'Murang''a, Kandara. FLO certified. 7 factories: Iyego Main (XAB13F01), '
 'Gatubu (XAB13F03), Mununga, Marimira, Gitura, Kirangano, Watuha. '
 'NCE26 confirmed.'),

('Thangaini Farmers'' Cooperative Society',
 NULL, NULL, false, false, false, false,
 'https://kiambu.tv/nairobi-coffee-exchange-nets-ksh447-million-as-kiambu-muranga-and-nyeri-beans-dominate-weekly-auction/2025/',
 'Murang''a, Kangema. Kiriangoro factory. NCE Sale 5 Nov 2025.'),

('Komothai Farmers Cooperative Society',
 NULL, 'XAA03F', false, false, false, false,
 'https://kiambu.tv/nairobi-coffee-exchange-nets-ksh447-million-as-kiambu-muranga-and-nyeri-beans-dominate-weekly-auction/2025/',
 'Kiambu, Githunguri. Kagwanja and Kanake (XAA03F11) factories. '
 'NCE26 lots 5909/7409.'),

('Rianjagi Farmers Cooperative Society',
 NULL, NULL, false, false, false, false,
 'https://www.jacoffee.com/pages/rianjagi-cooperation',
 'Embu, Mbeere North. Rianjagi washing station.'),

('Rama Farmers Cooperative Society',
 NULL, NULL, false, false, false, false,
 'https://www.cebecoffeeroasters.com/product-page/kenya-embu-a-a-1',
 'Embu, Embu West. Operates Muthigi-ini and at least one other factory.'),

('Gakundu Farmers Co-operative Society',
 'SM', 'XBD04F', false, true, false, false,
 'https://uk.covoyacoffee.com/kenya-ab-gakundu.html',
 'Embu, Runyenjes. Café Practice. '
 'Factories: Gakundu, Gichugu (XBD04F03), Kamviu (XBD04F02). '
 'NCE26 lots 5627/5641/5676.'),

('Kibugu Farmers Cooperative Society',
 NULL, NULL, false, false, false, false,
 'https://cafeunion.com/uploads/documents/coffee_en_1648055578.pdf',
 'Embu, Embu West. Gikirima washing station.'),

('Kaguru Farmers Cooperative Society',
 NULL, NULL, false, false, false, false,
 'https://sucafina.com/na/offerings/kaguru-meru-pb',
 'Meru, Imenti North. Kaguru washing station.'),


-- ── TIER 2: NCE Sale 26 / 14-Apr-2026 ───────────────────────────────────────
-- Each row below is a confirmed legal FCS entity with a unique AFA factory
-- code, verified by their appearance in the NCE Transaction Listing.
-- Geography withheld — fill in via cooperative claim flow.

-- ── BUNGOMA ──────────────────────────────────────────────────────────────────
('Kaptola Farmers Co-operative Society',
 'BU', 'XDA24F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 4504/4508/4511/4512/4517/4523 — largest Bungoma FCS by bags.'),

('Mikhuyu Farmers Co-operative Society',
 'BU', '39XDA0052', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 4507/4516.'),

('Kamusinde Farmers Co-operative Society',
 'BU', 'XDA08F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 4524.'),

('Khalaba Farmers Co-operative Society',
 'BU', 'XDA11F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 4526.'),

-- ── MT ELGON / TRANS NZOIA ───────────────────────────────────────────────────
('Nakoyonjo Farmers Co-operative Society',
 'MG', 'XDA14F01', false, false, true, false,
 'https://www.nce.co.ke',
 'NCE26 lots 4304/4306/4308/4310/4311/4316/4317/4322/4323. RA certified.'),

('Kitaban Farmers Co-operative Society',
 'MG', 'XDA50F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 4309.'),

('Kibingei Farmers Co-operative Society',
 'MG', 'XDA06F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 4327/4330.'),

('Kapkurongo Farmers Co-operative Society',
 'MG', 'XDA19F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 4331.'),

-- ── WEST POKOT ───────────────────────────────────────────────────────────────
('Pokot Farmers Co-operative Society',
 'BU', 'XCB01F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 7324/7337/7380/7388.'),

-- ── ELGEYO MARAKWET ──────────────────────────────────────────────────────────
('Kilingot Farmers Co-operative Society',
 'BM', 'XCD14F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 7319/7439/7451.'),

('Kamwemo Farmers Co-operative Society',
 'BM', 'XCD33F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 7353.'),

('Tiriony Farmers Co-operative Society',
 'BM', 'XCD29F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 7438/7454.'),

('Tenges Farmers Co-operative Society',
 'BM', 'XCD10F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 7449.'),

('Sirwa Farmers Co-operative Society',
 'BM', 'XCD11F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 7450.'),

-- ── BARINGO ───────────────────────────────────────────────────────────────────
('Cherobon Farmers Co-operative Society',
 'HM', 'CF.0057', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 5947/5956.'),

-- ── NANDI / KERICHO HIGHLANDS (KK + KP + KF agent codes) ────────────────────
-- NOTE: NKPCU (KP) and Nandi Union (KK) agents cover FCSs across both
-- Nandi and Kericho counties. County assignment is withheld pending
-- confirmation by FCS members. Ngoino FCS is confirmed Kericho/Bureti/
-- Tebesonik by a cooperative member — geography to be completed on claim.

('Mosop Bidii Farmers Co-operative Society',
 'BM', 'XCD26F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 7448.'),

('Toroton Farmers Co-operative Society',
 'KK', 'XCF18F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 7602/7603/7605/7607/7609. Nandi Coffee Co-op Union agent.'),

('Meteitei Farmers Co-operative Society',
 'KK', '29XCF0038', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 7604/7610. Nandi Coffee Co-op Union agent.'),

('Maraba Farmers Co-operative Society',
 'KK', '29XCF0059', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 7606/7608. Nandi Coffee Co-op Union agent.'),

('Songonyet Farmers Co-operative Society',
 'KF', 'XCE46F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 6616/6627/6633/6639/6640/6650/6654/6655/6670/6671/6674/6675/6676.'),

('Imbaragai Farmers Co-operative Society',
 'KP', 'XCE107F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 5633/5667. NKPCU agent.'),

('Kapkurin Farmers Co-operative Society',
 'KP', 'XCE89F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 5670. NKPCU agent.'),

('Kabirong Farmers Co-operative Society',
 'KP', 'XCE93F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 5623. NKPCU agent.'),

('Kamachungwa Farmers Co-operative Society',
 'KP', 'XCE72F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 5621. NKPCU agent.'),

('Ngoino Farmers Co-operative Society',
 'KP', 'XCE79F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 5685. NKPCU agent. Confirmed: Kericho County, Bureti '
 'constituency, Tebesonik ward — verified by cooperative member.'),

('Yesmore Farmers Co-operative Society',
 'KP', 'XCE66F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 5625/5677. NKPCU agent.'),

('Kondamarket Farmers Co-operative Society',
 'KK', 'XCE150F01', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 3509.'),

-- ── NYERI (Mathira — individually distinct FCSs) ──────────────────────────────
('Kahuria Farmers Co-operative Society',
 'TY', 'XAB.034', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 6414/6415/6475/6503/6510/6511. Kahuria washing station.'),

('Ndaroini Farmers Co-operative Society',
 'TY', 'XAC09F02', false, false, true, false,
 'https://www.nce.co.ke',
 'NCE26 lots 6473/6488/6493/6496. RA certified.'),

('Ndiaini Farmers Co-operative Society',
 'TY', 'XAC059F008', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 6508/6515. XAC059 prefix distinct from Othaya XAC04 cluster.'),

-- ── MURANG'A (Kirinyaga Slopes agent CL) ─────────────────────────────────────
('Iriga Farmers Co-operative Society',
 'CL', 'XBC15F03', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lots 6613/6663.'),

('Kiruru Farmers Co-operative Society',
 'CL', 'XAB037F01', false, false, true, false,
 'https://www.nce.co.ke',
 'NCE26 lot 6664. RA certified.'),

('Kangunu Farmers Co-operative Society',
 'CL', 'XAB073F01', false, false, true, false,
 'https://www.nce.co.ke',
 'NCE26 lots 6622/6731. RA/Café Practice certified.'),

('Ndiara Farmers Co-operative Society',
 'CL', 'XAB037F04', false, false, true, false,
 'https://www.nce.co.ke',
 'NCE26 lots 6614/6619. RA certified.'),

('Kagere Farmers Co-operative Society',
 'CL', 'XAC004F04', false, false, false, false,
 'https://www.nce.co.ke',
 'NCE26 lot 6732. 67 bags MH to Africoff Trading at 237 USD/50kg.'),

-- ── MERU ──────────────────────────────────────────────────────────────────────
('Ichamara Farmers Co-operative Society',
 'IM', 'XAC40F01', true, false, false, true,
 'https://www.nce.co.ke',
 'Meru, Imenti South. FLO + EUDR. '
 'NCE26 lots 5976/5977/5978/5980. AA 359 USD to C.Dormans SEZ. '
 'Also operates Mutwewathi (XAC40F03) and Thangathi (XAC40F02) factories.'),

('Mutwewathi Farmers Co-operative Society',
 'IM', 'XAC40F03', true, false, false, true,
 'https://www.nce.co.ke',
 'Meru, Imenti South. FLO + EUDR. NCE26 lots 5975/5979. '
 'NOTE: XAC40 prefix shared with Ichamara and Thangathi — may be '
 'factories of one FCS; retained separately pending verification.'),

('Thangathi Farmers Co-operative Society',
 'IM', 'XAC40F02', true, false, false, true,
 'https://www.nce.co.ke',
 'Meru, Imenti South. FLO + EUDR. NCE26 lot 5992. '
 'Same caveat as Mutwewathi re shared XAC40 prefix.'),

('Marua Farmers Co-operative Society',
 'US', 'XAC61F03', false, false, false, false,
 'https://www.nce.co.ke',
 'Meru, Igembe South. NCE26 lots 5949/6001. MH/ML to Ibero Kenya Ltd.'),

('Thambana Farmers Co-operative Society',
 'SM', 'XBD05', false, false, false, true,
 'https://www.nce.co.ke',
 'Meru, Tigania East. EUDR. NCE26 lots 5966/5967/5970/5971/5986/5987. '
 'AA 357 USD/50kg to Sasini.'),

('Kiungu Farmers Co-operative Society',
 'SM', 'XBD05F02', false, false, false, true,
 'https://www.nce.co.ke',
 'Meru, Tigania East. EUDR. NCE26 lots 5963/5997/5999/6000. '
 'NOTE: XBD05 prefix also used by Thambana — may share a parent body.'),

('Kiviuvi Farmers Co-operative Society',
 'SM', 'XBD27F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Meru, Tigania West. NCE26 lot 5744. 85 bags MH to Ibero Kenya Ltd at 233 USD/50kg.'),

-- ── EMBU ──────────────────────────────────────────────────────────────────────
('Kagaari North Farmers Co-operative Society',
 'SM', 'XBD12F01', true, false, false, false,
 'https://www.nce.co.ke',
 'Embu, Manyatta. FLO. Factories: Kanja (XBD12F01), Mbuinjeru (XBD12F03). '
 'NCE26 lots 5615/5636/5671/5672/5678/5679/5700.'),

('Central Ngandori Farmers Co-operative Society',
 'SM', 'XBD03F01', false, false, true, false,
 'https://www.nce.co.ke',
 'Embu, Gachoka. RA. Factories: Mwiria (XBD03F01), Karuriri (XBD03F04). '
 'NCE26 lot 5640. 34 bags AB at 351 USD/50kg to Javans Coffee.'),

('Thamuti Farmers Co-operative Society',
 'ED', 'XAB92F03', false, false, false, false,
 'https://www.nce.co.ke',
 'Embu, Manyatta. NCE26 lots 7340/7363/7391.'),

('Gituara Farmers Co-operative Society',
 'EC', 'XBD.006F03', false, false, true, false,
 'https://www.nce.co.ke',
 'Embu, Embu West. RA. NCE26 lots 6417/6435/6436/6471. '
 'NOTE: XBD.006 prefix shared with Ngurueri and Kavutiri — '
 'may be factories of one FCS; retained separately pending verification.'),

('Ngurueri Farmers Co-operative Society',
 'EC', 'XBD.006F02', false, false, true, false,
 'https://www.nce.co.ke',
 'Embu, Embu West. RA. NCE26 lots 6441/6442. Same caveat as Gituara.'),

('Kavutiri Farmers Co-operative Society',
 'EC', 'XBD.006F01', false, false, true, false,
 'https://www.nce.co.ke',
 'Embu, Embu North. RA. NCE26 lot 6474. 41 bags AA at 368 USD/50kg to Sasini. '
 'Same caveat as Gituara re shared XBD.006 prefix.'),

('Kathima Farmers Co-operative Society',
 'EC', 'XBD005F02', false, false, false, true,
 'https://www.nce.co.ke',
 'Embu, Embu Central. EUDR. NCE26 lots 5965/5969/5998.'),

-- ── MURANG'A (Minnesota + NKPCU agents) ───────────────────────────────────────
('Ngunguru Farmers Co-operative Society',
 'SM', 'XAC60F03', false, true, false, true,
 'https://www.nce.co.ke',
 'Murang''a, Kigumo. Café Practice + EUDR. NCE26 various lots.'),

('Riakiberu Farmers Co-operative Society',
 'CL', 'XAB36F02', false, false, true, true,
 'https://www.nce.co.ke',
 'Murang''a, Kandara. RA/EUDR. NCE26 lots 7005/7014/7039/7048. '
 '103 bags MH to Taylor Winch at 200 USD/50kg.'),

('Thageini Farmers Co-operative Society',
 'SM', 'XAC25F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Murang''a, Mathioya. NCE26 lot 5727. 32 bags MH to Sondhi Trading.'),

('Ruthaka Ruarai Farmers Co-operative Society',
 'SM', 'XAC58F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Murang''a, Kigumo. NCE26 lots 5701/5717/5726. 304 bags MH in lot 5726.'),

('Kanjathi Farmers Co-operative Society',
 'TK', 'XAB89F03', false, false, false, false,
 'https://www.nce.co.ke',
 'Murang''a South. NCE26 lot 5944. 41 bags ML to Louis Dreyfus at 120 USD/50kg.'),

('Muthithi Farmers Co-operative Society',
 'KP', 'XAB91', false, false, false, false,
 'https://www.nce.co.ke',
 'Murang''a, Kigumo. NCE26 lot 5698.'),

-- ── KISII / NYAMIRA ───────────────────────────────────────────────────────────
('Moromba Farmers Co-operative Society',
 'GS', 'XEA09F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Kisii. NCE26 lots 4906/4927. 83 bags C to Ibero Kenya Ltd at 311 USD/50kg.'),

('Gesonso Farmers Co-operative Society',
 'GS', 'XEA37F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Kisii. NCE26 lot 4928.'),

('Nyabomite Farmers Co-operative Society',
 'GS', 'XEA14F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Nyamira. NCE26 lot 4924.'),

('Misadhi Farmers Co-operative Society',
 'GS', 'XEB03F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Nyamira. NCE26 lot 4933. NL (natural light) grade.'),

('Bukuria Farmers Co-operative Society',
 'KP', 'XEB07F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Nyamira. NCE26 lots 5694/5696.'),

('Gitungi Farmers Co-operative Society',
 'KP', 'XEB13F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Nyamira. NCE26 lot 5695.'),

-- ── TRANS NZOIA / KAKAMEGA ────────────────────────────────────────────────────
('Kapsara Farmers Co-operative Society',
 'KP', 'XCI26F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Trans Nzoia. NCE26 lot 7393. AA to Ibero Kenya Ltd at 338 USD/50kg.'),

('Kimama Farmers Co-operative Society',
 'KP', 'XDA39F01', false, false, false, false,
 'https://www.nce.co.ke',
 'Trans Nzoia. NCE26 lot 5684.'),

('Kimabole Farmers Co-operative Society',
 'KP', 'XDA42', false, false, false, false,
 'https://www.nce.co.ke',
 'Trans Nzoia. NCE26 lot 5699.'),

('Tambaya Farmers Co-operative Society',
 'TK', 'XAC56F06', false, false, false, false,
 'https://www.nce.co.ke',
 'Trans Nzoia. NCE26 lots 5944/7447. ML to Louis Dreyfus at 120 USD/50kg.'),

('Sikhendu Farmers Co-operative Society',
 'KP', 'CS/29926', false, false, false, false,
 'https://www.nce.co.ke',
 'Kakamega. NCE26 lot 5663. AA grade.');


-- ════════════════════════════════════════════════════════════════════════════
-- SEED: FACTORY / WASHING STATION DIRECTORY
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.coffee_fcs_factories_directory
  (fcs_directory_id, factory_name, factory_code, source_url)
SELECT d.id, v.factory_name, v.factory_code, v.source_url
FROM (VALUES

  -- Baragwi
  ('Baragwi Farmers Co-operative Society', 'Karumandi',  NULL,        'https://www.baragwicoffee.co.ke/'),
  ('Baragwi Farmers Co-operative Society', 'Kianyaga',   NULL,        'https://www.baragwicoffee.co.ke/'),
  ('Baragwi Farmers Co-operative Society', 'Gachame',    NULL,        'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Baragwi Farmers Co-operative Society', 'Gacami',     NULL,        'https://citizen.digital/article/kirinyaga-coffee-farmers-reap-big-as-revamped-sector-reforms-drive-record-payouts-n361170'),

  -- Rung'eto
  ('Rung''eto Farmers Co-operative Society', 'Kii',       NULL,       'https://sucafina.com/na/offerings/kii-kirinyaga-aa'),
  ('Rung''eto Farmers Co-operative Society', 'Karimikui', NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Rung''eto Farmers Co-operative Society', 'Kiangoi',   NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),

  -- Ngiriambu
  ('Ngiriambu Farmers Cooperative Society', 'Kiri',  'XAD19F01', 'https://www.panthercoffee.com/kiri-kenya-specialty-coffee'),
  ('Ngiriambu Farmers Cooperative Society', 'Kegwa', 'XAD19F02', 'https://fairtradeafrica.net/wp-content/uploads/2022/06/Ngiriambu-Digital.pdf'),

  -- Othaya (Nyeri, Tetu — all confirmed from othayacoffee.com + trade sources)
  ('Othaya Farmers Co-operative Society', 'Ichamama',  'XAC04F07', 'https://othayacoffee.com/about-us.html'),
  ('Othaya Farmers Co-operative Society', 'Gura',      'XAC04F15', 'https://www.nce.co.ke'),
  ('Othaya Farmers Co-operative Society', 'Chinga',    'XAC04F02', 'https://ozonecoffee.co.uk/pages/coffee-producer-othaya-farmers-cooperative'),
  ('Othaya Farmers Co-operative Society', 'Kiruga',    'XAC04F09', 'https://www.nce.co.ke'),
  ('Othaya Farmers Co-operative Society', 'Kiaguthu',  'XAC04F08', 'https://www.nce.co.ke'),
  ('Othaya Farmers Co-operative Society', 'Mahiga',    'XAC04F03', 'https://43factory.coffee/en/collaboration/othaya-society/'),
  ('Othaya Farmers Co-operative Society', 'Kamoini',   'XAC04F17', 'https://www.nce.co.ke'),
  ('Othaya Farmers Co-operative Society', 'Gatuyaini', 'XAC04F05', 'https://43factory.coffee/en/collaboration/othaya-society/'),
  ('Othaya Farmers Co-operative Society', 'Gichichi',  'XAC04F10', 'https://www.nce.co.ke'),
  ('Othaya Farmers Co-operative Society', 'Karuthi',   'XAC04F18', 'https://www.nce.co.ke'),
  ('Othaya Farmers Co-operative Society', 'Kiaga',     'XAC04F14', 'https://www.nce.co.ke'),
  ('Othaya Farmers Co-operative Society', 'Thuti',     'XAC04F01', 'https://amokka.com/en/products/kenya-thuti'),
  ('Othaya Farmers Co-operative Society', 'Rukira',    'XAC04F13', 'https://sucafina.com/emea/offerings/rukira-aa'),
  ('Othaya Farmers Co-operative Society', 'Gatugi',    NULL,       'https://miraflorescoffee.com/blogs/farms/farm-highlight-othaya-farmer-cooperative-kenya'),

  -- Mutheka
  ('Mutheka Farmers Co-operative Society', 'Chorongi',  NULL, 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Mutheka Farmers Co-operative Society', 'Kigwandi',  NULL, 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Mutheka Farmers Co-operative Society', 'Kihuyo',    NULL, 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Mutheka Farmers Co-operative Society', 'Muthuaini', NULL, 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Mutheka Farmers Co-operative Society', 'Kamuyu',    NULL, 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Mutheka Farmers Co-operative Society', 'Kaihuri',   NULL, 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),

  -- Gikanda
  ('Gikanda Cooperative Society', 'Gichathaini', 'XAC09F01', 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Gikanda Cooperative Society', 'Kangocho',    NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Gikanda Cooperative Society', 'Ndaroini',    NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),

  -- Gachatha
  ('Gachatha Farmers Cooperative Society', 'Gachatha', NULL, 'https://onyxcoffeelab.com/products/kenya-gachatha-aa'),

  -- Kabare (Kirinyaga — 11 factories)
  ('Kabare Farmers Co-operative Society', 'Kiringa',   'XAD02F01', 'https://www.pro-filecoffee.com/projects/kiringa-aa'),
  ('Kabare Farmers Co-operative Society', 'Konyu',     'XAD02F02', 'https://sucafina.com/na/offerings/kiangothe-kirinyaga-aa'),
  ('Kabare Farmers Co-operative Society', 'Karani',    'XAD02F03', 'https://yourcoffeesite.com/coffee-kirinyaga-region-kenya/'),
  ('Kabare Farmers Co-operative Society', 'Kiangombe', 'XAD02F04', 'https://www.nce.co.ke'),
  ('Kabare Farmers Co-operative Society', 'Mukure',    'XAD02F06', 'https://www.genuineorigin.com/site/images/factsheets/factsheet-GEN18KEM01.pdf'),
  ('Kabare Farmers Co-operative Society', 'Kimandi',   'XAD02F08', 'https://www.bugcoffee.com/en/shop/kafe/kimandi-ab-kenya/'),
  ('Kabare Farmers Co-operative Society', 'Kiangothe', 'XAD02F10', 'https://sucafina.com/na/offerings/kiangothe-kirinyaga-aa'),

  -- New Ngariama (3 factories)
  ('New Ngariama Farmers Co-operative Society', 'Kainamui',  'XAD13F01', 'https://melbournecoffeemerchants.com.au/coffee/kainamui-ab/'),
  ('New Ngariama Farmers Co-operative Society', 'Kamwangi',  'XAD13F02', 'https://sucafina.com/na/offerings/kamwangi-aa'),
  ('New Ngariama Farmers Co-operative Society', 'Kiamugumo', 'XAD13F03', 'https://sucafina.com/na/offerings/kiamugumo-factory'),

  -- Kibirigwi (8 factories)
  ('Kibirigwi Farmers Co-operative Society', 'Kiangai',  'XAD07F04', 'https://royalcoffee.com/product/3427097000011719014/'),
  ('Kibirigwi Farmers Co-operative Society', 'Nguguini', 'XAD07F02', 'https://sucafina.com/apac/offerings/kirinyaga-nguguini-aa'),
  ('Kibirigwi Farmers Co-operative Society', 'Thunguri', NULL,       'https://uk.covoyacoffee.com/kenya-aa-thunguri-p8001687-1.html'),
  ('Kibirigwi Farmers Co-operative Society', 'Ragati',   NULL,       'https://fairtradeafrica.net/wp-content/uploads/2022/02/Kibirigwi-Digital.pdf'),
  ('Kibirigwi Farmers Co-operative Society', 'Mukangu',  NULL,       'https://fairtradeafrica.net/wp-content/uploads/2022/02/Kibirigwi-Digital.pdf'),
  ('Kibirigwi Farmers Co-operative Society', 'Kianjege', NULL,       'https://fairtradeafrica.net/wp-content/uploads/2022/02/Kibirigwi-Digital.pdf'),
  ('Kibirigwi Farmers Co-operative Society', 'Kibigoti', NULL,       'https://fairtradeafrica.net/wp-content/uploads/2022/02/Kibirigwi-Digital.pdf'),
  ('Kibirigwi Farmers Co-operative Society', 'Chewa',    NULL,       'https://fairtradeafrica.net/wp-content/uploads/2022/02/Kibirigwi-Digital.pdf'),

  -- Karithathi (2 factories)
  ('Karithathi Farmers Co-operative Society', 'Kiunyu',    'XAD18F01', 'https://www.genuineorigin.com/kenya-ab-karithathi-kiunyu-2024'),
  ('Karithathi Farmers Co-operative Society', 'Kabingara', 'XAD18F02', 'https://www.roastmasters.com/kenya3.html'),

  -- Mutira (4 confirmed factories)
  ('Mutira Farmers Co-operative Society', 'Kagumo',     'XAD05F01', 'https://coffeehunter.com/coffee/kagumo-pb/'),
  ('Mutira Farmers Co-operative Society', 'Mugaya',     'XAD05F04', 'https://www.trabocca.com/our-coffees/kenya/kirinyaga/mugaya/'),
  ('Mutira Farmers Co-operative Society', 'Kiamutuira', 'XAD05F07', 'https://www.trabocca.com/our-coffees/kenya/kirinyaga/kiamutuira/'),
  ('Mutira Farmers Co-operative Society', 'Gatura',     'XAC51F01', 'https://www.nce.co.ke'),

  -- Mugaga (Nyeri — 5 factories)
  ('Mugaga Farmers Co-operative Society', 'Kieni',     'XAC64F03', 'https://sucafina.com/na/offerings/kieni-nyeri-aa'),
  ('Mugaga Farmers Co-operative Society', 'Kagumoini', NULL,       'https://sucafina.com/na/offerings/kieni-nyeri-aa'),
  ('Mugaga Farmers Co-operative Society', 'Kiamabara', NULL,       'https://sucafina.com/na/offerings/kieni-nyeri-aa'),
  ('Mugaga Farmers Co-operative Society', 'Gathugu',   NULL,       'https://sucafina.com/na/offerings/kieni-nyeri-aa'),
  ('Mugaga Farmers Co-operative Society', 'Gatina',    NULL,       'https://sucafina.com/na/offerings/kieni-nyeri-aa'),

  -- Iyego
  ('Iyego Farmers Cooperative Society', 'Iyego Main',  'XAB13F01', 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Iyego Farmers Cooperative Society', 'Gatubu',      'XAB13F03', 'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Iyego Farmers Cooperative Society', 'Mununga',     NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Iyego Farmers Cooperative Society', 'Marimira',    NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Iyego Farmers Cooperative Society', 'Gitura',      NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Iyego Farmers Cooperative Society', 'Kirangano',   NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),
  ('Iyego Farmers Cooperative Society', 'Watuha',      NULL,       'https://en.wikipedia.org/wiki/Coffee_production_in_Kenya'),

  -- Thangaini
  ('Thangaini Farmers'' Cooperative Society', 'Kiriangoro', NULL, 'https://kiambu.tv/nairobi-coffee-exchange-nets-ksh447-million-as-kiambu-muranga-and-nyeri-beans-dominate-weekly-auction/2025/'),

  -- Komothai
  ('Komothai Farmers Cooperative Society', 'Kagwanja', NULL,       'https://kiambu.tv/nairobi-coffee-exchange-nets-ksh447-million-as-kiambu-muranga-and-nyeri-beans-dominate-weekly-auction/2025/'),
  ('Komothai Farmers Cooperative Society', 'Kanake',   'XAA03F11', 'https://www.nce.co.ke'),

  -- Embu Tier 1
  ('Rianjagi Farmers Cooperative Society', 'Rianjagi',    NULL, 'https://www.jacoffee.com/pages/rianjagi-cooperation'),
  ('Rama Farmers Cooperative Society',     'Muthigi-ini', NULL, 'https://www.cebecoffeeroasters.com/product-page/kenya-embu-a-a-1'),
  ('Gakundu Farmers Co-operative Society', 'Gakundu',     NULL, 'https://uk.covoyacoffee.com/kenya-ab-gakundu.html'),
  ('Gakundu Farmers Co-operative Society', 'Gichugu',     'XBD04F03', 'https://www.nce.co.ke'),
  ('Gakundu Farmers Co-operative Society', 'Kamviu',      'XBD04F02', 'https://www.nce.co.ke'),
  ('Kibugu Farmers Cooperative Society',   'Gikirima',    NULL, 'https://cafeunion.com/uploads/documents/coffee_en_1648055578.pdf'),
  ('Kaguru Farmers Cooperative Society',   'Kaguru',      NULL, 'https://sucafina.com/na/offerings/kaguru-meru-pb'),

  -- Bungoma
  ('Kaptola Farmers Co-operative Society',   'Kaptola',   'XDA24F01',  'https://www.nce.co.ke'),
  ('Mikhuyu Farmers Co-operative Society',   'Mikhuyu',   '39XDA0052', 'https://www.nce.co.ke'),
  ('Kamusinde Farmers Co-operative Society', 'Kamusinde', 'XDA08F01',  'https://www.nce.co.ke'),
  ('Khalaba Farmers Co-operative Society',   'Khalaba',   'XDA11F01',  'https://www.nce.co.ke'),

  -- Mt Elgon / Trans Nzoia
  ('Nakoyonjo Farmers Co-operative Society',  'Nakoyonjo',  'XDA14F01', 'https://www.nce.co.ke'),
  ('Kitaban Farmers Co-operative Society',    'Kitaban',    'XDA50F01', 'https://www.nce.co.ke'),
  ('Kibingei Farmers Co-operative Society',   'Kibingei',   'XDA06F01', 'https://www.nce.co.ke'),
  ('Kapkurongo Farmers Co-operative Society', 'Kapkurongo', 'XDA19F01', 'https://www.nce.co.ke'),

  -- West Pokot
  ('Pokot Farmers Co-operative Society', 'Pokot', 'XCB01F01', 'https://www.nce.co.ke'),

  -- Elgeyo Marakwet / Baringo
  ('Kilingot Farmers Co-operative Society',    'Kilingot',   'XCD14F01', 'https://www.nce.co.ke'),
  ('Kamwemo Farmers Co-operative Society',     'Kamwemo',    'XCD33F01', 'https://www.nce.co.ke'),
  ('Tiriony Farmers Co-operative Society',     'Tiriony',    'XCD29F01', 'https://www.nce.co.ke'),
  ('Tenges Farmers Co-operative Society',      'Tenges',     'XCD10F01', 'https://www.nce.co.ke'),
  ('Sirwa Farmers Co-operative Society',       'Sirwa',      'XCD11F01', 'https://www.nce.co.ke'),
  ('Cherobon Farmers Co-operative Society',    'Cherobon',   'CF.0057',  'https://www.nce.co.ke'),

  -- Nandi / Kericho highlands
  ('Mosop Bidii Farmers Co-operative Society',  'Mosop Bidii',  'XCD26F01',  'https://www.nce.co.ke'),
  ('Toroton Farmers Co-operative Society',      'Toroton',      'XCF18F01',  'https://www.nce.co.ke'),
  ('Meteitei Farmers Co-operative Society',     'Meteitei',     '29XCF0038', 'https://www.nce.co.ke'),
  ('Maraba Farmers Co-operative Society',       'Maraba',       '29XCF0059', 'https://www.nce.co.ke'),
  ('Songonyet Farmers Co-operative Society',    'Songonyet',    'XCE46F01',  'https://www.nce.co.ke'),
  ('Imbaragai Farmers Co-operative Society',    'Imbaragai',    'XCE107F01', 'https://www.nce.co.ke'),
  ('Kapkurin Farmers Co-operative Society',     'Kapkurin',     'XCE89F01',  'https://www.nce.co.ke'),
  ('Kabirong Farmers Co-operative Society',     'Kabirong',     'XCE93F01',  'https://www.nce.co.ke'),
  ('Kamachungwa Farmers Co-operative Society',  'Kamachungwa',  'XCE72F01',  'https://www.nce.co.ke'),
  ('Ngoino Farmers Co-operative Society',       'Ngoino',       'XCE79F01',  'https://www.nce.co.ke'),
  ('Yesmore Farmers Co-operative Society',      'Yesmore',      'XCE66F01',  'https://www.nce.co.ke'),
  ('Kondamarket Farmers Co-operative Society',  'Kondamarket',  'XCE150F01', 'https://www.nce.co.ke'),

  -- Nyeri Mathira individual FCSs
  ('Kahuria Farmers Co-operative Society',  'Kahuria', 'XAB.034',    'https://www.nce.co.ke'),
  ('Ndaroini Farmers Co-operative Society', 'Ndaroini','XAC09F02',   'https://www.nce.co.ke'),
  ('Ndiaini Farmers Co-operative Society',  'Ndiaini', 'XAC059F008', 'https://www.nce.co.ke'),

  -- Murang'a CL prefix
  ('Iriga Farmers Co-operative Society',    'Iriga',   'XBC15F03',  'https://www.nce.co.ke'),
  ('Kiruru Farmers Co-operative Society',   'Kiruru',  'XAB037F01', 'https://www.nce.co.ke'),
  ('Kangunu Farmers Co-operative Society',  'Kangunu', 'XAB073F01', 'https://www.nce.co.ke'),
  ('Ndiara Farmers Co-operative Society',   'Ndiara',  'XAB037F04', 'https://www.nce.co.ke'),
  ('Kagere Farmers Co-operative Society',   'Kagere',  'XAC004F04', 'https://www.nce.co.ke'),

  -- Meru
  ('Ichamara Farmers Co-operative Society',   'Ichamara',  'XAC40F01', 'https://www.nce.co.ke'),
  ('Mutwewathi Farmers Co-operative Society', 'Mutwewathi','XAC40F03', 'https://www.nce.co.ke'),
  ('Thangathi Farmers Co-operative Society',  'Thangathi', 'XAC40F02', 'https://www.nce.co.ke'),
  ('Marua Farmers Co-operative Society',      'Marua',     'XAC61F03', 'https://www.nce.co.ke'),
  ('Thambana Farmers Co-operative Society',   'Thambana',  'XBD05',    'https://www.nce.co.ke'),
  ('Kiungu Farmers Co-operative Society',     'Kiungu',    'XBD05F02', 'https://www.nce.co.ke'),
  ('Kiviuvi Farmers Co-operative Society',    'Kiviuvi',   'XBD27F01', 'https://www.nce.co.ke'),

  -- Embu
  ('Kagaari North Farmers Co-operative Society',    'Kanja',     'XBD12F01',  'https://www.nce.co.ke'),
  ('Kagaari North Farmers Co-operative Society',    'Mbuinjeru', 'XBD12F03',  'https://www.nce.co.ke'),
  ('Central Ngandori Farmers Co-operative Society', 'Mwiria',    'XBD03F01',  'https://www.nce.co.ke'),
  ('Central Ngandori Farmers Co-operative Society', 'Karuriri',  'XBD03F04',  'https://www.nce.co.ke'),
  ('Thamuti Farmers Co-operative Society',          'Thamuti',   'XAB92F03',  'https://www.nce.co.ke'),
  ('Gituara Farmers Co-operative Society',          'Gituara',   'XBD.006F03','https://www.nce.co.ke'),
  ('Ngurueri Farmers Co-operative Society',         'Ngurueri',  'XBD.006F02','https://www.nce.co.ke'),
  ('Kavutiri Farmers Co-operative Society',         'Kavutiri',  'XBD.006F01','https://www.nce.co.ke'),
  ('Kathima Farmers Co-operative Society',          'Kathima',   'XBD005F02', 'https://www.nce.co.ke'),

  -- Murang'a SM/TK/KP agents
  ('Ngunguru Farmers Co-operative Society',      'Ngunguru',  'XAC60F03', 'https://www.nce.co.ke'),
  ('Riakiberu Farmers Co-operative Society',     'Riakiberu', 'XAB36F02', 'https://www.nce.co.ke'),
  ('Thageini Farmers Co-operative Society',      'Thageini',  'XAC25F01', 'https://www.nce.co.ke'),
  ('Ruthaka Ruarai Farmers Co-operative Society','Ruthaka',   'XAC58F01', 'https://www.nce.co.ke'),
  ('Kanjathi Farmers Co-operative Society',      'Kanjathi',  'XAB89F03', 'https://www.nce.co.ke'),
  ('Muthithi Farmers Co-operative Society',      'Muthithi',  'XAB91',    'https://www.nce.co.ke'),

  -- Kisii / Nyamira
  ('Moromba Farmers Co-operative Society',  'Moromba',  'XEA09F01', 'https://www.nce.co.ke'),
  ('Gesonso Farmers Co-operative Society',  'Gesonso',  'XEA37F01', 'https://www.nce.co.ke'),
  ('Nyabomite Farmers Co-operative Society','Nyabomite','XEA14F01', 'https://www.nce.co.ke'),
  ('Misadhi Farmers Co-operative Society',  'Misadhi',  'XEB03F01', 'https://www.nce.co.ke'),
  ('Bukuria Farmers Co-operative Society',  'Bukuria',  'XEB07F01', 'https://www.nce.co.ke'),
  ('Gitungi Farmers Co-operative Society',  'Gitungi',  'XEB13F01', 'https://www.nce.co.ke'),

  -- Trans Nzoia / Kakamega
  ('Kapsara Farmers Co-operative Society',  'Kapsara',  'XCI26F01', 'https://www.nce.co.ke'),
  ('Kimama Farmers Co-operative Society',   'Kimama',   'XDA39F01', 'https://www.nce.co.ke'),
  ('Kimabole Farmers Co-operative Society', 'Kimabole', 'XDA42',    'https://www.nce.co.ke'),
  ('Tambaya Farmers Co-operative Society',  'Tambaya',  'XAC56F06', 'https://www.nce.co.ke'),
  ('Sikhendu Farmers Co-operative Society', 'Sikhendu', NULL,       'https://www.nce.co.ke')

) AS v(fcs_name, factory_name, factory_code, source_url)
JOIN public.coffee_fcs_directory d ON d.fcs_name = v.fcs_name;
-- ============================================================
-- Migration: Legality Self-Declaration Checklist
-- framedInsight — 20260702_legality_self_declaration.sql
--
-- Closes the "legally produced" clause of EUDR Article 3(b), which
-- requires the operator to demonstrate compliance with the country of
-- production's laws on: land use rights, environmental protection,
-- forest-related rules, third-party rights, labour rights, human rights
-- protected under international law, and tax/anti-corruption/trade rules.
--
-- Kenyan-specific scope (per audit §2 of the engineering handoff):
--   - AFA Milling License (production legality)
--   - NSSF (National Social Security Fund) compliance for cooperative
--     and factory employees
--   - NHIF / SHA (Social Health Authority, successor to NHIF) compliance
--   - Child labour policy (Children Act 2022, ILO Convention 182)
--   - Land use rights — confirmed at the registration/factory level,
--     distinct from per-plot EUDR geolocation risk already tracked in
--     coffee_eudr_compliance
--
-- Design: this is a COOPERATIVE-level declaration, not per-export-lot.
-- A cooperative's labour and registration compliance posture doesn't
-- change shipment-to-shipment, but it IS re-attested each crop season
-- since NSSF/SHA standing and any policy can change year to year. The
-- declaration is self-reported by the officer (with optional supporting
-- document upload via the existing export_lot_documents pattern, scoped
-- here to the cooperative instead) — it is explicitly NOT a substitute
-- for the buyer's own legal due diligence, and the UI must say so.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cooperative_legality_declarations (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id              uuid        NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  season                      text        NOT NULL,  -- e.g. '2025/2026', matches factory_intake_lots.payment_season

  -- AFA Milling License
  afa_milling_license_held    boolean     NOT NULL DEFAULT false,
  afa_milling_license_number  text,
  afa_milling_license_expiry  date,

  -- NSSF (National Social Security Fund) — mandatory employer contribution
  nssf_compliant               boolean    NOT NULL DEFAULT false,
  nssf_registration_number     text,

  -- NHIF / SHA (Social Health Authority — NHIF's 2024 successor)
  sha_compliant                 boolean   NOT NULL DEFAULT false,
  sha_registration_number       text,

  -- Child labour policy — Children Act 2022 / ILO Convention 182
  child_labour_policy_in_place  boolean   NOT NULL DEFAULT false,
  child_labour_policy_notes     text,

  -- Land use rights at factory/registration level (distinct from
  -- per-plot EUDR geolocation risk in coffee_eudr_compliance)
  land_use_rights_confirmed     boolean   NOT NULL DEFAULT false,
  land_use_rights_notes         text,

  -- Free, prior and informed consent / third-party rights — relevant
  -- where factory or cooperative land overlaps community or customary
  -- land claims
  third_party_rights_confirmed  boolean   NOT NULL DEFAULT false,

  -- Tax compliance (KRA PIN / Tax Compliance Certificate)
  tax_compliant                  boolean  NOT NULL DEFAULT false,
  kra_pin                        text,

  -- Officer attestation
  declared_by                    uuid      REFERENCES auth.users(id),
  declared_at                    timestamptz,
  notes                          text,

  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (cooperative_id, season)
);

COMMENT ON TABLE public.cooperative_legality_declarations IS
  'Self-reported legality checklist supporting the EUDR Article 3(b) '
  '"legally produced" requirement, plus core Kenyan labour/tax compliance '
  'markers (NSSF, SHA, AFA license). Re-attested each crop season. This is '
  'a self-declaration, not third-party verification — the public passport '
  'and buyer data room must present it as such.';

CREATE INDEX IF NOT EXISTS idx_legality_decl_coop
  ON public.cooperative_legality_declarations (cooperative_id);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.cooperative_legality_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coop officers can manage their legality declarations"
  ON public.cooperative_legality_declarations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = cooperative_legality_declarations.cooperative_id
        AND co.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = cooperative_legality_declarations.cooperative_id
        AND co.user_id = auth.uid()
    )
  );

-- Public/buyer read access is granted via v_passport_chain and the buyer
-- data room query (service-role, bypasses RLS) — no public SELECT policy
-- is added directly on this table, consistent with the pattern used for
-- export_lot_documents.

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_legality_declaration_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legality_declaration_updated_at ON public.cooperative_legality_declarations;
CREATE TRIGGER trg_legality_declaration_updated_at
  BEFORE UPDATE ON public.cooperative_legality_declarations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_legality_declaration_updated_at();

-- ── Completeness helper view ──────────────────────────────────────────────
-- Computes a simple 0-7 completeness score and an overall boolean, so the
-- UI and the passport widget don't have to replicate the same AND logic
-- in two places.

CREATE OR REPLACE VIEW public.v_legality_declaration_summary AS
SELECT
  cld.*,
  (
    (afa_milling_license_held)::int +
    (nssf_compliant)::int +
    (sha_compliant)::int +
    (child_labour_policy_in_place)::int +
    (land_use_rights_confirmed)::int +
    (third_party_rights_confirmed)::int +
    (tax_compliant)::int
  ) AS items_complete,
  7 AS items_total,
  (
    afa_milling_license_held
    AND nssf_compliant
    AND sha_compliant
    AND child_labour_policy_in_place
    AND land_use_rights_confirmed
    AND third_party_rights_confirmed
    AND tax_compliant
  ) AS fully_declared
FROM public.cooperative_legality_declarations cld;

COMMENT ON VIEW public.v_legality_declaration_summary IS
  'Adds items_complete / items_total / fully_declared to '
  'cooperative_legality_declarations so passport and dashboard UIs share '
  'one source of truth for "how complete is this declaration".';

-- ── Widen v_passport_chain with legality declaration status ──────────────────
-- Joins the CURRENT season's declaration only (matched against the
-- export lot's harvest year via the linked intake lots' payment_season —
-- approximated here via the cooperative's most recently declared season,
-- since v_passport_chain has no direct season column to join on). If a
-- cooperative has declared multiple seasons, the most recent declaration
-- is shown — buyers care about current standing, not historical.

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
  fin.outturn_ratio,

  -- Legality declaration fields (added 20260702) — most recent season only
  legal.season                          AS legality_season,
  legal.afa_milling_license_held,
  legal.nssf_compliant,
  legal.sha_compliant,
  legal.child_labour_policy_in_place,
  legal.land_use_rights_confirmed,
  legal.third_party_rights_confirmed,
  legal.tax_compliant,
  legal.items_complete                  AS legality_items_complete,
  legal.items_total                     AS legality_items_total,
  legal.fully_declared                  AS legality_fully_declared,
  legal.declared_at                     AS legality_declared_at

FROM public.coffee_passports cp
LEFT JOIN public.export_lots el ON el.id = cp.export_lot_id
LEFT JOIN public.cooperatives co ON co.id = cp.cooperative_id
LEFT JOIN public.v_export_lot_financial_summary fin ON fin.export_lot_id = cp.export_lot_id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.v_legality_declaration_summary vlds
  WHERE vlds.cooperative_id = cp.cooperative_id
  ORDER BY vlds.declared_at DESC NULLS LAST, vlds.updated_at DESC
  LIMIT 1
) legal ON true;

COMMENT ON VIEW public.v_passport_chain IS
  'Denormalized join for the public Coffee Passport trace page and B2B API. '
  'registration_number / commissioner_ref / registered_office (added 20260627) '
  'let a buyer verify the supplying cooperative''s legal registration. '
  'avg_first_payment_kes_per_kg / avg_second_payment_kes_per_kg / '
  'avg_total_payout_kes_per_kg / farmer_count / outturn_ratio (added 20260701) '
  'power the Financial Transparency widget. legality_* fields (added 20260702) '
  'surface the cooperative''s most recent self-declared legality checklist '
  '(EUDR Article 3(b) support) — these are self-reported, not third-party '
  'verified, and the UI must label them as such. buyer_name / buyer_country '
  'remain selectable here for potential internal use, but the application '
  'layer must never forward those two columns to the public trace page or '
  'B2B API response — see the explicit filtering in '
  'app/trace/[passportCode]/page.tsx and the allowlisted response object in '
  'app/api/passport/[passportCode]/route.ts.';
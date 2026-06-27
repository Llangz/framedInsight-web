-- ============================================================
-- Migration: Passport chain registration fields
-- framedInsight — 20260627_passport_chain_registration_fields.sql
--
-- Closes the "registration number not visible to buyers" gap flagged
-- in the engineering handoff (§6, §8 Priority 2, §9 Known Issue #2).
--
-- v_passport_chain previously joined cooperatives on only
-- cooperative_name / county / sub_county / ward. A buyer doing EUDR or
-- general legality due diligence on the public trace page had no way
-- to see that the supplying cooperative is a legitimately registered
-- Kenyan FCS — the registration_number existed in the database
-- (since 20260625_cooperative_registration_number.sql) but never
-- reached the public-facing view it was meant for.
--
-- Public readability of these columns was already opened up in
-- 20260626_farmer_supplying_cooperative.sql (the public cooperative
-- directory policy for signup), so this migration only needs to widen
-- the view itself — no further RLS change required.
-- ============================================================

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

  -- Newly added columns (append after existing cooperative_id)
  co.registration_number,
  co.commissioner_ref,
  co.registered_office
FROM public.coffee_passports cp
LEFT JOIN public.export_lots el ON el.id = cp.export_lot_id
LEFT JOIN public.cooperatives co ON co.id = cp.cooperative_id;

COMMENT ON VIEW public.v_passport_chain IS
  'Denormalized join for the public Coffee Passport trace page and B2B API '
  ' (consumed only by getPublicPassport() in lib/passport/passport.service.ts — '
  'the cooperative dashboard''s getCoopPassports() queries coffee_passports '
  'directly and does not use this view). registration_number / commissioner_ref '
  '/ registered_office were added so a buyer can verify the supplying '
  'cooperative''s legal registration directly on the trace page. buyer_name / '
  'buyer_country remain selectable here for potential future internal use, but '
  'the application layer is responsible for never forwarding those two columns '
  'to the public trace page or B2B API response — see the explicit filtering in '
  'app/trace/[passportCode]/page.tsx and the allowlisted response object in '
  'app/api/passport/[passportCode]/route.ts.';
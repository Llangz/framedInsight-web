-- ============================================================
-- Migration: Farmer self-declared supplying cooperative
-- framedInsight — 20260626_farmer_supplying_cooperative.sql
--
-- Lets an individual farmer optionally declare, at signup, which
-- cooperative (FCS) and factory/wet mill they deliver coffee to —
-- without that declaration being officer-verified or granting the
-- cooperative any dashboard visibility over the farmer's data.
--
-- This is deliberately a SEPARATE concept from `managed_by_coop_id` /
-- `is_coop_managed`, which represent officer-confirmed membership and
-- drive RLS policies elsewhere in the schema. Conflating the two would
-- let a farmer's own unverified claim silently grant a cooperative
-- access to their farm records — that must never happen.
-- ============================================================

ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS supplying_cooperative_id uuid REFERENCES public.cooperatives(id),
  ADD COLUMN IF NOT EXISTS supplying_factory_id     uuid REFERENCES public.coop_factories(id),
  ADD COLUMN IF NOT EXISTS supplying_coop_name_unmatched text;

COMMENT ON COLUMN public.farms.supplying_cooperative_id IS
  'Self-declared at signup — the cooperative this farmer says they deliver coffee to. '
  'NOT the same as managed_by_coop_id (officer-verified membership). Informational / '
  'lead-generation only. Must never be referenced by an RLS policy.';

COMMENT ON COLUMN public.farms.supplying_factory_id IS
  'Self-declared at signup — the specific factory / wet mill the farmer says they '
  'deliver to. Same caveat as supplying_cooperative_id: unverified.';

COMMENT ON COLUMN public.farms.supplying_coop_name_unmatched IS
  'Free-text fallback captured when the farmer typed a cooperative name that did not '
  'match anything in the on-platform directory at signup. Useful as an outreach lead '
  'signal — these are real cooperatives worth onboarding.';

CREATE INDEX IF NOT EXISTS idx_farms_supplying_coop ON public.farms(supplying_cooperative_id);

-- ── Public directory read access ─────────────────────────────────────────────
-- The signup page runs before the farmer has an account, so there is no
-- auth.uid() yet. The cascading County → Cooperative → Factory selector needs
-- to read cooperative_name/county and factory_name/factory_code for ANY
-- cooperative, not just ones the current user officers. This also happens to
-- close part of the still-open "registration number not public" gap, since
-- cooperatives.registration_number etc. become readable too — intentional,
-- as that data is already meant to be public-facing on the passport page.
--
-- Existing officer-only policies are left untouched; Postgres combines
-- multiple permissive SELECT policies with OR, so this purely adds reach,
-- it does not narrow what officers could already see.

CREATE POLICY "Public can view cooperative directory"
  ON public.cooperatives FOR SELECT
  USING (true);

CREATE POLICY "Public can view factory directory"
  ON public.coop_factories FOR SELECT
  USING (true);
-- ============================================================
-- Migration: Small Ruminants RLS Fix (CRITICAL — cross-tenant data exposure)
-- framedInsight — 20260704_small_ruminants_rls_fix.sql
--
-- CONTEXT:
--   small_ruminants and its four dependent tables (weight_records,
--   small_ruminant_health, small_ruminant_breeding, goat_milk_records)
--   were created outside the tracked migration history (no CREATE TABLE
--   for any of them exists anywhere in supabase/migrations/), and never
--   had Row Level Security enabled or any policy attached — despite
--   every comparable enterprise table (cows, coffee_plots, poultry_*)
--   having farm-scoped policies from day one.
--
--   Live schema audit (docs_source/policies.json) confirms zero policies
--   on all five tables. The SQL helper functions can_manage_farm_by_
--   small_ruminant_id() already exist in the database (SECURITY DEFINER,
--   presumably scaffolded for this exact purpose and never wired up) —
--   this migration finally attaches them.
--
--   PRACTICAL IMPACT BEFORE THIS FIX: any authenticated user on the
--   platform — any farmer's account, from any farm — could read (and,
--   depending on grants, write) any OTHER farm's sheep/goat animal
--   records, weight history, health/vaccination records, breeding
--   records, and milk production records simply by knowing or guessing
--   a UUID. Application-level dashboard pages relied entirely on RLS to
--   scope these queries and had no independent ownership check.
--
--   Some individual API routes (e.g. app/api/small-ruminants/animals/
--   [id]/route.ts) already do their own farm_id comparison in application
--   code, so writes through those specific routes were not exploitable —
--   but every read path (dashboard SSR pages) was fully open. This
--   migration is the actual fix; the application-level checks were never
--   a substitute for RLS, they were incidental protection on a subset of
--   write paths only.
--
-- SCOPE: SELECT/INSERT/UPDATE/DELETE, farm-manager AND cooperative-officer
-- scoped, mirroring the existing can_manage_farm() pattern used on cows.
-- ============================================================

-- ── small_ruminants (direct farm_id) ──────────────────────────────────────

ALTER TABLE public.small_ruminants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm managers can access their small ruminants" ON public.small_ruminants;
CREATE POLICY "Farm managers can access their small ruminants"
  ON public.small_ruminants
  FOR ALL
  USING (public.can_manage_farm(farm_id))
  WITH CHECK (public.can_manage_farm(farm_id));

-- ── weight_records (via animal_id → small_ruminants.farm_id) ─────────────

ALTER TABLE public.weight_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm managers can access weight records for their animals" ON public.weight_records;
CREATE POLICY "Farm managers can access weight records for their animals"
  ON public.weight_records
  FOR ALL
  USING (public.can_manage_farm_by_small_ruminant_id(animal_id))
  WITH CHECK (public.can_manage_farm_by_small_ruminant_id(animal_id));

-- ── small_ruminant_health (via animal_id) ─────────────────────────────────

ALTER TABLE public.small_ruminant_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm managers can access health records for their animals" ON public.small_ruminant_health;
CREATE POLICY "Farm managers can access health records for their animals"
  ON public.small_ruminant_health
  FOR ALL
  USING (public.can_manage_farm_by_small_ruminant_id(animal_id))
  WITH CHECK (public.can_manage_farm_by_small_ruminant_id(animal_id));

-- ── small_ruminant_breeding (via dam_id, NOT animal_id — dam is the female) ─

ALTER TABLE public.small_ruminant_breeding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm managers can access breeding records for their animals" ON public.small_ruminant_breeding;
CREATE POLICY "Farm managers can access breeding records for their animals"
  ON public.small_ruminant_breeding
  FOR ALL
  USING (public.can_manage_farm_by_small_ruminant_id(dam_id))
  WITH CHECK (public.can_manage_farm_by_small_ruminant_id(dam_id));

-- ── goat_milk_records (via animal_id) ─────────────────────────────────────

ALTER TABLE public.goat_milk_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Farm managers can access milk records for their animals" ON public.goat_milk_records;
CREATE POLICY "Farm managers can access milk records for their animals"
  ON public.goat_milk_records
  FOR ALL
  USING (public.can_manage_farm_by_small_ruminant_id(animal_id))
  WITH CHECK (public.can_manage_farm_by_small_ruminant_id(animal_id));

-- ── Service role bypass (matches the pattern on farm_managers/fm_service_admin_all) ─
-- Background jobs (EWS cron, WhatsApp intent processor) write on behalf of
-- users via the service-role key and must not be blocked by these policies.

DROP POLICY IF EXISTS "sr_service_admin_all" ON public.small_ruminants;
CREATE POLICY "sr_service_admin_all" ON public.small_ruminants
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wr_service_admin_all" ON public.weight_records;
CREATE POLICY "wr_service_admin_all" ON public.weight_records
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "srh_service_admin_all" ON public.small_ruminant_health;
CREATE POLICY "srh_service_admin_all" ON public.small_ruminant_health
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "srb_service_admin_all" ON public.small_ruminant_breeding;
CREATE POLICY "srb_service_admin_all" ON public.small_ruminant_breeding
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "gmr_service_admin_all" ON public.goat_milk_records;
CREATE POLICY "gmr_service_admin_all" ON public.goat_milk_records
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- VERIFICATION (run manually after applying, before considering this closed):
--
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('small_ruminants','weight_records',
--     'small_ruminant_health','small_ruminant_breeding','goat_milk_records')
--   ORDER BY tablename;
--
--   -- Should show 2 policies per table (owner-scoped ALL + service_role ALL).
--   -- Then, as two different farmer test accounts, confirm account B
--   -- gets zero rows / 404 when requesting account A's animal IDs.
-- ============================================================
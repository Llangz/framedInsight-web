-- ============================================================
-- Migration: Consolidate is_cooperative_officer / is_cooperative_admin
-- framedInsight — 20260709_consolidate_cooperative_officer_helper.sql
--
-- CONTEXT:
--   20260705_fix_cooperative_officers_rls_recursion.sql (already applied
--   to this database) created two single-argument SECURITY DEFINER
--   helpers to break the cooperative_officers RLS recursion:
--
--     is_cooperative_officer(p_cooperative_id uuid)
--     is_cooperative_admin(p_cooperative_id uuid)
--
--   and wired them into policies on cooperative_officers, cooperatives,
--   and coop_factories (5 policies total).
--
--   A later revision consolidated these into a single two-argument
--   function — is_cooperative_officer(p_cooperative_id uuid, p_role text
--   DEFAULT NULL) — so "is this user an officer" and "is this user
--   specifically an admin" share one implementation. Because Postgres
--   allows a 1-arg call to match a 2-arg function with a DEFAULT, running
--   that CREATE OR REPLACE alongside the still-live 1-arg original made
--   every existing `is_cooperative_officer(cooperative_id)` call
--   ambiguous — hence 42725 "function ... is not unique".
--
-- FIX: retire the two 1-arg functions and every policy that depends on
--   them, then (re)create the single consolidated 2-arg function and
--   rebuild those policies against it. This is a clean cutover, not a
--   patch — after this runs, is_cooperative_admin(uuid) no longer
--   exists; every call site uses is_cooperative_officer(id, 'admin')
--   instead.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. Drop every policy that depends on the two 1-arg helpers ───────────
-- (DROP FUNCTION will refuse otherwise; dropping policies first also means
-- we never have a moment where a policy references a function that no
-- longer exists.)

DROP POLICY IF EXISTS "Cooperative officers can view fellow officers" ON public.cooperative_officers;
DROP POLICY IF EXISTS "Cooperative admins can add officers"           ON public.cooperative_officers;
DROP POLICY IF EXISTS "Cooperative officers can view their cooperative" ON public.cooperatives;
DROP POLICY IF EXISTS "Cooperative admins can update their cooperative" ON public.cooperatives;
DROP POLICY IF EXISTS "Cooperative officers can view factories"       ON public.coop_factories;
DROP POLICY IF EXISTS "Cooperative officers can manage factories"     ON public.coop_factories;

-- ── 2. Drop the two 1-arg helpers now that nothing depends on them ───────

DROP FUNCTION IF EXISTS public.is_cooperative_officer(uuid);
DROP FUNCTION IF EXISTS public.is_cooperative_admin(uuid);

-- ── 3. Create the consolidated 2-arg helper ───────────────────────────────

CREATE OR REPLACE FUNCTION public.is_cooperative_officer(
  p_cooperative_id uuid,
  p_role text DEFAULT NULL  -- pass e.g. 'admin' to require that specific role
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cooperative_officers
    WHERE cooperative_id = p_cooperative_id
      AND user_id = auth.uid()
      AND (p_role IS NULL OR role = p_role)
  );
$$;

COMMENT ON FUNCTION public.is_cooperative_officer(uuid, text) IS
  'RLS helper — checks whether the current user (auth.uid()) is an officer '
  '(optionally of a specific role) of the given cooperative, without '
  'triggering RLS recursion when used inside a policy defined on '
  'cooperative_officers itself. Supersedes the retired 1-arg '
  'is_cooperative_officer(uuid) / is_cooperative_admin(uuid) pair from '
  '20260705_fix_cooperative_officers_rls_recursion.sql.';

GRANT EXECUTE ON FUNCTION public.is_cooperative_officer(uuid, text) TO authenticated;

-- ── 4. Rebuild the six policies against the consolidated function ────────

CREATE POLICY "Cooperative officers can view fellow officers" ON public.cooperative_officers
  FOR SELECT USING (
    public.is_cooperative_officer(cooperative_id)
  );

CREATE POLICY "Cooperative admins can add officers" ON public.cooperative_officers
  FOR INSERT WITH CHECK (
    public.is_cooperative_officer(cooperative_id, 'admin')
  );

CREATE POLICY "Cooperative officers can view their cooperative" ON public.cooperatives
  FOR SELECT USING (
    public.is_cooperative_officer(id)
  );

CREATE POLICY "Cooperative admins can update their cooperative" ON public.cooperatives
  FOR UPDATE USING (
    public.is_cooperative_officer(id, 'admin')
  );

CREATE POLICY "Cooperative officers can view factories" ON public.coop_factories
  FOR SELECT USING (
    public.is_cooperative_officer(cooperative_id)
  );

CREATE POLICY "Cooperative officers can manage factories" ON public.coop_factories
  FOR ALL USING (
    public.is_cooperative_officer(cooperative_id)
  );

-- ============================================================
-- VERIFICATION (run manually after applying):
--
--   1. Confirm only one signature remains:
--        SELECT p.oid::regprocedure
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--        WHERE n.nspname = 'public' AND p.proname = 'is_cooperative_officer';
--      -> should return exactly one row:
--         is_cooperative_officer(uuid, text)
--
--   2. As an authenticated cooperative officer test account, these should
--      return rows with no error (this is the original bug this whole
--      chain was fixing):
--        SELECT * FROM public.cooperative_officers WHERE cooperative_id = '<id>';
--        SELECT * FROM public.farms WHERE managed_by_coop_id = '<id>';
--
--   3. As a cooperative ADMIN test account specifically, confirm they can
--      still insert a new officer row and update the cooperative record
--      (exercises the p_role = 'admin' path).
-- ============================================================
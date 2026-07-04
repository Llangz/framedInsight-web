-- ============================================================
-- Migration: Fix cooperative_officers infinite-recursion RLS bug
-- framedInsight — 20260705_fix_cooperative_officers_rls_recursion.sql
--
-- CONTEXT:
--   20260620_create_cooperatives.sql added this policy on
--   public.cooperative_officers:
--
--     CREATE POLICY "Cooperative officers can view fellow officers"
--       ON public.cooperative_officers FOR SELECT USING (
--         EXISTS (
--           SELECT 1 FROM public.cooperative_officers co
--           WHERE co.cooperative_id = cooperative_officers.cooperative_id
--           AND co.user_id = auth.uid()
--         )
--       );
--
--   This policy checks membership in cooperative_officers by querying
--   cooperative_officers. Postgres has to apply RLS to that inner
--   subquery too, which re-triggers the same policy — infinite
--   recursion. This throws:
--
--     "infinite recursion detected in policy for relation
--      \"cooperative_officers\""
--
--   for EVERY query against cooperative_officers, and — because other
--   tables' policies (cooperatives, coop_factories, farms, coffee_plots,
--   coffee_harvests, coffee_activities, coffee_eudr_compliance) all do
--   `EXISTS (SELECT 1 FROM cooperative_officers ...)` as part of their
--   own RLS check — it poisons any query against THOSE tables too, for
--   every user, not just cooperative officers. This is the confirmed
--   root cause of the "Couldn't verify your account" screen surfaced
--   via lib/get-farm-status.ts's `farms` lookup.
--
-- THE FIX:
--   Same pattern already used successfully in
--   20260704_small_ruminants_rls_fix.sql: move the membership check into
--   a SECURITY DEFINER helper function. A SECURITY DEFINER function
--   executes as its owning role, which bypasses RLS on the underlying
--   table entirely instead of re-entering the calling policy — breaking
--   the cycle. This is the ONLY policy that needed to change: it was the
--   sole self-referencing one (a table's policy querying itself). Every
--   other table's cross-table EXISTS check against cooperative_officers
--   continues to work as before; it will simply evaluate against the
--   now-non-recursive policy below instead of looping.
--
-- VERIFICATION (run manually after applying):
--   As a cooperative officer test account:
--     SELECT * FROM public.cooperative_officers WHERE cooperative_id = '<id>';
--     SELECT * FROM public.farms WHERE managed_by_coop_id = '<id>';
--   Both should return rows with no error. As a second, unrelated test
--   account (not a coop officer at all), the same farms/dashboard load
--   should also complete without the "infinite recursion" error.
-- ============================================================

-- ── Helper function (SECURITY DEFINER breaks the recursion) ──────────────

CREATE OR REPLACE FUNCTION public.is_cooperative_officer(p_cooperative_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cooperative_officers
    WHERE cooperative_id = p_cooperative_id
    AND user_id = auth.uid()
  );
$$;

-- Same shape, scoped to admins only — used by the "admins can add
-- officers" INSERT policy (20260625_cooperative_officers_insert_policy.sql),
-- which has the identical self-referencing shape and would recurse under
-- write load the same way the SELECT policy did under read load.
CREATE OR REPLACE FUNCTION public.is_cooperative_admin(p_cooperative_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cooperative_officers
    WHERE cooperative_id = p_cooperative_id
    AND user_id = auth.uid()
    AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_cooperative_officer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cooperative_admin(uuid) TO authenticated;

-- ── The actual fix: replace the recursive SELECT policy ───────────────────

DROP POLICY IF EXISTS "Cooperative officers can view fellow officers" ON public.cooperative_officers;

CREATE POLICY "Cooperative officers can view fellow officers" ON public.cooperative_officers
  FOR SELECT USING (
    public.is_cooperative_officer(cooperative_id)
  );

-- ── Same fix for the INSERT policy (identical self-referencing shape) ────
-- 20260625_cooperative_officers_insert_policy.sql's WITH CHECK also queries
-- cooperative_officers from within a policy ON cooperative_officers, so it
-- carries the same latent recursion risk on writes even though it hadn't
-- surfaced yet (per that migration's own note: nothing besides the
-- SECURITY DEFINER signup RPC currently inserts into this table).

DROP POLICY IF EXISTS "Cooperative admins can add officers" ON public.cooperative_officers;

CREATE POLICY "Cooperative admins can add officers" ON public.cooperative_officers
  FOR INSERT
  WITH CHECK (
    public.is_cooperative_admin(cooperative_id)
  );

-- ── Optional consistency pass ──────────────────────────────────────────
-- Not required to fix the recursion (only the two policies above were
-- self-referencing), but these policies on cooperatives/coop_factories
-- did the same EXISTS-against-cooperative_officers check inline. Routing
-- them through the same helper function keeps the pattern consistent and
-- avoids re-planning an inline subquery on every row.

DROP POLICY IF EXISTS "Cooperative officers can view their cooperative" ON public.cooperatives;
CREATE POLICY "Cooperative officers can view their cooperative" ON public.cooperatives
  FOR SELECT USING (public.is_cooperative_officer(id));

DROP POLICY IF EXISTS "Cooperative admins can update their cooperative" ON public.cooperatives;
CREATE POLICY "Cooperative admins can update their cooperative" ON public.cooperatives
  FOR UPDATE USING (public.is_cooperative_admin(id));

DROP POLICY IF EXISTS "Cooperative officers can view factories" ON public.coop_factories;
CREATE POLICY "Cooperative officers can view factories" ON public.coop_factories
  FOR SELECT USING (public.is_cooperative_officer(cooperative_id));

DROP POLICY IF EXISTS "Cooperative officers can manage factories" ON public.coop_factories;
CREATE POLICY "Cooperative officers can manage factories" ON public.coop_factories
  FOR ALL USING (public.is_cooperative_officer(cooperative_id));

-- NOTE: farms / coffee_plots / coffee_harvests / coffee_activities /
-- coffee_eudr_compliance policies join farms.managed_by_coop_id to
-- cooperative_officers.cooperative_id — they reference a DIFFERENT
-- column relationship (farm -> coop, not coop -> coop) and are left as-is;
-- they were never recursive themselves, only collateral damage from the
-- cooperative_officers self-reference above. Once that's fixed, these
-- resolve normally with no further changes needed.
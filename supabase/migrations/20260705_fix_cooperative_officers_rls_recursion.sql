-- ============================================================
-- Migration: Fix infinite recursion in cooperative_officers RLS
-- framedInsight — 20260705_fix_cooperative_officers_rls_recursion.sql
--
-- BUG (present since 20260620_create_cooperatives.sql, never triggered
-- until now):
--
--   CREATE POLICY "Cooperative officers can view fellow officers"
--     ON public.cooperative_officers FOR SELECT USING (
--       EXISTS (
--         SELECT 1 FROM public.cooperative_officers co   -- <- same table
--         WHERE co.cooperative_id = cooperative_officers.cooperative_id
--         AND co.user_id = auth.uid()
--       )
--     );
--
-- A SELECT policy on cooperative_officers whose own USING clause queries
-- cooperative_officers again. Postgres has to apply RLS to that inner
-- query too, which re-evaluates the same policy, which queries the table
-- again... -> "infinite recursion detected in policy for relation
-- cooperative_officers" (Postgres error 42P17). The INSERT policy added
-- later in 20260625_cooperative_officers_insert_policy.sql has the exact
-- same shape and the exact same bug.
--
-- Why this wasn't caught earlier: the only write path
-- (create_cooperative_with_officer) is SECURITY DEFINER and bypasses RLS,
-- so signup itself never hit it. Any authenticated SELECT against
-- cooperative_officers would have hit it immediately — including
-- app/dashboard/layout.tsx's own "is this user a coop officer" check —
-- but that query's error was silently discarded (only `data` was read,
-- never `error`), so it read as "not a coop officer" and fell through
-- rather than surfacing anything. It became visible now because
-- lib/get-farm-status.ts (20260704's fix) added a second query against
-- `farms`, and `farms` has its own policies
-- ("Cooperative officers can view/update/delete farms") that subquery
-- cooperative_officers — Postgres evaluates ALL permissive policies on
-- `farms` to build the query, including that one, which walks straight
-- into the same recursive policy and fails the whole `farms` query.
--
-- FIX: the standard Postgres/Supabase pattern for "a table's RLS policy
-- needs to check membership in that same table" — a SECURITY DEFINER
-- helper function. Because the function runs with the privileges of its
-- owner (not the calling user), Postgres does not re-apply RLS inside it,
-- so the same lookup no longer recurses.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_cooperative_officer(
  p_cooperative_id uuid,
  p_role text DEFAULT NULL  -- pass e.g. 'admin' to require that specific role
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
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
  'cooperative_officers itself.';

-- Replace the two broken policies on cooperative_officers to use the
-- helper instead of subquerying the table directly.

DROP POLICY IF EXISTS "Cooperative officers can view fellow officers" ON public.cooperative_officers;
CREATE POLICY "Cooperative officers can view fellow officers" ON public.cooperative_officers
  FOR SELECT USING (
    public.is_cooperative_officer(cooperative_id)
  );

DROP POLICY IF EXISTS "Cooperative admins can add officers" ON public.cooperative_officers;
CREATE POLICY "Cooperative admins can add officers" ON public.cooperative_officers
  FOR INSERT WITH CHECK (
    public.is_cooperative_officer(cooperative_id, 'admin')
  );

-- ============================================================
-- VERIFICATION (run manually after applying):
--
--   1. As an authenticated cooperative officer, this should now return
--      rows instead of erroring:
--        SELECT * FROM cooperative_officers WHERE cooperative_id = '<id>';
--
--   2. Confirm no other policy anywhere subqueries its OWN table directly
--      (the pattern that causes this):
--        SELECT schemaname, tablename, policyname, qual
--        FROM pg_policies
--        WHERE qual ILIKE '%' || tablename || '%'
--          AND tablename NOT IN ('cooperative_officers');  -- already fixed
--      Review any hits by hand — a table name appearing in its own
--      policy text isn't automatically recursive (e.g. self-joins with a
--      different alias on a *different* column can be fine), but it's
--      the pattern worth auditing for.
-- ============================================================
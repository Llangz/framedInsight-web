-- ============================================================
-- Migration: Platform admin RLS hardening
-- framedInsight — 20260714_platform_admin_rls.sql
--
-- CONTEXT:
--   20260713_platform_admins.sql shipped platform_admins with RLS locked
--   to "read your own row only", and every /admin page read/wrote farms,
--   cooperatives, etc. through a service-role client gated by a single
--   requireAdminAccess() call in application code. That's a legitimate,
--   widely-used pattern (it's how most internal-admin-tool setups work),
--   but it has one real weakness: the *entire* access control lives in
--   that one function call. A future admin page that forgets to call it
--   would have completely unrestricted read/write to every farm on the
--   platform, because the service-role key bypasses RLS unconditionally —
--   there's no second layer to catch the mistake.
--
--   This migration adds that second layer, mirroring the exact pattern
--   already established for cooperative officers (see
--   20260709_consolidate_cooperative_officer_helper.sql's
--   is_cooperative_officer() and 20260704a_audit_log.sql's
--   can_manage_farm()): a STABLE SECURITY DEFINER helper function,
--   referenced from new, purely ADDITIVE policies. Postgres RLS policies
--   are OR'd together (permissive by default) — a new "admins can also
--   see this" policy can only ever grant additional access on top of what
--   farmers/cooperative officers already have; it cannot narrow anyone's
--   existing access. That's what makes this safe to add without
--   re-auditing every existing farmer- or cooperative-facing policy.
--
-- SCOPE — deliberately not every table admin pages touch:
--   Covered here: farms, cooperatives, cooperative_officers, coffee_plots,
--   transactions, audit_log. These already have RLS enabled, so adding a
--   policy is purely additive and low-risk.
--
--   NOT covered here: alerts, coffee_satellite_fetch_log. Neither has RLS
--   enabled at all as of this migration — turning RLS on for the first
--   time on a table (rather than adding a policy to one that already has
--   it) is a materially different, higher-risk change: every existing
--   consumer of that table needs a matching policy or it goes dark, and
--   that requires auditing who reads/writes those two tables today (the
--   EWS cron, the fetch-plot-indices edge function, the WhatsApp intent
--   processor, ...) before it's safe to flip on. app/admin/system/page.tsx
--   and app/dashboard/cooperative/system/page.tsx keep reading those two
--   through the service-role client for now — worth a dedicated follow-up
--   migration once that audit is done, not bundled into this one.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. The helper function ────────────────────────────────────────────
-- p_role: pass 'superadmin' to require that specific tier; omit (or pass
-- NULL) to allow either tier. A 'superadmin' row always satisfies a
-- 'superadmin' check via the explicit OR below, same as a 'support' row
-- never does — there's no role hierarchy beyond that one distinction.
CREATE OR REPLACE FUNCTION public.is_platform_admin(
  p_role text DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
      AND (p_role IS NULL OR role = p_role OR role = 'superadmin')
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin(text) IS
  'RLS helper — checks whether the current user (auth.uid()) has a row in '
  'platform_admins, optionally requiring the superadmin tier specifically. '
  'SECURITY DEFINER so it can be referenced from policies on farms/'
  'cooperatives/etc. without those tables needing their own visibility '
  'into platform_admins. Mirrors is_cooperative_officer() in '
  '20260709_consolidate_cooperative_officer_helper.sql.';

GRANT EXECUTE ON FUNCTION public.is_platform_admin(text) TO authenticated;

-- ── 2. farms ─────────────────────────────────────────────────────────
-- SELECT: either admin tier. UPDATE: either tier too, even though
-- app/admin/farms/[farmId]/actions.ts currently requires superadmin
-- specifically for subscription edits (support can only suspend/
-- reactivate) — RLS UPDATE policies apply to the whole row, not
-- individual columns, so that finer distinction stays an app-layer
-- concern by necessity. What this policy actually buys you: a support
-- account can never touch a farm any other way than through code that
-- already checked requireAdminAccess() — and a *stranger* (no
-- platform_admins row at all) cannot touch any farm but their own no
-- matter what code path they hit, service-role bugs included.
DROP POLICY IF EXISTS "Platform admins can view all farms" ON public.farms;
CREATE POLICY "Platform admins can view all farms" ON public.farms
  FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can update all farms" ON public.farms;
CREATE POLICY "Platform admins can update all farms" ON public.farms
  FOR UPDATE USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ── 3. cooperatives ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Platform admins can view all cooperatives" ON public.cooperatives;
CREATE POLICY "Platform admins can view all cooperatives" ON public.cooperatives
  FOR SELECT USING (public.is_platform_admin());

-- ── 4. cooperative_officers ──────────────────────────────────────────
-- Read is open to either admin tier (matches the cooperatives list page,
-- which any admin can browse); role changes and removal require
-- superadmin specifically, matching app/admin/cooperatives/[coopId]/
-- actions.ts's requireAdminAccess('superadmin') exactly — unlike farms
-- above, this one genuinely is a single-purpose table where the whole-row
-- policy lines up with the app-layer restriction with no gap.
DROP POLICY IF EXISTS "Platform admins can view all officers" ON public.cooperative_officers;
CREATE POLICY "Platform admins can view all officers" ON public.cooperative_officers
  FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform superadmins can update officers" ON public.cooperative_officers;
CREATE POLICY "Platform superadmins can update officers" ON public.cooperative_officers
  FOR UPDATE USING (public.is_platform_admin('superadmin')) WITH CHECK (public.is_platform_admin('superadmin'));

DROP POLICY IF EXISTS "Platform superadmins can remove officers" ON public.cooperative_officers;
CREATE POLICY "Platform superadmins can remove officers" ON public.cooperative_officers
  FOR DELETE USING (public.is_platform_admin('superadmin'));

-- ── 5. coffee_plots ──────────────────────────────────────────────────
-- Read-only — the admin farm detail page shows plot count, nothing else
-- admin does today writes to a plot directly.
DROP POLICY IF EXISTS "Platform admins can view all coffee plots" ON public.coffee_plots;
CREATE POLICY "Platform admins can view all coffee plots" ON public.coffee_plots
  FOR SELECT USING (public.is_platform_admin());

-- ── 6. transactions ──────────────────────────────────────────────────
-- Read-only — admin surfaces M-Pesa history, never edits it (that stays
-- the sole responsibility of the M-Pesa webhook's service-role writes).
DROP POLICY IF EXISTS "Platform admins can view all transactions" ON public.transactions;
CREATE POLICY "Platform admins can view all transactions" ON public.transactions
  FOR SELECT USING (public.is_platform_admin());

-- ── 7. audit_log ─────────────────────────────────────────────────────
-- Read-only, and deliberately doesn't touch the existing
-- "audit_log_service_admin_all" / "audit_log_farm_read" policies from
-- 20260704a_audit_log.sql — this is a third, independent SELECT policy
-- alongside them, not a replacement. Writes still go exclusively through
-- lib/security.ts's service-role client, unchanged: an audit trail that
-- an admin session could edit or delete isn't an audit trail.
DROP POLICY IF EXISTS "Platform admins can view all audit log entries" ON public.audit_log;
CREATE POLICY "Platform admins can view all audit log entries" ON public.audit_log
  FOR SELECT USING (public.is_platform_admin());

-- ============================================================
-- VERIFICATION (run manually after applying):
--
--   1. SELECT p.oid::regprocedure FROM pg_proc p
--      JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public' AND p.proname = 'is_platform_admin';
--      -> is_platform_admin(text)
--
--   2. SELECT tablename, policyname, cmd FROM pg_policies
--      WHERE policyname LIKE 'Platform admin%' OR policyname LIKE 'Platform superadmin%'
--      ORDER BY tablename, policyname;
--      -> 8 rows across farms(2), cooperatives(1), cooperative_officers(3),
--         coffee_plots(1), transactions(1), audit_log will show as a 4th
--         once this migration runs (3 total on audit_log).
--
--   3. As your own superadmin account (the one you just inserted into
--      platform_admins), confirm you can query farms you do NOT own:
--        SELECT count(*) FROM farms;  -- should return every farm, not just yours
--
--   4. As an ordinary farmer test account (NOT in platform_admins),
--      confirm nothing changed:
--        SELECT count(*) FROM farms;  -- should still return only their own farm(s)
-- ============================================================

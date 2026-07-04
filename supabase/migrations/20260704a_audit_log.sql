-- ============================================================
-- Migration: Persistent Audit Log
-- framedInsight — 20260704a_audit_log.sql
--
-- CONTEXT:
--   lib/security.ts:auditLog() has, since it was introduced, only ever
--   written structured entries to console.log. That's fine for local
--   dev but means there has never been a queryable record of security
--   events (OTP rate-limiting, failed logins, poultry batch mutations,
--   buyer data-room access, etc.) — only whatever Vercel's log
--   aggregation retains, if anything. Punch-list item: "route auditLog()
--   to the persistent database table rather than console.log."
--
--   This migration creates the table. lib/security.ts is updated
--   separately to write here (still logging to console as a fallback
--   on write failure, so an audit-log outage never blocks the request
--   it's trying to log).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action      text NOT NULL,
  actor_id    uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  farm_id     uuid NULL REFERENCES public.farms(id) ON DELETE SET NULL,
  resource    text NOT NULL,
  resource_id text NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Query patterns this needs to support well:
--   "everything that happened to farm X" (dashboard / support use)
--   "everything actor Y did" (account-level investigation)
--   "recent events of type Z" (e.g. all OTP_RATE_LIMITED in the last day)
CREATE INDEX IF NOT EXISTS idx_audit_log_farm_id    ON public.audit_log (farm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id   ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON public.audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Writes happen exclusively via the service-role client (see lib/security.ts),
-- since many events are unauthenticated (e.g. OTP_RATE_LIMITED before login
-- succeeds) and audit rows must never be editable by the actor they describe.
DROP POLICY IF EXISTS "audit_log_service_admin_all" ON public.audit_log;
CREATE POLICY "audit_log_service_admin_all" ON public.audit_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Farm managers / cooperative officers can read (SELECT only — never
-- write) audit rows scoped to farms they manage, mirroring the
-- can_manage_farm() pattern used everywhere else (cows, small_ruminants,
-- coffee_plots). This is what will power a future "Activity" tab in
-- Settings; it is not yet wired into any UI as of this migration.
DROP POLICY IF EXISTS "audit_log_farm_read" ON public.audit_log;
CREATE POLICY "audit_log_farm_read" ON public.audit_log
  FOR SELECT USING (
    farm_id IS NOT NULL AND public.can_manage_farm(farm_id)
  );

-- ============================================================
-- VERIFICATION (run manually after applying):
--
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename = 'audit_log' ORDER BY policyname;
--   -- Should show 2 policies: service-role ALL, farm-scoped SELECT.
--
--   INSERT INTO public.audit_log (action, resource) VALUES ('TEST', 'test');
--   -- Should FAIL under the anon/authenticated role, SUCCEED only with
--   -- the service-role key.
-- ============================================================
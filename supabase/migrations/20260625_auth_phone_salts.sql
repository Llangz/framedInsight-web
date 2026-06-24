-- ============================================================================
-- Ghost-password salt, decoupled from SERVICE_ROLE_KEY (Issue #10)
-- ============================================================================
-- NOTE: this deliberately does NOT put the salt on farm_managers, despite
-- that being the original proposal. farm_managers has no row for a phone
-- until AFTER auth succeeds — it's created later by create_farm_with_manager
-- during onboarding (app/auth/verify/actions.ts), and for cooperative-mapped
-- farmers who haven't claimed their farm yet, it may not exist for a long
-- time. The ghost password is derived and used in
-- app/api/auth/verify-otp/route.ts before any of that exists, so the salt
-- needs to live somewhere keyed purely by phone number, independent of
-- onboarding/farm state.
--
-- RLS is enabled with NO policies for anon/authenticated roles — this table
-- is only ever read/written by the service-role client inside
-- verify-otp/route.ts, never from the browser.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_phone_salts (
  phone_number text PRIMARY KEY,
  salt         uuid NOT NULL DEFAULT gen_random_uuid(),
  scheme       text NOT NULL DEFAULT 'salted_hmac_v1',
  created_at   timestamptz NOT NULL DEFAULT now(),
  migrated_at  timestamptz
);

ALTER TABLE public.auth_phone_salts ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies — service-role only, bypasses RLS by design.
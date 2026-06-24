-- ============================================================================
-- Claim flow + RPC parameter fixes
-- Applied: 2026-06-21 (run directly on live Supabase DB)
-- Documented here for version control parity.
--
-- Fixes two issues:
--
-- 1. LIVE BUG: app/auth/verify/coop-actions.ts calls create_cooperative_with_officer
--    with a p_email argument that the function has never accepted. PostgREST
--    cannot resolve a named-argument call against an unknown parameter, so
--    every cooperative signup was failing after OTP verification.
--    (The farmer equivalent, create_farm_with_manager, was already patched
--    around this in commit 754a604 by removing p_email from the call site —
--    this migration properly fixes it at the source instead, on both RPCs,
--    so the email collected at signup is actually persisted.)
--
-- 2. ARCHITECTURAL GAP: farms.phone is globally unique, but cooperatives
--    pre-register member farmers (is_coop_managed = true, claim_token set,
--    farm_managers has no row yet). When that same farmer later self-signs-up
--    with the same phone, create_farm_with_manager tries to INSERT a second
--    farms row with the same phone and hits farms_phone_key — which was
--    surfacing as a raw Postgres error in the UI. This migration makes that
--    RPC idempotent: if the phone already belongs to an *unclaimed*
--    cooperative-managed farm, the signup claims that farm instead of trying
--    to create a duplicate. If the phone belongs to an already-claimed farm,
--    it still fails fast with the same 23505 error code the app already
--    handles gracefully (see app/onboarding/actions.ts, app/auth/verify/actions.ts).
--
--    A second RPC, claim_cooperative_farm, supports the explicit
--    /claim/[token] flow for farmers whose phone wasn't known at mapping time.
-- ============================================================================

-- 1. Cooperative officers can have their own contact email (separate from the
--    cooperative entity itself, which has no email column and shouldn't need one).
ALTER TABLE public.cooperative_officers ADD COLUMN IF NOT EXISTS email text;

-- 2. create_farm_with_manager — idempotent + claim-aware + accepts p_email
CREATE OR REPLACE FUNCTION public.create_farm_with_manager(
  p_farm_name text,
  p_owner_name text,
  p_phone text,
  p_county text,
  p_sub_county text,
  p_ward text,
  p_farm_types text[],
  p_primary_enterprise text,
  p_user_id uuid,
  p_subscription_end_date timestamp with time zone,
  p_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farm_id uuid;
  v_existing record;
  v_already_has_manager boolean;
BEGIN
  -- Lock any existing row for this phone so two concurrent signups (or a
  -- signup racing a coop officer's farmer-mapping insert) can't both pass
  -- the check below.
  SELECT id, is_coop_managed, claim_token
    INTO v_existing
    FROM public.farms
   WHERE phone = p_phone
   FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.is_coop_managed IS TRUE AND v_existing.claim_token IS NOT NULL THEN
      -- This phone matches an unclaimed cooperative-mapped farm. Treat this
      -- signup as the claim: attach the verified user as owner instead of
      -- inserting a duplicate row.
      v_farm_id := v_existing.id;

      SELECT EXISTS (
        SELECT 1 FROM public.farm_managers WHERE farm_id = v_farm_id
      ) INTO v_already_has_manager;

      IF v_already_has_manager THEN
        -- Defensive: claim_token said "unclaimed" but a manager already
        -- exists. Don't silently reassign someone else's farm.
        RAISE EXCEPTION 'duplicate key value violates unique constraint "farms_phone_key"'
          USING ERRCODE = '23505';
      END IF;

      UPDATE public.farms
         SET owner_name           = p_owner_name,
             email                = COALESCE(p_email, email),
             claim_token          = NULL,
             farm_types           = p_farm_types,
             primary_enterprise   = COALESCE(primary_enterprise, p_primary_enterprise),
             subscription_tier    = 'smallholder',
             subscription_end_date = p_subscription_end_date,
             updated_at           = now()
       WHERE id = v_farm_id;

      INSERT INTO public.farm_managers (user_id, farm_id, role)
      VALUES (p_user_id, v_farm_id, 'owner');

      RETURN v_farm_id;
    ELSE
      -- Phone already belongs to a standalone or already-claimed farm.
      -- Surface the same error shape the app already handles (23505).
      RAISE EXCEPTION 'duplicate key value violates unique constraint "farms_phone_key"'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- No existing farm for this phone — normal fresh signup.
  INSERT INTO public.farms (
    farm_name, owner_name, phone, email, county, sub_county, ward,
    is_active, subscription_tier, subscription_end_date,
    farm_types, primary_enterprise
  ) VALUES (
    p_farm_name, p_owner_name, p_phone, p_email, p_county, p_sub_county, p_ward,
    true, 'smallholder', p_subscription_end_date,
    p_farm_types, p_primary_enterprise
  ) RETURNING id INTO v_farm_id;

  INSERT INTO public.farm_managers (user_id, farm_id, role)
  VALUES (p_user_id, v_farm_id, 'owner');

  RETURN v_farm_id;
END;
$$;

-- 3. create_cooperative_with_officer — accepts p_email, persists to
--    cooperative_officers.email (the contact person, not the cooperative entity)
CREATE OR REPLACE FUNCTION public.create_cooperative_with_officer(
  p_cooperative_name text,
  p_county text,
  p_sub_county text,
  p_ward text,
  p_primary_enterprise text,
  p_user_id uuid,
  p_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cooperative_id uuid;
BEGIN
  INSERT INTO public.cooperatives (
    cooperative_name, county, sub_county, ward, primary_enterprise
  ) VALUES (
    p_cooperative_name, p_county, p_sub_county, p_ward, p_primary_enterprise
  ) RETURNING id INTO v_cooperative_id;

  INSERT INTO public.cooperative_officers (
    cooperative_id, user_id, role, email
  ) VALUES (
    v_cooperative_id, p_user_id, 'admin', p_email
  );

  RETURN v_cooperative_id;
END;
$$;

-- 4. claim_cooperative_farm — explicit token-based claim, used by /claim/[token].
--    Unlike create_farm_with_manager, this does not require the farm to have
--    had a phone on file at all (covers farmers mapped with no phone because
--    they had no smartphone at the time), but if a phone IS already on file,
--    the OTP-verified phone supplied here must match it — the claim_token
--    alone (e.g. if a link leaked) is not sufficient to reassign a farm whose
--    real owner's phone differs from the one trying to claim it.
CREATE OR REPLACE FUNCTION public.claim_cooperative_farm(
  p_claim_token text,
  p_user_id uuid,
  p_phone text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farm record;
  v_already_has_manager boolean;
BEGIN
  SELECT id, phone, claim_token
    INTO v_farm
    FROM public.farms
   WHERE claim_token = p_claim_token
   FOR UPDATE;

  IF v_farm.id IS NULL THEN
    RAISE EXCEPTION 'CLAIM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_farm.claim_token IS NULL THEN
    RAISE EXCEPTION 'CLAIM_ALREADY_USED' USING ERRCODE = 'P0003';
  END IF;

  IF v_farm.phone IS NOT NULL AND v_farm.phone <> p_phone THEN
    RAISE EXCEPTION 'CLAIM_PHONE_MISMATCH' USING ERRCODE = 'P0004';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.farm_managers WHERE farm_id = v_farm.id
  ) INTO v_already_has_manager;

  IF v_already_has_manager THEN
    RAISE EXCEPTION 'CLAIM_ALREADY_USED' USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.farms
     SET phone       = p_phone,
         claim_token = NULL,
         updated_at  = now()
   WHERE id = v_farm.id;

  INSERT INTO public.farm_managers (user_id, farm_id, role)
  VALUES (p_user_id, v_farm.id, 'owner');

  RETURN v_farm.id;
END;
$$;

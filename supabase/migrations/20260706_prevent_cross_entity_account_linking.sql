-- ============================================================
-- Migration: Prevent one account being linked to both a farm AND a
-- cooperative
-- framedInsight — 20260706_prevent_cross_entity_account_linking.sql
--
-- CONTEXT:
--   Neither create_farm_with_manager nor create_cooperative_with_officer
--   has ever checked whether the signing-up user_id is already linked to
--   the OTHER entity type. A user could sign up as an individual farmer
--   (a farm_managers row) and later sign up as a cooperative (a
--   cooperative_officers row) with the same account — or the reverse —
--   with nothing stopping it and no warning shown. app/dashboard/layout.tsx
--   was never designed to handle a user who is both: it checks
--   cooperative_officers first and, if found, renders the coop shell
--   unconditionally, silently ignoring any farm the same account also
--   manages. This is the most likely way an account ends up in a state
--   that surfaces confusing, hard-to-explain errors down the line.
--
-- FIX: both RPCs now check for the other entity type up front and raise
-- a distinct, custom SQLSTATE if found, so the calling Next.js action can
-- show a clear, specific message instead of a generic failure:
--   - create_farm_with_manager    raises P0010 if the user is already a
--     cooperative officer.
--   - create_cooperative_with_officer raises P0011 if the user already
--     manages an existing (non-orphaned) farm.
--
-- Everything else in both functions is unchanged from their current
-- versions (20260704b_create_farm_with_manager_orphan_cleanup.sql and
-- 20260625_fix_county_code_derivation.sql) EXCEPT one incidental fix
-- noted inline below: create_cooperative_with_officer accepts p_email
-- but — as of 20260625_fix_county_code_derivation.sql — never actually
-- persists it to cooperative_officers.email. That looks like it was
-- dropped by accident when that migration rewrote the function for the
-- county_code fix (the 20260621 version did persist it). Restored here
-- since it's a one-line fix in a function this migration is already
-- rewriting; flagging it explicitly rather than fixing it silently.
-- ============================================================

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
  v_is_coop_officer boolean;
BEGIN
  -- ── New: refuse if this account is already a cooperative officer ──────
  SELECT EXISTS (
    SELECT 1 FROM public.cooperative_officers WHERE user_id = p_user_id
  ) INTO v_is_coop_officer;

  IF v_is_coop_officer THEN
    RAISE EXCEPTION 'ACCOUNT_IS_COOPERATIVE_OFFICER' USING ERRCODE = 'P0010';
  END IF;

  -- ── Orphan cleanup (from 20260704b) ────────────────────────────────────
  DELETE FROM public.farm_managers fm
   WHERE fm.user_id = p_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.farms f WHERE f.id = fm.farm_id
     );

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


CREATE OR REPLACE FUNCTION public.create_cooperative_with_officer(
  p_cooperative_name   text,
  p_county             text,
  p_sub_county         text,
  p_ward               text,
  p_primary_enterprise text,
  p_user_id            uuid,
  p_email              text       DEFAULT NULL,
  p_registration_number text      DEFAULT NULL,
  p_county_code        text       DEFAULT NULL,
  p_registered_office  text       DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cooperative_id uuid;
  v_reg_year       integer;
  v_county_code    text;
  v_has_live_farm  boolean;
BEGIN
  -- ── New: refuse if this account already manages an existing farm ──────
  -- Deliberately checks against farms.id (not just farm_managers) so a
  -- leftover ORPHANED farm_managers row (pointing at a deleted farm)
  -- doesn't block a legitimate cooperative signup — only a real, live
  -- farm link does.
  SELECT EXISTS (
    SELECT 1
      FROM public.farm_managers fm
      JOIN public.farms f ON f.id = fm.farm_id
     WHERE fm.user_id = p_user_id
  ) INTO v_has_live_farm;

  IF v_has_live_farm THEN
    RAISE EXCEPTION 'ACCOUNT_IS_FARM_OWNER' USING ERRCODE = 'P0011';
  END IF;

  v_county_code := p_county_code;

  IF p_registration_number IS NOT NULL THEN
    -- Extract year (CS/022/0142/2026 -> 2026)
    BEGIN
      v_reg_year := SPLIT_PART(p_registration_number, '/', 4)::integer;
    EXCEPTION WHEN others THEN
      v_reg_year := NULL;
    END;

    -- Derive county_code (CS/022/0142/2026 -> '022') only when the caller
    -- didn't already pass one explicitly.
    IF v_county_code IS NULL THEN
      BEGIN
        v_county_code := LPAD(SPLIT_PART(p_registration_number, '/', 2), 3, '0');
      EXCEPTION WHEN others THEN
        v_county_code := NULL;
      END;
    END IF;
  END IF;

  -- Insert cooperative
  INSERT INTO public.cooperatives (
    cooperative_name,
    county,
    sub_county,
    ward,
    primary_enterprise,
    registration_number,
    county_code,
    registration_year,
    registered_office
  ) VALUES (
    p_cooperative_name,
    p_county,
    p_sub_county,
    p_ward,
    p_primary_enterprise,
    CASE
      WHEN p_registration_number IS NOT NULL
      THEN UPPER(TRIM(p_registration_number))
      ELSE NULL
    END,
    v_county_code,
    v_reg_year,
    p_registered_office
  ) RETURNING id INTO v_cooperative_id;

  -- Link user as administrator.
  -- `email` restored here — see migration header note above; it was
  -- silently dropped when 20260625_fix_county_code_derivation.sql last
  -- rewrote this function.
  INSERT INTO public.cooperative_officers (
    cooperative_id,
    user_id,
    role,
    email
  ) VALUES (
    v_cooperative_id,
    p_user_id,
    'admin',
    p_email
  );

  RETURN v_cooperative_id;
END;
$$;

-- ============================================================
-- VERIFICATION (run manually after applying):
--
--   1. As an account that already manages a farm, calling
--      create_cooperative_with_officer should now fail fast with
--      SQLSTATE P0011 rather than succeeding.
--
--   2. As an account that's already a cooperative officer, calling
--      create_farm_with_manager should now fail fast with SQLSTATE P0010.
--
--   3. Confirm email now persists for NEW cooperative signups:
--        SELECT user_id, email FROM cooperative_officers
--        ORDER BY created_at DESC LIMIT 5;
--      (existing rows created before this migration will still have
--      email = NULL — this only fixes it going forward, it doesn't
--      backfill.)
-- ============================================================
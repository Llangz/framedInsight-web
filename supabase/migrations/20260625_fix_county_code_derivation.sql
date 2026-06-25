-- ============================================================
-- Migration: Fix county_code derivation
-- framedInsight — 20260625_fix_county_code_derivation.sql
--
-- Bug: create_cooperative_with_officer only set county_code
-- from the p_county_code parameter. No caller ever computed
-- and passed that parameter separately — signup form only
-- collects registration_number as one string (e.g. CS/022/0142/2026).
-- so county_code was landing as NULL for every new cooperative
-- even when a valid registration number was supplied.
--
-- Fix: derive county_code server-side from registration_number
-- whenever p_county_code isn't explicitly supplied, using the
-- same parsing rule as validate_coop_registration_number().
-- p_county_code is left in the signature so an explicit value
-- (e.g. from a future admin correction screen) still wins.
--
-- NOTE: This migration also fixes the prior migration failure:
-- COMMENT ON FUNCTION must specify the full argument list when
-- multiple overloads exist.
-- ============================================================

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
BEGIN
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

  -- Link user as administrator
  INSERT INTO public.cooperative_officers (
    cooperative_id,
    user_id,
    role
  ) VALUES (
    v_cooperative_id,
    p_user_id,
    'admin'
  );

  RETURN v_cooperative_id;
END;
$$;

COMMENT ON FUNCTION public.create_cooperative_with_officer(
  p_cooperative_name text,
  p_county text,
  p_sub_county text,
  p_ward text,
  p_primary_enterprise text,
  p_user_id uuid,
  p_email text,
  p_registration_number text,
  p_county_code text,
  p_registered_office text
) IS
  'Creates a cooperative + its founding admin officer. county_code is derived '
  'from registration_number server-side when not explicitly supplied, so it '
  'is populated even when the client only ever sends the combined CS/ string.';
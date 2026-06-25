-- ============================================================
-- Migration: Cooperative Registration Number
-- framedInsight — 20260625_cooperative_registration_number.sql
--
-- Adds the official Kenya Cooperative Registration Number to
-- the cooperatives table.
-- Format: CS/[CountyCode]/[SequentialNumber]/[Year]
-- e.g.    CS/022/0142/2019  (Nyeri County = 022)
--
-- Also adds county_code for generating lot numbers and
-- passport codes that reference the official county identifier.
-- ============================================================

-- 1. Add columns to cooperatives
ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS registration_number  text UNIQUE,
  ADD COLUMN IF NOT EXISTS county_code          text,      -- 3-digit Kenya county code e.g. '022'
  ADD COLUMN IF NOT EXISTS registration_year    integer,   -- year extracted from reg number
  ADD COLUMN IF NOT EXISTS registered_office    text,      -- physical address of head office
  ADD COLUMN IF NOT EXISTS commissioner_ref     text;      -- Commissioner for Co-operative Development ref

-- 2. Index for fast lookup by registration number (used in B2B API and passport)
CREATE INDEX IF NOT EXISTS idx_cooperatives_reg_number
  ON public.cooperatives(registration_number)
  WHERE registration_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cooperatives_county_code
  ON public.cooperatives(county_code)
  WHERE county_code IS NOT NULL;

-- 3. Validate format: CS/[3-digit county]/[digits]/[4-digit year]
--    Accepts both CS/022/0142/2019 and CS/22/142/2019 (loose)
ALTER TABLE public.cooperatives
  ADD CONSTRAINT chk_registration_number_format
  CHECK (
    registration_number IS NULL
    OR registration_number ~ '^CS/\d{2,3}/\d+/\d{4}$'
  );

-- 4. Validation helper function (callable from app layer)
CREATE OR REPLACE FUNCTION public.validate_coop_registration_number(p_reg_number text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_parts text[];
  v_county_code text;
  v_seq text;
  v_year integer;
BEGIN
  -- Normalize to uppercase and trim
  p_reg_number := UPPER(TRIM(p_reg_number));

  -- Basic format check
  IF p_reg_number !~ '^CS/\d{2,3}/\d+/\d{4}$' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid format. Expected CS/[CountyCode]/[Number]/[Year] e.g. CS/022/0142/2019'
    );
  END IF;

  -- Split parts
  v_parts      := string_to_array(p_reg_number, '/');
  v_county_code := LPAD(v_parts[2], 3, '0');  -- normalise to 3 digits
  v_seq        := v_parts[3];
  v_year       := v_parts[4]::integer;

  -- Year sanity
  IF v_year < 1945 OR v_year > EXTRACT(YEAR FROM now())::integer THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Registration year appears invalid'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid',        true,
    'normalized',   'CS/' || v_county_code || '/' || v_seq || '/' || v_year::text,
    'county_code',  v_county_code,
    'sequence',     v_seq,
    'year',         v_year
  );
END;
$$;

-- 5. Update create_cooperative_with_officer RPC to accept registration_number
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
BEGIN
  -- Extract year from registration number if provided
  IF p_registration_number IS NOT NULL THEN
    BEGIN
      v_reg_year := SPLIT_PART(p_registration_number, '/', 4)::integer;
    EXCEPTION WHEN others THEN
      v_reg_year := NULL;
    END;
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
    p_county_code,
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

-- 6. Comment the columns for documentation
COMMENT ON COLUMN public.cooperatives.registration_number IS
  'Kenya Cooperative Registration Number. Format: CS/[CountyCode]/[Seq]/[Year]. e.g. CS/022/0142/2019';
COMMENT ON COLUMN public.cooperatives.county_code IS
  '3-digit Kenya county code per KRA/KNBS standard. e.g. 022 for Nyeri, 047 for Nairobi';
COMMENT ON COLUMN public.cooperatives.registration_year IS
  'Year of registration extracted from registration_number. Indexed for cohort queries.';
COMMENT ON COLUMN public.cooperatives.registered_office IS
  'Physical address of the cooperative head office as per Registrar records.';
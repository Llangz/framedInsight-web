-- supabase/migrations/20260629_traceability_hash_versioning.sql
--
-- Adds explicit hash algorithm versioning for traceability events.
-- Existing rows were hashed with JavaScript JSON.stringify object insertion order.
-- New rows are hashed with recursively key-sorted canonical JSON so buyers and
-- auditors can recompute hashes after event_data has round-tripped through jsonb.

ALTER TABLE public.traceability_events
  ADD COLUMN IF NOT EXISTS hash_algorithm text NOT NULL DEFAULT 'v1_insertion_order';

COMMENT ON COLUMN public.traceability_events.hash_algorithm IS
  'v1_insertion_order = legacy JavaScript JSON.stringify insertion-order hash. v2_canonical = recursively key-sorted canonical JSON hash, independently recomputable after jsonb storage.';

UPDATE public.traceability_events
SET hash_algorithm = 'v1_insertion_order'
WHERE hash_algorithm IS NULL;

ALTER TABLE public.traceability_events
  ADD CONSTRAINT traceability_events_hash_algorithm_check
  CHECK (hash_algorithm IN ('v1_insertion_order', 'v2_canonical'))
  NOT VALID;

ALTER TABLE public.traceability_events
  VALIDATE CONSTRAINT traceability_events_hash_algorithm_check;

-- Fix the concurrent passport-code race while this traceability surface is being
-- hardened. The advisory transaction lock serializes code generation per
-- cooperative/year, avoiding duplicate FI-YYYY-0001 style codes under load.
CREATE OR REPLACE FUNCTION public.generate_passport_code(
  p_cooperative_id uuid,
  p_year           integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := COALESCE(p_year, EXTRACT(YEAR FROM now())::integer);
  v_seq  integer;
  v_code text;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_cooperative_id::text || ':' || v_year::text, 0)
  );

  SELECT COUNT(*) + 1
  INTO v_seq
  FROM public.coffee_passports
  WHERE cooperative_id = p_cooperative_id
    AND EXTRACT(YEAR FROM created_at)::integer = v_year;

  v_code := 'FI-' || v_year::text || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_code;
END;
$$;

-- Migration to add securely provision farm RPC
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
  p_subscription_end_date timestamp with time zone
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farm_id uuid;
BEGIN
  -- Insert into farms
  INSERT INTO public.farms (
    farm_name,
    owner_name,
    phone,
    county,
    sub_county,
    ward,
    is_active,
    subscription_tier,
    subscription_end_date,
    farm_types,
    primary_enterprise
  ) VALUES (
    p_farm_name,
    p_owner_name,
    p_phone,
    p_county,
    p_sub_county,
    p_ward,
    true,
    'smallholder',
    p_subscription_end_date,
    p_farm_types,
    p_primary_enterprise
  ) RETURNING id INTO v_farm_id;

  -- Link user to farm
  INSERT INTO public.farm_managers (
    user_id,
    farm_id,
    role
  ) VALUES (
    p_user_id,
    v_farm_id,
    'owner'
  );

  RETURN v_farm_id;
END;
$$;

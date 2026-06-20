-- SQL Migration for Cooperative Account Model & Fleet Mapping

-- 1. Create cooperatives table
CREATE TABLE IF NOT EXISTS public.cooperatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_name text NOT NULL,
  county text NOT NULL,
  sub_county text,
  ward text,
  primary_enterprise text NOT NULL, -- 'coffee' | 'dairy' | 'livestock' | 'poultry'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create coop_factories table (washing stations / wet mills / collection points)
CREATE TABLE IF NOT EXISTS public.coop_factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  factory_name text NOT NULL,
  factory_code text, -- traceability code
  branch_type text DEFAULT 'washing_station', -- 'washing_station' | 'milk_cooling_plant' | 'poultry_collection_point' | 'other'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create cooperative_officers join table
CREATE TABLE IF NOT EXISTS public.cooperative_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- references auth.users(id)
  role text DEFAULT 'officer', -- 'admin' | 'officer'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_coop_user UNIQUE (cooperative_id, user_id)
);

-- 4. Extend public.farms table with cooperative columns
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS managed_by_coop_id uuid REFERENCES public.cooperatives(id) ON DELETE SET NULL;
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS coop_factory_id uuid REFERENCES public.coop_factories(id) ON DELETE SET NULL;
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS is_coop_managed boolean DEFAULT false;
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS claim_token text UNIQUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_farms_coop_id ON public.farms(managed_by_coop_id);
CREATE INDEX IF NOT EXISTS idx_farms_coop_factory_id ON public.farms(coop_factory_id);
CREATE INDEX IF NOT EXISTS idx_cooperative_officers_user ON public.cooperative_officers(user_id);
CREATE INDEX IF NOT EXISTS idx_coop_factories_coop_id ON public.coop_factories(cooperative_id);

-- 5. Atomic transaction RPC to register a cooperative + admin officer
CREATE OR REPLACE FUNCTION public.create_cooperative_with_officer(
  p_cooperative_name text,
  p_county text,
  p_sub_county text,
  p_ward text,
  p_primary_enterprise text,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cooperative_id uuid;
BEGIN
  -- Insert cooperative
  INSERT INTO public.cooperatives (
    cooperative_name,
    county,
    sub_county,
    ward,
    primary_enterprise
  ) VALUES (
    p_cooperative_name,
    p_county,
    p_sub_county,
    p_ward,
    p_primary_enterprise
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

-- 6. Update can_manage_farm to support cooperative officers
CREATE OR REPLACE FUNCTION public.can_manage_farm(p_farm_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.farm_managers
    WHERE farm_id = p_farm_id
    AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.farms f
    JOIN public.cooperative_officers co ON co.cooperative_id = f.managed_by_coop_id
    WHERE f.id = p_farm_id
    AND co.user_id = auth.uid()
  );
END;
$$;

-- 7. Enable RLS and define Policies
ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coop_factories ENABLE ROW LEVEL SECURITY;

-- Cooperative Policies
CREATE POLICY "Cooperative officers can view their cooperative" ON public.cooperatives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = cooperatives.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Cooperative admins can update their cooperative" ON public.cooperatives
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = cooperatives.id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Cooperative Officer Policies
CREATE POLICY "Cooperative officers can view fellow officers" ON public.cooperative_officers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = cooperative_officers.cooperative_id
      AND co.user_id = auth.uid()
    )
  );

-- Cooperative Factory Policies
CREATE POLICY "Cooperative officers can view factories" ON public.coop_factories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = coop_factories.cooperative_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Cooperative officers can manage factories" ON public.coop_factories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers
      WHERE cooperative_id = coop_factories.cooperative_id
      AND user_id = auth.uid()
    )
  );

-- 8. Add access policies for main entity tables for cooperative officers
-- Since RLS combines policies using OR, we add permissive policies matching can_manage_farm
CREATE POLICY "Cooperative officers can view farms" ON public.farms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = farms.managed_by_coop_id
      AND co.user_id = auth.uid()
    )
  );

CREATE POLICY "Cooperative officers can update farms" ON public.farms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = farms.managed_by_coop_id
      AND co.user_id = auth.uid()
    )
  );

CREATE POLICY "Cooperative officers can delete farms" ON public.farms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.cooperative_officers co
      WHERE co.cooperative_id = farms.managed_by_coop_id
      AND co.user_id = auth.uid()
      AND co.role = 'admin'
    )
  );

-- Plot Policies for Coop
CREATE POLICY "Cooperative officers can manage plots" ON public.coffee_plots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.cooperative_officers co ON co.cooperative_id = f.managed_by_coop_id
      WHERE f.id = coffee_plots.farm_id
      AND co.user_id = auth.uid()
    )
  );

-- Harvest Policies for Coop
CREATE POLICY "Cooperative officers can manage harvests" ON public.coffee_harvests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.cooperative_officers co ON co.cooperative_id = f.managed_by_coop_id
      WHERE f.id = coffee_harvests.farm_id
      AND co.user_id = auth.uid()
    )
  );

-- Activities Policies for Coop
CREATE POLICY "Cooperative officers can manage activities" ON public.coffee_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.cooperative_officers co ON co.cooperative_id = f.managed_by_coop_id
      WHERE f.id = coffee_activities.farm_id
      AND co.user_id = auth.uid()
    )
  );

-- EUDR Compliance Policies for Coop
CREATE POLICY "Cooperative officers can manage EUDR compliance" ON public.coffee_eudr_compliance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.cooperative_officers co ON co.cooperative_id = f.managed_by_coop_id
      WHERE f.id = coffee_eudr_compliance.farm_id
      AND co.user_id = auth.uid()
    )
  );

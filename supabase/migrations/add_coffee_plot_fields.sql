-- Add the missing fields to coffee_plots to match frontend requirements
ALTER TABLE public.coffee_plots 
ADD COLUMN IF NOT EXISTS productive_trees INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS land_size_acres NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS establishment_year INTEGER;

-- Optionally, backfill existing records if needed
-- UPDATE public.coffee_plots SET land_size_acres = ROUND((area_hectares * 2.47105)::numeric, 2) WHERE area_hectares IS NOT NULL AND land_size_acres IS NULL;
-- UPDATE public.coffee_plots SET establishment_year = EXTRACT(YEAR FROM CURRENT_DATE) - age_years WHERE age_years IS NOT NULL AND establishment_year IS NULL;

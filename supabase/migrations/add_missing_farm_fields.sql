-- Add trial and metadata fields to farms table
ALTER TABLE public.farms 
ADD COLUMN IF NOT EXISTS trial_end_date DATE,
ADD COLUMN IF NOT EXISTS establishment_year INTEGER,
ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.farms.trial_end_date IS 'End date of free trial period';
COMMENT ON COLUMN public.farms.establishment_year IS 'Year the farm was established';

-- Create index for trial expiration queries
CREATE INDEX IF NOT EXISTS idx_farms_trial_end_date ON public.farms(trial_end_date) 
WHERE trial_end_date IS NOT NULL;
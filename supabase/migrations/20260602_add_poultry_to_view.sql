-- Migration: Add poultry support to v_farm_summary view
-- Purpose: Add has_poultry and poultry statistics columns to the farm summary view

DROP VIEW IF EXISTS public.v_farm_summary CASCADE;

CREATE VIEW public.v_farm_summary AS
SELECT 
  f.id,
  f.farm_name,
  f.owner_name,
  f.county,
  f.subscription_tier,
  (f.farm_types @> ARRAY['dairy'::text]) AS has_dairy,
  (f.farm_types @> ARRAY['coffee'::text]) AS has_coffee,
  (f.farm_types @> ARRAY['small_ruminants'::text]) AS has_small_ruminants,
  (f.farm_types @> ARRAY['poultry'::text]) AS has_poultry,
  (SELECT COUNT(*) FROM cows c WHERE c.farm_id = f.id AND c.exit_date IS NULL) AS total_cows,
  (SELECT COALESCE(SUM(mr.total_milk), 0) FROM milk_records mr JOIN cows c ON mr.cow_id = c.id WHERE c.farm_id = f.id AND DATE(mr.record_date) = CURRENT_DATE) AS today_milk_liters,
  (SELECT COUNT(*) FROM coffee_plots cp WHERE cp.farm_id = f.id) AS total_coffee_acres,
  (SELECT COUNT(*) FROM small_ruminants sr WHERE sr.farm_id = f.id AND sr.exit_date IS NULL) AS total_small_ruminants,
  (SELECT COUNT(*) FROM poultry_batches pb WHERE pb.farm_id = f.id AND pb.status != 'closed') AS total_poultry_birds,
  (SELECT COALESCE(SUM(per.total_eggs), 0) FROM poultry_egg_records per WHERE per.farm_id = f.id AND DATE(per.record_date) = CURRENT_DATE) AS today_eggs,
  (SELECT COUNT(*) FROM poultry_batches pb WHERE pb.farm_id = f.id AND pb.bird_type = 'layer' AND pb.status != 'closed') AS poultry_layers,
  (SELECT COUNT(*) FROM poultry_batches pb WHERE pb.farm_id = f.id AND pb.bird_type = 'broiler' AND pb.status != 'closed') AS poultry_broilers,
  f.created_at
FROM farms f;

GRANT SELECT ON v_farm_summary TO authenticated, anon;

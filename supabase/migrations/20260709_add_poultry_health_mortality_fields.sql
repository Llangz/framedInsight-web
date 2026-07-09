-- 📁 FILE PATH: supabase/migrations/20260709_add_poultry_health_mortality_fields.sql
--
-- app/dashboard/poultry/health/HealthClient.tsx and
-- app/dashboard/poultry/mortality/MortalityClient.tsx both collect these
-- fields in their forms, but they were never part of the poultry_health_records
-- / poultry_mortality tables, so every save silently dropped them —
-- farmers entering a vaccine name, drug, dosage, vet, cost, cause of death,
-- symptoms, or culling reason were seeing "Saved!" while that data quietly
-- vanished. This adds the columns so the data is actually persisted.

alter table public.poultry_health_records
  add column if not exists vaccine_name text,
  add column if not exists disease      text,
  add column if not exists drug_name    text,
  add column if not exists dosage       text,
  add column if not exists vet_name     text,
  add column if not exists cost         numeric(10, 2) check (cost is null or cost >= 0);

alter table public.poultry_mortality
  add column if not exists cause          text,
  add column if not exists symptoms       text,
  add column if not exists culling_reason text;

comment on column public.poultry_health_records.vaccine_name is 'Vaccine administered, for event_type = vaccination';
comment on column public.poultry_health_records.disease is 'Disease/condition treated, for event_type = treatment/deworming';
comment on column public.poultry_health_records.drug_name is 'Drug or product used, for event_type = treatment/deworming';
comment on column public.poultry_health_records.dosage is 'Free-text dosage/route, e.g. "1 drop per bird - eye" or "1g per litre for 5 days"';
comment on column public.poultry_health_records.vet_name is 'Attending vet or agrovet name/contact';
comment on column public.poultry_health_records.cost is 'Cost of the vaccination/treatment in KES';

comment on column public.poultry_mortality.cause is 'Likely cause of death, selected from a preset list or free text';
comment on column public.poultry_mortality.symptoms is 'Symptoms observed prior to death';
comment on column public.poultry_mortality.culling_reason is 'Reason for culling, when this record represents a cull rather than a death';
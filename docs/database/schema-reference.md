# Database Schema Reference

Complete table-by-table reference for the `public` schema (73 tables, confirmed complete against the live database export in `docs_source/schema_tables.md`). Compact format: `column:type` — a trailing `?` marks nullable, `=value` shows the default. This mirrors the format already used internally in `lib/schemaframedInsight.md`, extended here to cover the 13 cooperative/traceability tables added since that file was last generated (`cooperatives`, `coop_factories`, `cooperative_officers`, `factory_intake_lots`, `lot_farmer_deliveries`, `processing_batches`, `mill_lots`, `mill_lot_batches`, `export_lots`, `export_lot_mill_lots`, `coffee_passports`, `traceability_events`, `auth_phone_salts`).

For business meaning of fields, enum-like value sets, and known denormalization gotchas, see `docs/database/data-dictionary.md`. For full RLS policy logic, see `docs/database/rls-policies.md`. For trigger-enforced invariants, see `docs/database/triggers-reference.md`.

> Two entries below (`factory_intake_lots`, `lot_farmer_deliveries`) have partial column lists — their full DDL wasn't captured in the migration pass this document was built from (they're referenced by other tables' FKs and by `lib/passport/passport.service.ts`, but their own `CREATE TABLE` statement wasn't located in `supabase/migrations/`). Worth a direct `\d factory_intake_lots` / `\d lot_farmer_deliveries` against the live database to fill this in completely.

---

## Identity & Access

### `farm_managers`
The core ownership join: which users manage which farms, and in what role.

- **Columns:** user_id:uuid, farm_id:uuid, role:text?, created_at:timestamptz?=now()
- **FKs:** none
- **RLS:** ALL/INSERT: `(auth.uid() = user_id)`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_farm_managers_farm_id: (farm_id); idx_farm_managers_farm: (farm_id); idx_farm_managers_user: (user_id); idx_farm_managers_user_farm: (user_id, farm_id); idx_farm_managers_user_id: (user_id)
- **Triggers:** none

### `cooperative_officers`
Join table: which users are officers (admin/officer) of which cooperative.

- **Columns:** id:uuid=gen_random_uuid(), cooperative_id:uuid, user_id:uuid, role:text?='officer', email:text? (added 2026-06-25), created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** cooperative_id→cooperatives.id, user_id→auth.users.id (not enforced as a DB FK)
- **RLS:** SELECT: fellow officers of the same cooperative; INSERT: existing 'admin' officers of the same cooperative only (added 2026-06-25, after a gap where only the SECURITY DEFINER signup RPC could insert)
- **Indexes:** idx_cooperative_officers_user: (user_id); unique_coop_user: (cooperative_id, user_id)
- **Triggers:** none

### `auth_phone_salts`
Per-phone-number salt for deriving the "ghost password" used to bridge phone-OTP auth into Supabase Auth. Service-role only, zero RLS policies by design.

- **Columns:** phone_number:text (PK), salt:uuid=gen_random_uuid(), scheme:text='salted_hmac_v1', created_at:timestamptz=now(), migrated_at:timestamptz?
- **FKs:** none
- **RLS:** enabled, **zero policies** — service-role only by design (browser/anon can never read or write this table)
- **Indexes:** (pkey only)
- **Triggers:** none

### `phone_otp_codes`
Transient OTP codes for phone-based login, one row per phone number, 15-minute expiry.

- **Columns:** id:uuid=gen_random_uuid(), phone_number:text, otp_code:text, expires_at:timestamptz, metadata:jsonb?, created_at:timestamptz?=now()
- **FKs:** none
- **RLS:** ALL/DELETE/INSERT/SELECT/UPDATE: `true`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_phone_otp_phone: (phone_number); phone_otp_codes_phone_number_key: (phone_number); idx_phone_otp_expires: (expires_at)
- **Triggers:** none

### `rate_limits`
Generic per-user/per-endpoint request-rate tracking.

- **Columns:** id:bigint=nextval('rate_limits_id_seq'::regclass), user_id:uuid?, farm_id:uuid?, endpoint:text, request_count:integer?=1, reset_at:timestamptz, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(user_id = auth.uid())`
- **Indexes:** idx_rate_limits_reset_at: (reset_at); idx_rate_limits_user_endpoint_reset: (user_id, endpoint, reset_at)
- **Triggers:** none

### `audit_logs`
Service-role-written audit trail of sensitive actions (auth, RPC calls, etc.).

- **Columns:** id:uuid=gen_random_uuid(), action:text, actor_id:uuid?, farm_id:uuid?, resource:text, resource_id:text?, details:jsonb?='{}'::jsonb, ip_address:text?, user_agent:text?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_audit_logs_actor: (actor_id, created_at DESC); idx_audit_logs_action: (action, created_at DESC); idx_audit_logs_created: (created_at DESC); idx_audit_logs_farm: (farm_id, created_at DESC)
- **Triggers:** none

---

## Cooperative

### `cooperatives`
The cooperative entity itself — name, location, primary enterprise.

- **Columns:** id:uuid=gen_random_uuid(), cooperative_name:text, county:text, sub_county:text?, ward:text?, primary_enterprise:text, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** none
- **RLS:** SELECT: officers of this cooperative only; UPDATE: officers with role='admin' only
- **Indexes:** (pkey only)
- **Triggers:** none

### `coop_factories`
A cooperative's physical processing points (washing stations, milk coolers, poultry collection points).

- **Columns:** id:uuid=gen_random_uuid(), cooperative_id:uuid, factory_name:text, factory_code:text?, branch_type:text?='washing_station', created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** cooperative_id→cooperatives.id
- **RLS:** SELECT/ALL: cooperative officers of the owning cooperative
- **Indexes:** idx_coop_factories_coop_id: (cooperative_id)
- **Triggers:** none

---

## Farm Core

### `farms`
The central tenant table. Every enterprise hangs off `farm_id`.

- **Columns:** id:uuid=gen_random_uuid(), farm_name:text, owner_name:text, phone:text, email:text?, location:text?, county:text?, sub_county:text?, ward:text?, gps_latitude:numeric?, gps_longitude:numeric?, farm_types:ARRAY?='{}'::text[], primary_enterprise:text?, land_size_acres:numeric?, is_active:boolean?=true, subscription_tier:text?='free'::text, subscription_start_date:date?, subscription_end_date:date?, created_at:timestamp?=now(), updated_at:timestamp?=now(), whatsapp_language:text?='en'::text
- **FKs:** none
- **RLS:** SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers WHERE ((farm_managers.farm_id = farms.id) AND (farm_managers.user_id = auth.uid()))))`; ALL: `(auth.role() = 'service_role'::text)`; INSERT: `true`
- **Indexes:** farms_phone_key: (phone); idx_farms_subscription: (subscription_tier, subscription_end_date) WHERE (subscription_end_date IS NOT NULL); idx_farms_subscription_tier: (subscription_tier); idx_farms_phone: (phone)
- **Triggers:** trg_farms_updated_at (BEFORE), update_farms_updated_at (BEFORE)

### `farm_type_configs`
Per-farm, per-enterprise UX configuration: measurement units, language, alert channels, feature toggles.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, farm_type:text, active_modules:ARRAY?='{}'::text[], measurement_units:text?='metric'::text, language:text?='english'::text, alerts_enabled:boolean?=true, alert_channels:ARRAY?='{whatsapp}'::text[], ai_diagnostics_enabled:boolean?=true, voice_notes_enabled:boolean?=false, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** farm_type_configs_farm_id_farm_type_key: (farm_id, farm_type); idx_farm_type_configs_farm_id: (farm_id)
- **Triggers:** none

### `farm_events`
General-purpose event-sourcing log (EUDR assessments, dairy events, etc.) — see traceability-architecture.md for how this differs in maturity from `traceability_events`.

- **Columns:** id:uuid, farm_id:uuid?, event_type:text?, event_data:jsonb?, created_at:timestamp?, processed_at:timestamp?
- **FKs:** none
- **RLS:** none
- **Indexes:** none (pkey only)
- **Triggers:** none

---

## Coffee — Production & Plots

### `coffee_plots`
The core coffee land-parcel record: GPS point or polygon, area, variety, EUDR risk fields. Most coffee tables hang off `plot_id`.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_name:text, plot_code:text?, variety:text?, planting_date:date?, age_years:integer?=0, total_trees:integer=0, plant_spacing_meters:numeric?, plant_status:text?='productive'::text, gps_latitude:numeric?, gps_longitude:numeric?, gps_polygon:jsonb?, area_hectares:numeric?, eudr_risk_level:text?, eudr_risk_assessed_at:timestamptz?, eudr_risk_details:text?, afa_geo_mapping_id:text?, land_ownership_type:text?, land_ownership_doc_url:text?, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now(), region_name:text?, productive_trees:integer?=0, land_size_acres:numeric?, establishment_year:integer?
- **FKs:** farm_id→farms.id
- **RLS:** ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_coffee_plots_farm: (farm_id); idx_coffee_plots_farm_id: (farm_id); idx_coffee_plots_eudr_risk: (eudr_risk_level); idx_coffee_plots_afa_id: (afa_geo_mapping_id) WHERE (afa_geo_mapping_id IS NOT NULL); idx_coffee_plots_polygon: (gps_polygon); idx_coffee_plots_region: (region_name); idx_plots_region: (region_name)
- **Triggers:** update_coffee_plots_updated_at (BEFORE)

### `coffee_plants`
Individual-plant-level record with its own GPS point and QR code — a finer grain than `coffee_plots`, used where per-tree tracking matters (e.g. EUDR plant-level compliance flag).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plant_tag:text?, qr_code:text?, plot_id:text, gps_latitude:numeric?, gps_longitude:numeric?, variety:text?, planting_date:date?, age_years:numeric?, plant_spacing_meters:numeric?, plant_status:text?='productive'::text, deforestation_risk_status:text?, forest_cover_certification:text?, land_ownership_doc_url:text?, eudr_compliant:boolean?=false, notes:text?, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** coffee_plants_qr_code_key: (qr_code); idx_coffee_plants_farm_id: (farm_id); idx_coffee_plants_farm: (farm_id); idx_coffee_plants_plot: (plot_id)
- **Triggers:** update_coffee_plants_updated_at (BEFORE)

### `coffee_activities`
Field activity log (Nutrition/Crop Protection/weeding/pruning/labour), restructured mid-2026 from flat fertilizer/spraying types into agronomic categories.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:uuid?, activity_type:text, activity_date:date=CURRENT_DATE, weeding_method:text?, product_name:text?, quantity:numeric?, quantity_unit:text?, cost_inputs:numeric?=0, fertilizer_type:text?, application_method:text?, spray_type:text?, spray_reason:text?, dilution_rate:text?, litres_water:numeric?, weather_conditions:text?, pruning_type:text?, area_covered_ha:numeric?, labour_mode:text?, num_workers:integer?, days_worked:numeric?, rate_per_day:numeric?, cost_labour:numeric?=0, total_cost:numeric?, calendar_triggered:boolean?=false, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** plot_id→coffee_plots.id, farm_id→farms.id
- **RLS:** ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_coffee_activities_date: (activity_date DESC); idx_coffee_activities_plot_id: (plot_id); idx_coffee_activities_farm_year: (farm_id, EXTRACT(year FROM activity_date)); idx_coffee_activities_farm_id: (farm_id); idx_coffee_activities_type: (activity_type)
- **Triggers:** update_coffee_activities_updated_at (BEFORE)

### `coffee_inputs`
Input application log (fertilizer, labour) — overlaps in purpose with parts of `coffee_activities`; likely an earlier, narrower table.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, input_date:date, input_type:text, fertilizer_type:text?, quantity_kg:numeric?, labor_type:text?, labor_hours:numeric?, labor_cost:numeric?, number_of_workers:integer?, plot_applied:text?, trees_treated:integer?, unit_cost:numeric?, total_cost:numeric?, supplier_name:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_inputs_farm_id: (farm_id)
- **Triggers:** none

### `coffee_harvests`
Harvest delivery record — cherry or mbuni, quantity, price, payment status. The revenue-side anchor for coffee P&L views.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_name:text, harvest_date:date, harvest_season:text?, harvest_year:integer?, cherry_kg:numeric, quality_grade:text?, cherry_condition:text?, processing_method:text?='Wet/Washed'::text, parchment_kg:numeric?, clean_coffee_kg:numeric?, price_per_kg:numeric?, total_value:numeric?, buyer_name:text?, cooperative_name:text?, payment_status:text?='pending'::text, payment_date:date?, amount_paid:numeric?, lot_number:text?, notes:text?, created_at:timestamp?=now(), nce_transaction_id:text?, produce_type:text?='cherry'::text, produce_kg:numeric, mbuni_accepted:boolean?=true, mbuni_rejection_reason:text?, receipt_number:text?, factory_code:text?
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`; ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_coffee_harvests_farm_year_season: (farm_id, harvest_year, harvest_season); idx_coffee_harvests_farm_harvest_date: (farm_id, harvest_date DESC); idx_harvests_produce_type: (produce_type); idx_harvests_payment_status: (payment_status); idx_coffee_harvests_pending_payments: (farm_id, harvest_date) WHERE (payment_status = 'pending'::text); idx_coffee_harvests_plot: (plot_name); idx_coffee_harvests_farm_id: (farm_id)
- **Triggers:** none

### `coffee_financials`
General coffee-related financial transactions outside the harvest-payment flow (e.g. input purchases recorded as cash transactions).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, transaction_date:date, category:text, description:text?, amount:numeric, payment_method:text?, transaction_ref:text?, cooperative_name:text?, buyer_name:text?, plot_id:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_financials_farm_id: (farm_id)
- **Triggers:** none

---

## Coffee — Health, Pests & Compliance

### `coffee_health_records`
Coffee pest/disease inspection records with AI-diagnosis fields — predates the more structured `coffee_scouting_records` model.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:text, inspection_date:date, coffee_berry_disease_severity:text?, coffee_leaf_rust_severity:text?, bacterial_blight_present:boolean?=false, antestia_bugs_severity:text?, stem_borers_present:boolean?=false, berry_borers_present:boolean?=false, treatment_applied:text?, chemical_name:text?, chemical_quantity:text?, application_method:text?, leaf_photo_url:text?, berry_photo_url:text?, ai_diagnosis:text?, ai_confidence_score:numeric?, cost:numeric?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_health_plot: (plot_id); idx_coffee_health_farm_id: (farm_id)
- **Triggers:** none

### `coffee_scouting_records`
Structured field-scouting observation (pest/disease type, severity, threshold-breach flag, action taken) — the current model for pest/disease tracking, superseding the older flat `coffee_diseases` table (no longer live).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:uuid, scouting_date:date=CURRENT_DATE, scouted_by:text?, observation_type:text, severity_level:text?, trees_sampled:integer?, pest_count_total:integer?, pest_count_per_tree:numeric?, cbd_green_berries_affected:integer?, cbd_yellow_berries_affected:integer?, cbd_red_berries_affected:integer?, clr_leaves_affected:integer?, clr_defoliation_observed:boolean?, area_affected_ha:numeric?, percentage_plot_affected:numeric?, weather_past_week:text?, action_taken:text?, spray_activity_id:uuid?, threshold_breached:boolean?=false, alert_level:text?, symptoms_description:text?, photo_urls:ARRAY?, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** plot_id→coffee_plots.id, farm_id→farms.id, spray_activity_id→coffee_activities.id
- **RLS:** ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_scouting_threshold: (threshold_breached); idx_scouting_farm_id: (farm_id); idx_scouting_plot_id: (plot_id); idx_scouting_date: (scouting_date DESC); idx_scouting_type: (observation_type)
- **Triggers:** update_coffee_scouting_records_updated_at (BEFORE)

### `coffee_disease_thresholds`
Region-specific action thresholds for pest/disease scouting (watch/action/emergency counts) — global reference data, publicly readable.

- **Columns:** id:uuid=gen_random_uuid(), region_name:text, disease_pest_type:text, watch_threshold:text?, action_threshold:text?, emergency_threshold:text?, watch_count:numeric?, action_count:numeric?, emergency_count:numeric?, recommended_product:text?, alternative_products:ARRAY?, application_notes:text?, why_different:text?, high_risk_months:ARRAY?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** none
- **RLS:** SELECT: `true`
- **Indexes:** idx_thresholds_pest: (disease_pest_type); idx_thresholds_region: (region_name); coffee_disease_thresholds_region_name_disease_pest_type_key: (region_name, disease_pest_type)
- **Triggers:** update_coffee_disease_thresholds_updated_at (BEFORE)

### `coffee_pest_library`
Reference library of pest/disease identification info (symptoms, control measures, photos) — global, publicly readable.

- **Columns:** id:uuid=gen_random_uuid(), pest_disease_code:text, common_name_english:text, common_name_swahili:text?, scientific_name:text?, category:text, symptoms_description:text?, early_stage_symptoms:text?, late_stage_symptoms:text?, affected_plant_parts:ARRAY?, photo_urls:ARRAY?, video_url:text?, cultural_control:text?, chemical_control:text?, registered_products:ARRAY?, organic_control:text?, yield_loss_potential:text?, quality_impact:text?, prevention_tips:text?, high_risk_conditions:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** none
- **RLS:** none
- **Indexes:** idx_pest_library_code: (pest_disease_code); coffee_pest_library_pest_disease_code_key: (pest_disease_code); idx_pest_library_category: (category)
- **Triggers:** update_coffee_pest_library_updated_at (BEFORE)

### `coffee_calendar_regions`
Region-by-month recommended activity calendar, used to drive proactive farmer reminders.

- **Columns:** id:uuid=gen_random_uuid(), region_name:text, counties:ARRAY, month:integer, recommended_activities:jsonb, season_context:text?
- **FKs:** none
- **RLS:** none
- **Indexes:** idx_calendar_month: (month); idx_calendar_region: (region_name)
- **Triggers:** none

### `coffee_eudr_compliance`
Authoritative per-plot EUDR risk assessment (risk level, forest cover %, deforestation flag, evidence photos). Written by the `check-eudr-risk` edge function.

- **Columns:** id:uuid=gen_random_uuid(), plot_id:uuid, farm_id:uuid, assessment_date:date=CURRENT_DATE, risk_level:text?='unknown'::text, deforestation_risk:boolean?=false, forest_cover_pct:numeric?, last_forest_change_year:integer?, afa_verified:boolean?=false, afa_verification_date:date?, land_use_before_2020:text?, compliance_status:text?='pending'::text, notes:text?, raw_api_response:jsonb?, created_at:timestamptz?=now(), updated_at:timestamptz?=now(), evidence_photos:ARRAY?=ARRAY[]::text[]
- **FKs:** farm_id→farms.id, plot_id→coffee_plots.id
- **RLS:** SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; ALL: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_eudr_plot_id: (plot_id, compliance_status)
- **Triggers:** none

---

## Coffee — Satellite & Weather

### `coffee_satellite_indices`
NDVI/NDRE/NDWI vegetation health indices per plot per image date, with computed health score/label and week-over-week decline tracking.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:uuid, image_date:date, acquired_at:timestamptz?=now(), cloud_cover_pct:numeric?, sentinel_tile:text?, ndvi_mean:numeric?, ndvi_min:numeric?, ndvi_max:numeric?, ndvi_std:numeric?, ndre_mean:numeric?, ndre_min:numeric?, ndre_max:numeric?, ndwi_mean:numeric?, ndwi_min:numeric?, ndwi_max:numeric?, health_score:integer?, health_label:text?, ndvi_change:numeric?, health_score_change:integer?, weeks_of_decline:integer?=0, alert_triggered:boolean?=false, alert_reason:text?, raw_cdse_response:jsonb?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id, plot_id→coffee_plots.id
- **RLS:** SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; ALL: `(auth.role() = 'service_role'::text)`; ALL: `true`
- **Indexes:** idx_sat_health: (health_label); idx_satellite_alerts: (alert_triggered) WHERE (alert_triggered = true); idx_satellite_health_label: (health_label); coffee_satellite_indices_plot_id_image_date_key: (plot_id, image_date); idx_sat_plot_id: (plot_id); idx_sat_farm_id: (farm_id); idx_sat_date: (image_date DESC); idx_sat_alert: (alert_triggered) WHERE (alert_triggered = true); idx_satellite_plot_date: (plot_id, image_date DESC)
- **Triggers:** none

### `coffee_satellite_fetch_log`
Log of attempts to fetch Sentinel satellite imagery per plot (success/failure, cloud cover) — operational, not business data.

- **Columns:** id:uuid=gen_random_uuid(), plot_id:uuid, fetch_attempted_at:timestamptz?=now(), status:text, cloud_cover_pct:numeric?, date_range_from:date?, date_range_to:date?, error_message:text?, processing_units_used:numeric?
- **FKs:** plot_id→coffee_plots.id
- **RLS:** none
- **Indexes:** idx_fetch_log_plot: (plot_id); idx_fetch_log_time: (fetch_attempted_at DESC)
- **Triggers:** none

### `coffee_plot_weather`
Daily weather observations per plot from Open-Meteo, plus computed CBD/CLR/drought risk scores.

- **Columns:** id:uuid=gen_random_uuid(), plot_id:uuid, date:date, temperature_2m_mean:numeric?, temperature_2m_max:numeric?, temperature_2m_min:numeric?, precipitation_sum:numeric?, relative_humidity_2m_mean:numeric?, soil_moisture_0_to_10cm:numeric?, evapotranspiration:numeric?, weather_code:integer?, cbd_risk_score:integer?, clr_risk_score:integer?, drought_stress_score:integer?, created_at:timestamptz?=now()
- **FKs:** plot_id→coffee_plots.id
- **RLS:** ALL: `((auth.jwt() ->> 'role'::text) = 'service_role'::text)`; SELECT: `(EXISTS ( SELECT 1 FROM (farm_managers fm JOIN coffee_plots cp ON ((cp.farm_id = fm.farm_id))) WHERE ((fm.user_id = auth.uid()) AND (cp.i...`
- **Indexes:** coffee_plot_weather_plot_id_date_key: (plot_id, date); idx_weather_plot_date: (plot_id, date DESC); idx_weather_cbd_risk: (cbd_risk_score DESC) WHERE (cbd_risk_score > 60); idx_weather_clr_risk: (clr_risk_score DESC) WHERE (clr_risk_score > 60); idx_weather_drought: (drought_stress_score DESC) WHERE (drought_stress_score > 60)
- **Triggers:** none

---

## Coffee — Quality & Traceability Chain

### `coffee_quality_records`
Cupping/quality data linked to a harvest — score, certifications, blockchain hash field (legacy naming, not used by the actual hash-chain implementation in `traceability_events`).

- **Columns:** id:uuid=gen_random_uuid(), harvest_id:uuid?, cupping_score:numeric?, acidity_score:numeric?, body_score:numeric?, flavor_notes:text?, aroma_score:numeric?, organic_certified:boolean?=false, fair_trade_certified:boolean?=false, rainforest_alliance:boolean?=false, utz_certified:boolean?=false, lot_number:text?, processing_date:date?, milling_date:date?, export_ready_date:date?, blockchain_hash:text?, traceability_url:text?, cupper_name:text?, cupping_date:date?, notes:text?, created_at:timestamp?=now()
- **FKs:** harvest_id→coffee_harvests.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM coffee_harvests ch WHERE ((ch.id = coffee_quality_records.harvest_id) AND can_manage_farm(ch.farm_id))))`
- **Indexes:** idx_coffee_quality_harvest_id: (harvest_id)
- **Triggers:** none

### `factory_intake_lots`
A factory's daily cherry intake lot — the entry point of the traceability chain, aggregating individual farmer deliveries.

- **Columns:** (per `processing_batches.intake_lot_id` FK target — full column list not captured in this export pass; referenced as the entry point of the traceability chain, holding one factory's daily cherry intake before it's split into `lot_farmer_deliveries`)
- **FKs:** referenced by processing_batches.intake_lot_id
- **RLS:** not captured in this pass — verify directly
- **Indexes:** not captured in this pass
- **Triggers:** none observed

### `lot_farmer_deliveries`
Individual farmer cherry-delivery line items within a factory intake lot — records who delivered what, and whether it was accepted.

- **Columns:** (key fields used by `assemblePassportPayload`: lot_id, farm_id, plot_id, farmer_cherry_kg, accepted boolean, harvest_id)
- **FKs:** lot_id→factory_intake_lots.id (inferred), farm_id→farms.id, plot_id→coffee_plots.id
- **RLS:** not captured in this pass — verify directly
- **Indexes:** not captured in this pass
- **Triggers:** none observed

### `processing_batches`
A wet mill's processing run: one day's cherry intake through fermentation, washing, and drying — the unit that aggregates many farmer deliveries.

- **Columns:** id:uuid=gen_random_uuid(), batch_number:text (unique), intake_lot_id:uuid?, factory_id:uuid?, cooperative_id:uuid?, intake_date:date, total_cherry_kg:numeric?=0, total_mbuni_kg:numeric?=0, rejected_kg:numeric?=0, total_farmers:integer?=0, season:text?, harvest_year:integer?, pulping_start_time:timestamptz?, fermentation_tank:text?, fermentation_start_time/end_time:timestamptz?, fermentation_hours:numeric?, washing_date:date?, water_source:text?, drying_method:text?='raised_beds', drying_start/end_date:date?, drying_days:integer?, parchment_kg:numeric?, outturn_ratio:numeric?, moisture_content_pct:numeric?, status:text?='intake' (CHECK: intake|pulping|fermenting|washing|drying|milled|exported|closed), clerk_name:text?, notes:text?, created_at/updated_at:timestamptz?=now()
- **FKs:** intake_lot_id→factory_intake_lots.id, factory_id→coop_factories.id, cooperative_id→cooperatives.id
- **RLS:** ALL: cooperative officers of the owning cooperative
- **Indexes:** idx_processing_batches_lot, idx_processing_batches_coop, idx_processing_batches_date
- **Triggers:** set_updated_at_processing_batches (BEFORE UPDATE)

### `mill_lots`
Dry-mill output record — parchment in, clean coffee out, grade breakdown, NCE auction linkage.

- **Columns:** id:uuid=gen_random_uuid(), mill_lot_number:text (unique), cooperative_id:uuid?, total_parchment_kg_in:numeric?, clean_coffee_kg_out:numeric?, milling_outturn_ratio:numeric?, grade_breakdown:jsonb? (e.g. {AA:kg,AB:kg,C:kg,TT:kg,E:kg}), mill_name:text?, milling_date:date?, moisture_content_pct:numeric?, nce_transaction_id:text?, nce_auction_date:date?, nce_price_usd_per_kg:numeric?, status:text?='pending' (CHECK: pending|milled|graded|auctioned|sold|exported), notes:text?, created_at/updated_at:timestamptz?=now()
- **FKs:** cooperative_id→cooperatives.id
- **RLS:** ALL: cooperative officers of the owning cooperative
- **Indexes:** (pkey only, plus join-table indexes below)
- **Triggers:** set_updated_at_mill_lots (BEFORE UPDATE)

### `mill_lot_batches`
Join table: which processing batches (and how much parchment from each) contributed to a mill lot.

- **Columns:** id:uuid=gen_random_uuid(), mill_lot_id:uuid, processing_batch_id:uuid, parchment_kg_contributed:numeric?, created_at:timestamptz?=now()
- **FKs:** mill_lot_id→mill_lots.id, processing_batch_id→processing_batches.id
- **RLS:** ALL: cooperative officers of the cooperative owning the parent mill lot
- **Indexes:** idx_mill_lot_batches_mill, idx_mill_lot_batches_batch; UNIQUE(mill_lot_id, processing_batch_id)
- **Triggers:** none

### `export_lots`
An exporter-level shipment record — buyer, port, container, EUDR DDS reference, FOB price.

- **Columns:** id:uuid=gen_random_uuid(), export_lot_number:text (unique), cooperative_id:uuid?, exporter_name:text?, buyer_name:text?, buyer_country:text?, destination_port:text?, origin_port:text?='Mombasa', container_number:text?, bill_of_lading:text?, total_bags:integer?, bag_weight_kg:numeric?=60, net_weight_kg:numeric?, grade:text?, processing_method:text?='washed', moisture_content_pct:numeric?, sca_cupping_score:numeric?, eudr_dds_reference:text?, eudr_compliant:boolean?=false, departure_date/arrival_date:date?, fob_price_usd_per_kg:numeric?, total_value_usd:numeric?, status:text?='pending' (CHECK: pending|confirmed|shipped|arrived|completed), notes:text?, created_at/updated_at:timestamptz?=now()
- **FKs:** cooperative_id→cooperatives.id
- **RLS:** ALL: cooperative officers of the owning cooperative
- **Indexes:** idx_export_lots_coop
- **Triggers:** set_updated_at_export_lots (BEFORE UPDATE)

### `export_lot_mill_lots`
Join table: which mill lots (and how much clean coffee from each) contributed to an export lot.

- **Columns:** id:uuid=gen_random_uuid(), export_lot_id:uuid, mill_lot_id:uuid, clean_kg_allocated:numeric?, created_at:timestamptz?=now()
- **FKs:** export_lot_id→export_lots.id, mill_lot_id→mill_lots.id
- **RLS:** ALL: cooperative officers of the cooperative owning the parent export lot
- **Indexes:** idx_export_lot_mill_lots; UNIQUE(export_lot_id, mill_lot_id)
- **Triggers:** none

### `coffee_passports`
The consumer-facing digital passport for a published export lot — see `docs/coffee/coffee-passports.md`.

- **Columns:** id:uuid=gen_random_uuid(), export_lot_id:uuid?, cooperative_id:uuid?, passport_code:text (unique, format FI-YYYY-NNNN), qr_url:text?, status:text?='draft' (CHECK: draft|published|archived), public_story:jsonb?={}, sustainability_metrics:jsonb?={}, quality_metrics:jsonb?={}, geo_summary:jsonb?={}, published_at:timestamptz?, view_count:integer?=0, created_at/updated_at:timestamptz?=now()
- **FKs:** export_lot_id→export_lots.id (ON DELETE SET NULL), cooperative_id→cooperatives.id
- **RLS:** ALL: cooperative officers of the owning cooperative; SELECT: anyone, WHERE status='published' (no auth required — backs the public passport API and /trace page)
- **Indexes:** idx_coffee_passports_code, idx_coffee_passports_export, idx_coffee_passports_coop, idx_coffee_passports_status
- **Triggers:** set_updated_at_coffee_passports (BEFORE UPDATE)

### `traceability_events`
Hash-chained, append-only audit ledger spanning the entire coffee supply chain — see traceability-architecture.md.

- **Columns:** id:uuid=gen_random_uuid(), entity_type:text (factory_intake_lot|processing_batch|mill_lot|export_lot|coffee_passport|delivery), entity_id:uuid, actor_user_id:uuid?, actor_name:text?, cooperative_id:uuid?, event_type:text (created|delivery_added|status_changed|parchment_recorded|nce_linked|passport_published), event_data:jsonb?={}, previous_hash:text?, current_hash:text (SHA-256), created_at:timestamptz?=now() — **no `updated_at`, by design: immutable**
- **FKs:** cooperative_id→cooperatives.id
- **RLS:** SELECT/INSERT: cooperative officers of the owning cooperative. **No UPDATE/DELETE policy needed or possible** — blocked at the rule level (see traceability-architecture.md)
- **Indexes:** idx_traceability_events_entity: (entity_type, entity_id); idx_traceability_events_coop: (cooperative_id)
- **Triggers:** none (immutability enforced by `CREATE RULE ... DO INSTEAD NOTHING` on UPDATE and DELETE, not by trigger)

### `compliance_audit_log`
Generic before/after audit log for compliance-related field changes — no RLS, minimal indexing; looks like an early/lightly-used table.

- **Columns:** id:uuid, plot_id:uuid?, action:text?, actor_id:uuid?, actor_type:text?, old_value:jsonb?, new_value:jsonb?, notes:text?, created_at:timestamp?=now()
- **FKs:** none
- **RLS:** none
- **Indexes:** none (pkey only)
- **Triggers:** none

---

## Dairy (Cattle)

### `cows`
The core dairy-cattle animal record.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, cow_tag:text, qr_code:text?, name:text?, breed:text?, birth_date:date?, sex:text?, sire_id:uuid?, dam_id:uuid?, status:text?='active'::text, purpose:text?='dairy'::text, purchase_date:date?, purchase_price:numeric?, source:text?, exit_date:date?, exit_reason:text?, exit_value:numeric?, notes:text?, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** dam_id→cows.id, sire_id→cows.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`; ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** cows_qr_code_key: (qr_code); idx_cows_farm_id: (farm_id); idx_cows_status: (status); idx_cows_farm: (farm_id); cows_cow_tag_key: (cow_tag)
- **Triggers:** trg_cow_parents_same_farm (BEFORE), update_cows_updated_at (BEFORE)

### `milk_records`
The **cattle** milk production record (morning/midday/evening yields).

- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, record_date:date, morning_milk:numeric?, evening_milk:numeric?, total_milk:numeric?, lactation_number:integer?, days_in_milk:integer?, milk_quality:text?, notes:text?, created_at:timestamp?=now(), midday_milk:numeric?=0
- **FKs:** cow_id→cows.id
- **RLS:** ALL: `(cow_id IN ( SELECT cows.id FROM cows WHERE (cows.farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_...`; DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_milk_cow_date: (cow_id, record_date); idx_milk_records_cow_id: (cow_id); idx_milk_records_record_date: (record_date); idx_milk_records_cow_record_date: (cow_id, record_date); milk_records_cow_id_record_date_key: (cow_id, record_date)
- **Triggers:** none

### `health_records`
Cattle health/treatment record (disease, drug, withdrawal period) — the cattle equivalent of `small_ruminant_health`.

- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, treatment_date:date, disease:text?, symptoms:text?, treatment:text?, drug_name:text?, dosage:text?, vet_name:text?, vet_contact:text?, withdrawal_days:integer?, safe_milk_date:date?, safe_meat_date:date?, cost:numeric?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_health_records_cow_id: (cow_id); idx_health_cow: (cow_id)
- **Triggers:** none

### `breeding_events`
Cattle breeding/service events (heat date, service date, pregnancy check) — the dairy-cattle equivalent of `small_ruminant_breeding`.

- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, heat_date:date?, service_date:date, service_type:text?, bull_code:text?, sire_breed:text?, pregnancy_check_date:date?, pregnancy_result:text?, expected_calving_date:date?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_breeding_events_cow_id: (cow_id); idx_breeding_cow: (cow_id)
- **Triggers:** none

### `calving_records`
Structured calving record linked to a `breeding_events` row, with calf vigor/delivery type — the newer, more structured sibling of `calves`.

- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, breeding_event_id:uuid?, calving_date:date, calf_id:uuid?, calf_sex:text?, calf_birth_weight:numeric?, calf_vigor:text?, delivery_type:text?, complications:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id, breeding_event_id→breeding_events.id, calf_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_calving_records_cow_id: (cow_id)
- **Triggers:** trg_calf_same_farm (BEFORE)

### `calves`
Older/parallel calf record (birth, weaning, vaccination as free text). See data-dictionary.md for how this relates to `calving_records`.

- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid?, birth_date:date, sex:text?, birth_weight:numeric?, dam_id:uuid?, sire_code:text?, weaning_date:date?, weaning_weight:numeric?, vaccination_records:text?, status:text?='alive'::text, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id, dam_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_calves_cow_id: (cow_id)
- **Triggers:** none

### `vet_visits`
Cattle veterinary visit record (diagnosis, prescription, cost, next visit).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, cow_id:uuid?, visit_date:date, vet_name:text, vet_contact:text?, visit_reason:text?, diagnosis:text?, prescription:text?, cost:numeric?, next_visit_date:date?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_vet_visits_farm_id: (farm_id)
- **Triggers:** none

---

## Poultry

### `poultry_batches`
The core poultry record — one row per batch of birds placed together (not per-bird).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_name:text, bird_type:text, breed:text?, date_of_placement:date=CURRENT_DATE, initial_count:integer, current_count:integer, source:text?, purchase_price_per_bird:numeric?, house_number:text?, housing_system:text?, expected_laying_date:date?, target_weight_kg:numeric?, status:text='active'::text, closed_date:date?, notes:text?, created_at:timestamptz=now(), updated_at:timestamptz=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_batches.farm_id) AND (fm.user_id = auth.uid()))))`
- **Indexes:** idx_poultry_batches_farm: (farm_id); idx_poultry_batches_placement: (farm_id, date_of_placement DESC); idx_poultry_batches_farm_status: (farm_id, status)
- **Triggers:** trg_poultry_batches_updated_at (BEFORE)

### `poultry_egg_records`
Daily egg collection record per batch, with grade breakdown.

- **Columns:** id:uuid=gen_random_uuid(), batch_id:uuid, record_date:date=CURRENT_DATE, total_eggs:integer, broken_eggs:integer=0, collected_eggs:integer?, grade_a:integer?=0, grade_b:integer?=0, grade_c:integer?=0, notes:text?, created_at:timestamptz=now()
- **FKs:** batch_id→poultry_batches.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(batch_id IN ( SELECT poultry_batches.id FROM poultry_batches WHERE (poultry_batches.farm_id IN ( SELECT farm_managers.farm_id FROM farm_...`; DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM (poultry_batches pb JOIN farm_managers fm ON ((fm.farm_id = pb.farm_id))) WHERE ((pb.id = poultry_egg_records.bat...`
- **Indexes:** idx_poultry_eggs_date_range: (record_date, batch_id); idx_poultry_eggs_batch_date: (batch_id, record_date DESC); idx_poultry_egg_batch_date: (batch_id, record_date DESC); poultry_egg_records_batch_date_key: (batch_id, record_date)
- **Triggers:** none

### `poultry_feed_records`
Poultry-specific feed log per batch, with days-of-feed-remaining tracking for restock alerts.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid?, record_date:date=CURRENT_DATE, feed_type:text, quantity_kg:numeric, cost_per_kg:numeric=0, total_cost:numeric=0, days_remaining:integer?, notes:text?, created_at:timestamptz=now()
- **FKs:** farm_id→farms.id, batch_id→poultry_batches.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_feed_records.farm_id) AND (fm.user_id = auth.uid()))))`; DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_poultry_feed_farm: (farm_id, record_date DESC); idx_poultry_feed_batch_date: (batch_id, record_date DESC); idx_poultry_feed_farm_date: (farm_id, record_date DESC); idx_poultry_feed_batch: (batch_id, record_date DESC)
- **Triggers:** none

### `poultry_health_records`
Poultry vaccination/treatment record per batch, with withdrawal-period tracking.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid, event_date:date=CURRENT_DATE, event_type:text, vaccine_name:text?, vaccine_batch:text?, disease:text?, symptoms:text?, drug_name:text?, dosage:text?, vet_name:text?, vet_contact:text?, withdrawal_days:integer?, safe_from_date:date?, cost:numeric?, next_due_date:date?, notes:text?, created_at:timestamptz=now()
- **FKs:** batch_id→poultry_batches.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_health_records.farm_id) AND (fm.user_id = auth.uid()))))`
- **Indexes:** idx_poultry_health_farm: (farm_id); idx_poultry_health_event: (batch_id, event_type); idx_poultry_health_next_due: (farm_id, next_due_date) WHERE (next_due_date IS NOT NULL); idx_poultry_health_due: (farm_id, next_due_date) WHERE (next_due_date IS NOT NULL); idx_poultry_health_batch: (batch_id, event_date DESC)
- **Triggers:** none

### `poultry_mortality`
Daily mortality record per batch, with cause.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid, record_date:date=CURRENT_DATE, record_type:text='mortality'::text, count_dead:integer, cause:text?, symptoms:text?, notes:text?, created_at:timestamptz=now()
- **FKs:** farm_id→farms.id, batch_id→poultry_batches.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_mortality.farm_id) AND (fm.user_id = auth.uid()))))`; DELETE/INSERT/SELECT/UPDATE: `(batch_id IN ( SELECT poultry_batches.id FROM poultry_batches WHERE (poultry_batches.farm_id IN ( SELECT farm_managers.farm_id FROM farm_...`
- **Indexes:** idx_poultry_mortality_batch_date: (batch_id, record_date DESC); idx_poultry_mortality_date: (record_date, batch_id); idx_poultry_mortality_farm: (farm_id, record_date DESC); idx_poultry_mortality_batch: (batch_id, record_date DESC)
- **Triggers:** none

### `poultry_sales`
Poultry sales record (live birds, eggs, or meat) per batch.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid?, sale_date:date=CURRENT_DATE, sale_type:text, quantity:numeric, unit:text, price_per_unit:numeric, total_price:numeric, buyer_name:text?, buyer_contact:text?, payment_method:text?='Cash'::text, payment_status:text?='paid'::text, market:text?, notes:text?, created_at:timestamptz=now()
- **FKs:** batch_id→poultry_batches.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_sales.farm_id) AND (fm.user_id = auth.uid()))))`; DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_poultry_sales_farm_date: (farm_id, sale_date DESC); idx_poultry_sales_farm: (farm_id, sale_date DESC); idx_poultry_sales_batch: (batch_id, sale_date DESC); idx_poultry_sales_type: (farm_id, sale_type)
- **Triggers:** none

---

## Small Ruminants (Goats & Sheep)

### `small_ruminants`
The core goat/sheep animal record (covers both species via the `species` column).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, animal_tag:text, qr_code:text?, ear_notch_pattern:text?, name:text?, species:text, breed:text?, upgrade_level:text?, sex:text, birth_date:date, birth_weight:numeric?, sire_id:uuid?, dam_id:uuid?, breeding_type:text?, status:text?='active'::text, purpose:text?, source:text?, purchase_price:numeric?, purchase_date:date?, exit_date:date?, exit_reason:text?, exit_value:numeric?, coat_color:text?, distinguishing_marks:text?, notes:text?, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** dam_id→small_ruminants.id, farm_id→farms.id, sire_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_small_ruminants_status: (status); small_ruminants_qr_code_key: (qr_code); idx_small_ruminants_farm: (farm_id); idx_small_ruminants_farm_id: (farm_id); small_ruminants_animal_tag_key: (animal_tag)
- **Triggers:** trg_ruminant_parents_same_farm (BEFORE), update_small_ruminants_updated_at (BEFORE)

### `milk_production`
Despite the generic name, this is the **small-ruminant** (goat/sheep) milk record — see the naming-trap note in data-dictionary.md.

- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, farm_id:uuid, record_date:date, morning_milk:numeric?, midday_milk:numeric?, evening_milk:numeric?, total_milk:numeric?, lactation_number:integer?, days_in_milk:integer?, milk_quality:text?, fat_content:numeric?, temperature:numeric?, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** farm_id→farms.id, animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** unique_animal_date: (animal_id, record_date); idx_milk_production_farm_date: (farm_id, record_date DESC); idx_milk_production_animal: (animal_id, record_date DESC); idx_milk_production_lactation: (animal_id, lactation_number, days_in_milk)
- **Triggers:** milk_production_updated_at (BEFORE)

### `goat_milk_records`
Goat/sheep milk production record — near-identical shape to `milk_production` (see data-dictionary.md for the naming trap between the two).

- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, record_date:date, morning_milk:numeric?, evening_milk:numeric?, total_milk:numeric?, lactation_number:integer?, days_in_milk:integer?, milk_quality:text?, notes:text?, created_at:timestamp?=now(), midday_milk:numeric?=0
- **FKs:** animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(animal_id)`
- **Indexes:** idx_goat_milk_records_record_date: (record_date); goat_milk_records_animal_id_record_date_key: (animal_id, record_date); idx_goat_milk_animal_date: (animal_id, record_date); idx_goat_milk_records_animal_record_date: (animal_id, record_date); idx_goat_milk_records_animal_id: (animal_id)
- **Triggers:** none

### `small_ruminant_health`
Goat/sheep health/treatment record — the small-ruminant equivalent of `health_records`.

- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, event_date:date, event_type:text, vaccine_type:text?, vaccine_name:text?, vaccine_batch_number:text?, next_vaccination_due:date?, disease:text?, symptoms:text?, treatment:text?, drug_name:text?, dosage:text?, vet_name:text?, vet_contact:text?, withdrawal_days:integer?, safe_consumption_date:date?, cost:numeric?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(animal_id)`
- **Indexes:** idx_small_ruminant_health_animal: (animal_id); idx_small_ruminant_health_animal_id: (animal_id)
- **Triggers:** none

### `small_ruminant_breeding`
Goat/sheep breeding/service events — the small-ruminant equivalent of `breeding_events`.

- **Columns:** id:uuid=gen_random_uuid(), dam_id:uuid, heat_date:date?, service_date:date, service_type:text?, sire_id:uuid?, sire_breed:text?, sire_tag:text?, pregnancy_check_date:date?, pregnancy_result:text?, expected_delivery_date:date?, actual_delivery_date:date?, number_of_offspring:integer?, offspring_ids:ARRAY?, delivery_type:text?, complications:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** dam_id→small_ruminants.id, sire_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(dam_id)`
- **Indexes:** idx_small_ruminant_breeding_dam: (dam_id); idx_small_ruminant_breeding_dam_id: (dam_id)
- **Triggers:** none

### `kidding_lambing_records`
Structured kidding/lambing delivery record linked to a breeding event — the small-ruminant equivalent of `calving_records`.

- **Columns:** id:uuid=gen_random_uuid(), dam_id:uuid, breeding_event_id:uuid?, delivery_date:date, delivery_type:text?, kid_lamb_id:uuid?, sex:text?, birth_weight:numeric?, vigor_score:text?, colostrum_given:boolean?, colostrum_time:text?, complications:text?, dam_condition_post_delivery:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** breeding_event_id→small_ruminant_breeding.id, dam_id→small_ruminants.id, kid_lamb_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(dam_id)`
- **Indexes:** idx_kidding_lambing_dam_id: (dam_id)
- **Triggers:** none

### `small_ruminant_sales`
Goat/sheep sales record (live weight, dressed weight, or milk).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, animal_id:uuid?, sale_date:date, sale_type:text, buyer_name:text?, buyer_contact:text?, live_weight_kg:numeric?, dressed_weight_kg:numeric?, price_per_kg:numeric?, total_price:numeric, milk_quantity_liters:numeric?, milk_price_per_liter:numeric?, payment_method:text?, payment_status:text?='paid'::text, market_location:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_small_ruminant_sales_farm_id: (farm_id)
- **Triggers:** none

### `weight_records`
Goat/sheep weight-tracking record with computed average daily gain and body condition score.

- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, record_date:date, weight_kg:numeric, age_days:integer?, average_daily_gain:numeric?, body_condition_score:numeric?, measurement_type:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(animal_id)`
- **Indexes:** idx_weight_records_animal_id: (animal_id)
- **Triggers:** none

---

## Cross-Enterprise

### `alerts`
Farm-level alerts (disease, health, compliance, etc.) with priority and delivery-channel tracking; feeds the EWS WhatsApp push.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, alert_type:text, alert_priority:text?='medium'::text, message:text, cow_id:uuid?, animal_id:uuid?, plot_id:text?, alert_date:date, due_date:date?, status:text?='pending'::text, delivery_channels:ARRAY?, sent_at:timestamp?, acknowledged_at:timestamp?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id, animal_id→small_ruminants.id, cow_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_alerts_date: (alert_date); idx_alerts_farm_id: (farm_id); idx_alerts_farm: (farm_id); idx_alerts_status: (status)
- **Triggers:** none

### `ai_predictions`
AI/ML model predictions per farm/animal/plot, with accuracy tracking against actual outcomes.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid?, prediction_type:text, cow_id:uuid?, animal_id:uuid?, plot_id:text?, prediction_value:numeric?, prediction_text:text?, confidence_score:numeric?, prediction_date:date, valid_until_date:date?, model_name:text?, model_version:text?, actual_value:numeric?, actual_outcome:text?, prediction_accurate:boolean?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id, farm_id→farms.id, cow_id→cows.id
- **RLS:** INSERT/SELECT: `can_manage_farm(farm_id)`
- **Indexes:** idx_ai_predictions_farm_id: (farm_id)
- **Triggers:** none

### `business_events`
Generic business event log scoped by farm and user, with severity — broader/older than the coffee-specific `traceability_events`.

- **Columns:** id:uuid=gen_random_uuid(), event_type:text, farm_id:uuid, user_id:uuid, data_json:jsonb?, severity:text?='info'::text, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(auth.uid() IN ( SELECT farm_managers.user_id FROM farm_managers WHERE (farm_managers.farm_id = business_events.farm_id)))`
- **Indexes:** idx_business_events_user_created: (user_id, created_at DESC); idx_business_events_farm_type_created: (farm_id, event_type, created_at DESC); idx_business_events_event_type: (event_type)
- **Triggers:** none

### `feed_records`
Generic livestock feed log — predates the poultry-specific `poultry_feed_records`; still used for dairy/ruminant feed entries.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, record_date:date, feed_type:text?, quantity_kg:numeric?, cost:numeric?, animal_group:text?, number_of_animals:integer?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_feed_records_farm_id: (farm_id)
- **Triggers:** none

### `financial_records`
General-purpose financial transaction log across enterprises (category/subcategory, linked optionally to a cow/animal/plot).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, transaction_date:date, enterprise_type:text?, category:text, subcategory:text?, description:text?, amount:numeric, payment_method:text?, transaction_ref:text?, cow_id:uuid?, animal_id:uuid?, plot_id:text?, receipt_url:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id, cow_id→cows.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_financial_records_farm_id: (farm_id); idx_financial_date: (transaction_date); idx_financial_farm: (farm_id)
- **Triggers:** none

---

## Geography Reference

### `counties`
Kenya administrative reference: the 47 counties.

- **Columns:** id:text, name:varchar, population_2009:integer?, created_at:timestamp?=CURRENT_TIMESTAMP
- **FKs:** none
- **RLS:** none
- **Indexes:** counties_name_key: (name)
- **Triggers:** none

### `constituencies`
Kenya administrative reference: constituencies within counties.

- **Columns:** id:text, name:varchar, county_id:text, population_2009:integer?, created_at:timestamp?=CURRENT_TIMESTAMP
- **FKs:** county_id→counties.id
- **RLS:** none
- **Indexes:** constituencies_county_id_name_key: (county_id, name); idx_constituencies_county: (county_id)
- **Triggers:** none

### `wards`
Kenya administrative reference: wards within constituencies.

- **Columns:** id:text, name:varchar, constituency_id:text, ward_uid:varchar?, population_2009:integer?, created_at:timestamp?=CURRENT_TIMESTAMP
- **FKs:** constituency_id→constituencies.id
- **RLS:** none
- **Indexes:** idx_wards_constituency: (constituency_id); wards_constituency_id_name_key: (constituency_id, name)
- **Triggers:** none

---

## Operations / Infrastructure

### `message_queue`
Inbound WhatsApp message buffer, drained every minute by pg_cron → the AI intent-processing pipeline.

- **Columns:** id:uuid=gen_random_uuid(), source:text, phone_number:text, message_content:text, status:text='pending'::text, attempts:integer?=0, last_error:text?, payload:jsonb?, created_at:timestamptz?=now(), processed_at:timestamptz?, retry_at:timestamptz?
- **FKs:** none
- **RLS:** SELECT/UPDATE: `true`
- **Indexes:** idx_message_queue_phone: (phone_number); idx_message_queue_status: (status); idx_message_queue_created_at: (created_at DESC); idx_message_queue_retry_at: (retry_at) WHERE (status = 'pending'::text)
- **Triggers:** none

### `message_results`
Output of intent-processing for a queued message (intent type, payload, execution result).

- **Columns:** id:uuid=gen_random_uuid(), message_id:uuid, farm_id:uuid, source:text, intent_type:text, intent_payload:jsonb?, execution_result:jsonb?, created_at:timestamptz?=now()
- **FKs:** message_id→message_queue.id, farm_id→farms.id
- **RLS:** INSERT: `true`
- **Indexes:** idx_message_results_farm_id: (farm_id); idx_message_results_intent_type: (intent_type); idx_message_results_created_at: (created_at DESC)
- **Triggers:** none

### `whatsapp_messages`
The conversational WhatsApp message log (separate from the `message_queue` processing buffer).

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid?, sender_phone:text, message_text:text?, message_type:text?, media_url:text?, media_type:text?, intent:text?, intent_confidence:numeric?, entities_extracted:jsonb?, response_text:text?, response_sent_at:timestamp?, session_id:text?, conversation_context:jsonb?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** ALL: `(auth.role() = 'service_role'::text)`; INSERT/SELECT: `can_manage_farm(farm_id)`; SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_whatsapp_messages_farm: (farm_id, created_at DESC) WHERE (farm_id IS NOT NULL); idx_whatsapp_messages_phone: (sender_phone, created_at DESC); idx_whatsapp_messages_farm_id: (farm_id); idx_whatsapp_created: (created_at); idx_whatsapp_phone: (sender_phone); idx_whatsapp_farm: (farm_id)
- **Triggers:** none.

### `transactions`
M-Pesa Daraja STK Push payment transaction record.

- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid?, user_id:uuid?, amount:numeric, phone_number:text, merchant_request_id:text, checkout_request_id:text, status:text='pending'::text, mpesa_receipt_number:text?, result_desc:text?, months_added:integer=1, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(user_id = auth.uid())`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_transactions_farm_id_created: (farm_id, created_at DESC); idx_transactions_checkout_request_id: (checkout_request_id)
- **Triggers:** trg_transactions_updated_at (BEFORE)

### `api_request_logs`
Observability: logs every API request for latency/error monitoring. Auto-pruned after 7 days via `v_api_logs_to_delete`.

- **Columns:** id:uuid=gen_random_uuid(), endpoint:text, method:text, status_code:integer?, response_time_ms:integer?, user_id:uuid?, farm_id:uuid?, error_message:text?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `((farm_id IS NULL) OR (auth.uid() IN ( SELECT farm_managers.user_id FROM farm_managers WHERE (farm_managers.farm_id = api_request_logs.fa...`
- **Indexes:** idx_api_logs_farm_created: (farm_id, created_at DESC); idx_api_logs_user_created: (user_id, created_at DESC); idx_api_logs_endpoint_created: (endpoint, created_at DESC); idx_api_logs_status_code: (status_code)
- **Triggers:** none

### `error_events`
Application error log with request/response context — observability table, auto-pruned after 30 days.

- **Columns:** id:uuid=gen_random_uuid(), message:text, stack_trace:text?, severity:text?, farm_id:uuid?, user_id:uuid?, endpoint:text?, request_id:uuid?, method:text?, status_code:integer?, response_time_ms:integer?, user_agent:text?, ip_address:text?, context_json:jsonb?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `((farm_id IS NULL) OR (auth.uid() IN ( SELECT farm_managers.user_id FROM farm_managers WHERE (farm_managers.farm_id = error_events.farm_i...`
- **Indexes:** idx_error_events_request_id: (request_id); idx_error_events_severity_created: (severity, created_at DESC); idx_error_events_user_created: (user_id, created_at DESC); idx_error_events_endpoint_created: (endpoint, created_at DESC); idx_error_events_farm_created: (farm_id, created_at DESC)
- **Triggers:** none

### `newsletter_subscribers`
Marketing-site email signups — unrelated to the farm-management core schema.

- **Columns:** id:uuid=gen_random_uuid(), email:text, subscribed_at:timestamptz?=now(), status:text?='active'::text, created_at:timestamptz?=now()
- **FKs:** none
- **RLS:** INSERT: `true`; SELECT: `(auth.uid() = id)`
- **Indexes:** newsletter_subscribers_email_key: (email)
- **Triggers:** none

---
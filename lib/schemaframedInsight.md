# Framed Insight Web — Database Tables Reference

Format: `column:type` (nullable columns marked `?`, defaults in parens). Index entries omit primary keys; column lists show the indexed expression.

### `ai_predictions`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid?, prediction_type:text, cow_id:uuid?, animal_id:uuid?, plot_id:text?, prediction_value:numeric?, prediction_text:text?, confidence_score:numeric?, prediction_date:date, valid_until_date:date?, model_name:text?, model_version:text?, actual_value:numeric?, actual_outcome:text?, prediction_accurate:boolean?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id, farm_id→farms.id, cow_id→cows.id
- **RLS:** INSERT/SELECT: `can_manage_farm(farm_id)`
- **Indexes:** idx_ai_predictions_farm_id: (farm_id)
- **Triggers:** none

### `alerts`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, alert_type:text, alert_priority:text?='medium'::text, message:text, cow_id:uuid?, animal_id:uuid?, plot_id:text?, alert_date:date, due_date:date?, status:text?='pending'::text, delivery_channels:ARRAY?, sent_at:timestamp?, acknowledged_at:timestamp?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id, animal_id→small_ruminants.id, cow_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_alerts_date: (alert_date); idx_alerts_farm_id: (farm_id); idx_alerts_farm: (farm_id); idx_alerts_status: (status)
- **Triggers:** none

### `api_request_logs`
- **Columns:** id:uuid=gen_random_uuid(), endpoint:text, method:text, status_code:integer?, response_time_ms:integer?, user_id:uuid?, farm_id:uuid?, error_message:text?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `((farm_id IS NULL) OR (auth.uid() IN ( SELECT farm_managers.user_id FROM farm_managers WHERE (farm_managers.farm_id = api_request_logs.fa...`
- **Indexes:** idx_api_logs_farm_created: (farm_id, created_at DESC); idx_api_logs_user_created: (user_id, created_at DESC); idx_api_logs_endpoint_created: (endpoint, created_at DESC); idx_api_logs_status_code: (status_code)
- **Triggers:** none

### `audit_logs`
- **Columns:** id:uuid=gen_random_uuid(), action:text, actor_id:uuid?, farm_id:uuid?, resource:text, resource_id:text?, details:jsonb?='{}'::jsonb, ip_address:text?, user_agent:text?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_audit_logs_actor: (actor_id, created_at DESC); idx_audit_logs_action: (action, created_at DESC); idx_audit_logs_created: (created_at DESC); idx_audit_logs_farm: (farm_id, created_at DESC)
- **Triggers:** none

### `breeding_events`
- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, heat_date:date?, service_date:date, service_type:text?, bull_code:text?, sire_breed:text?, pregnancy_check_date:date?, pregnancy_result:text?, expected_calving_date:date?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_breeding_events_cow_id: (cow_id); idx_breeding_cow: (cow_id)
- **Triggers:** none

### `business_events`
- **Columns:** id:uuid=gen_random_uuid(), event_type:text, farm_id:uuid, user_id:uuid, data_json:jsonb?, severity:text?='info'::text, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(auth.uid() IN ( SELECT farm_managers.user_id FROM farm_managers WHERE (farm_managers.farm_id = business_events.farm_id)))`
- **Indexes:** idx_business_events_user_created: (user_id, created_at DESC); idx_business_events_farm_type_created: (farm_id, event_type, created_at DESC); idx_business_events_event_type: (event_type)
- **Triggers:** none

### `calves`
- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid?, birth_date:date, sex:text?, birth_weight:numeric?, dam_id:uuid?, sire_code:text?, weaning_date:date?, weaning_weight:numeric?, vaccination_records:text?, status:text?='alive'::text, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id, dam_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_calves_cow_id: (cow_id)
- **Triggers:** none

### `calving_records`
- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, breeding_event_id:uuid?, calving_date:date, calf_id:uuid?, calf_sex:text?, calf_birth_weight:numeric?, calf_vigor:text?, delivery_type:text?, complications:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id, breeding_event_id→breeding_events.id, calf_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_calving_records_cow_id: (cow_id)
- **Triggers:** trg_calf_same_farm (BEFORE)

### `coffee_activities`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:uuid?, activity_type:text, activity_date:date=CURRENT_DATE, weeding_method:text?, product_name:text?, quantity:numeric?, quantity_unit:text?, cost_inputs:numeric?=0, fertilizer_type:text?, application_method:text?, spray_type:text?, spray_reason:text?, dilution_rate:text?, litres_water:numeric?, weather_conditions:text?, pruning_type:text?, area_covered_ha:numeric?, labour_mode:text?, num_workers:integer?, days_worked:numeric?, rate_per_day:numeric?, cost_labour:numeric?=0, total_cost:numeric?, calendar_triggered:boolean?=false, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** plot_id→coffee_plots.id, farm_id→farms.id
- **RLS:** ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_coffee_activities_date: (activity_date DESC); idx_coffee_activities_plot_id: (plot_id); idx_coffee_activities_farm_year: (farm_id, EXTRACT(year FROM activity_date)); idx_coffee_activities_farm_id: (farm_id); idx_coffee_activities_type: (activity_type)
- **Triggers:** update_coffee_activities_updated_at (BEFORE)

### `coffee_calendar_regions`
- **Columns:** id:uuid=gen_random_uuid(), region_name:text, counties:ARRAY, month:integer, recommended_activities:jsonb, season_context:text?
- **FKs:** none
- **RLS:** none
- **Indexes:** idx_calendar_month: (month); idx_calendar_region: (region_name)
- **Triggers:** none

### `coffee_disease_thresholds`
- **Columns:** id:uuid=gen_random_uuid(), region_name:text, disease_pest_type:text, watch_threshold:text?, action_threshold:text?, emergency_threshold:text?, watch_count:numeric?, action_count:numeric?, emergency_count:numeric?, recommended_product:text?, alternative_products:ARRAY?, application_notes:text?, why_different:text?, high_risk_months:ARRAY?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** none
- **RLS:** SELECT: `true`
- **Indexes:** idx_thresholds_pest: (disease_pest_type); idx_thresholds_region: (region_name); coffee_disease_thresholds_region_name_disease_pest_type_key: (region_name, disease_pest_type)
- **Triggers:** update_coffee_disease_thresholds_updated_at (BEFORE)

### `coffee_eudr_compliance`
- **Columns:** id:uuid=gen_random_uuid(), plot_id:uuid, farm_id:uuid, assessment_date:date=CURRENT_DATE, risk_level:text?='unknown'::text, deforestation_risk:boolean?=false, forest_cover_pct:numeric?, last_forest_change_year:integer?, afa_verified:boolean?=false, afa_verification_date:date?, land_use_before_2020:text?, compliance_status:text?='pending'::text, notes:text?, raw_api_response:jsonb?, created_at:timestamptz?=now(), updated_at:timestamptz?=now(), evidence_photos:ARRAY?=ARRAY[]::text[]
- **FKs:** farm_id→farms.id, plot_id→coffee_plots.id
- **RLS:** SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; ALL: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_eudr_plot_id: (plot_id, compliance_status)
- **Triggers:** none

### `coffee_financials`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, transaction_date:date, category:text, description:text?, amount:numeric, payment_method:text?, transaction_ref:text?, cooperative_name:text?, buyer_name:text?, plot_id:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_financials_farm_id: (farm_id)
- **Triggers:** none

### `coffee_harvests`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_name:text, harvest_date:date, harvest_season:text?, harvest_year:integer?, cherry_kg:numeric, quality_grade:text?, cherry_condition:text?, processing_method:text?='Wet/Washed'::text, parchment_kg:numeric?, clean_coffee_kg:numeric?, price_per_kg:numeric?, total_value:numeric?, buyer_name:text?, cooperative_name:text?, payment_status:text?='pending'::text, payment_date:date?, amount_paid:numeric?, lot_number:text?, notes:text?, created_at:timestamp?=now(), nce_transaction_id:text?, produce_type:text?='cherry'::text, produce_kg:numeric, mbuni_accepted:boolean?=true, mbuni_rejection_reason:text?, receipt_number:text?, factory_code:text?
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`; ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_coffee_harvests_farm_year_season: (farm_id, harvest_year, harvest_season); idx_coffee_harvests_farm_harvest_date: (farm_id, harvest_date DESC); idx_harvests_produce_type: (produce_type); idx_harvests_payment_status: (payment_status); idx_coffee_harvests_pending_payments: (farm_id, harvest_date) WHERE (payment_status = 'pending'::text); idx_coffee_harvests_plot: (plot_name); idx_coffee_harvests_farm_id: (farm_id)
- **Triggers:** none

### `coffee_health_records`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:text, inspection_date:date, coffee_berry_disease_severity:text?, coffee_leaf_rust_severity:text?, bacterial_blight_present:boolean?=false, antestia_bugs_severity:text?, stem_borers_present:boolean?=false, berry_borers_present:boolean?=false, treatment_applied:text?, chemical_name:text?, chemical_quantity:text?, application_method:text?, leaf_photo_url:text?, berry_photo_url:text?, ai_diagnosis:text?, ai_confidence_score:numeric?, cost:numeric?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_health_plot: (plot_id); idx_coffee_health_farm_id: (farm_id)
- **Triggers:** none

### `coffee_inputs`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, input_date:date, input_type:text, fertilizer_type:text?, quantity_kg:numeric?, labor_type:text?, labor_hours:numeric?, labor_cost:numeric?, number_of_workers:integer?, plot_applied:text?, trees_treated:integer?, unit_cost:numeric?, total_cost:numeric?, supplier_name:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_coffee_inputs_farm_id: (farm_id)
- **Triggers:** none

### `coffee_pest_library`
- **Columns:** id:uuid=gen_random_uuid(), pest_disease_code:text, common_name_english:text, common_name_swahili:text?, scientific_name:text?, category:text, symptoms_description:text?, early_stage_symptoms:text?, late_stage_symptoms:text?, affected_plant_parts:ARRAY?, photo_urls:ARRAY?, video_url:text?, cultural_control:text?, chemical_control:text?, registered_products:ARRAY?, organic_control:text?, yield_loss_potential:text?, quality_impact:text?, prevention_tips:text?, high_risk_conditions:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** none
- **RLS:** none
- **Indexes:** idx_pest_library_code: (pest_disease_code); coffee_pest_library_pest_disease_code_key: (pest_disease_code); idx_pest_library_category: (category)
- **Triggers:** update_coffee_pest_library_updated_at (BEFORE)

### `coffee_plants`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plant_tag:text?, qr_code:text?, plot_id:text, gps_latitude:numeric?, gps_longitude:numeric?, variety:text?, planting_date:date?, age_years:numeric?, plant_spacing_meters:numeric?, plant_status:text?='productive'::text, deforestation_risk_status:text?, forest_cover_certification:text?, land_ownership_doc_url:text?, eudr_compliant:boolean?=false, notes:text?, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** coffee_plants_qr_code_key: (qr_code); idx_coffee_plants_farm_id: (farm_id); idx_coffee_plants_farm: (farm_id); idx_coffee_plants_plot: (plot_id)
- **Triggers:** update_coffee_plants_updated_at (BEFORE)

### `coffee_plot_weather`
- **Columns:** id:uuid=gen_random_uuid(), plot_id:uuid, date:date, temperature_2m_mean:numeric?, temperature_2m_max:numeric?, temperature_2m_min:numeric?, precipitation_sum:numeric?, relative_humidity_2m_mean:numeric?, soil_moisture_0_to_10cm:numeric?, evapotranspiration:numeric?, weather_code:integer?, cbd_risk_score:integer?, clr_risk_score:integer?, drought_stress_score:integer?, created_at:timestamptz?=now()
- **FKs:** plot_id→coffee_plots.id
- **RLS:** ALL: `((auth.jwt() ->> 'role'::text) = 'service_role'::text)`; SELECT: `(EXISTS ( SELECT 1 FROM (farm_managers fm JOIN coffee_plots cp ON ((cp.farm_id = fm.farm_id))) WHERE ((fm.user_id = auth.uid()) AND (cp.i...`
- **Indexes:** coffee_plot_weather_plot_id_date_key: (plot_id, date); idx_weather_plot_date: (plot_id, date DESC); idx_weather_cbd_risk: (cbd_risk_score DESC) WHERE (cbd_risk_score > 60); idx_weather_clr_risk: (clr_risk_score DESC) WHERE (clr_risk_score > 60); idx_weather_drought: (drought_stress_score DESC) WHERE (drought_stress_score > 60)
- **Triggers:** none

### `coffee_plots`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_name:text, plot_code:text?, variety:text?, planting_date:date?, age_years:integer?=0, total_trees:integer=0, plant_spacing_meters:numeric?, plant_status:text?='productive'::text, gps_latitude:numeric?, gps_longitude:numeric?, gps_polygon:jsonb?, area_hectares:numeric?, eudr_risk_level:text?, eudr_risk_assessed_at:timestamptz?, eudr_risk_details:text?, afa_geo_mapping_id:text?, land_ownership_type:text?, land_ownership_doc_url:text?, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now(), region_name:text?, productive_trees:integer?=0, land_size_acres:numeric?, establishment_year:integer?
- **FKs:** farm_id→farms.id
- **RLS:** ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_coffee_plots_farm: (farm_id); idx_coffee_plots_farm_id: (farm_id); idx_coffee_plots_eudr_risk: (eudr_risk_level); idx_coffee_plots_afa_id: (afa_geo_mapping_id) WHERE (afa_geo_mapping_id IS NOT NULL); idx_coffee_plots_polygon: (gps_polygon); idx_coffee_plots_region: (region_name); idx_plots_region: (region_name)
- **Triggers:** update_coffee_plots_updated_at (BEFORE)

### `coffee_quality_records`
- **Columns:** id:uuid=gen_random_uuid(), harvest_id:uuid?, cupping_score:numeric?, acidity_score:numeric?, body_score:numeric?, flavor_notes:text?, aroma_score:numeric?, organic_certified:boolean?=false, fair_trade_certified:boolean?=false, rainforest_alliance:boolean?=false, utz_certified:boolean?=false, lot_number:text?, processing_date:date?, milling_date:date?, export_ready_date:date?, blockchain_hash:text?, traceability_url:text?, cupper_name:text?, cupping_date:date?, notes:text?, created_at:timestamp?=now()
- **FKs:** harvest_id→coffee_harvests.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM coffee_harvests ch WHERE ((ch.id = coffee_quality_records.harvest_id) AND can_manage_farm(ch.farm_id))))`
- **Indexes:** idx_coffee_quality_harvest_id: (harvest_id)
- **Triggers:** none

### `coffee_satellite_fetch_log`
- **Columns:** id:uuid=gen_random_uuid(), plot_id:uuid, fetch_attempted_at:timestamptz?=now(), status:text, cloud_cover_pct:numeric?, date_range_from:date?, date_range_to:date?, error_message:text?, processing_units_used:numeric?
- **FKs:** plot_id→coffee_plots.id
- **RLS:** none
- **Indexes:** idx_fetch_log_plot: (plot_id); idx_fetch_log_time: (fetch_attempted_at DESC)
- **Triggers:** none

### `coffee_satellite_indices`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:uuid, image_date:date, acquired_at:timestamptz?=now(), cloud_cover_pct:numeric?, sentinel_tile:text?, ndvi_mean:numeric?, ndvi_min:numeric?, ndvi_max:numeric?, ndvi_std:numeric?, ndre_mean:numeric?, ndre_min:numeric?, ndre_max:numeric?, ndwi_mean:numeric?, ndwi_min:numeric?, ndwi_max:numeric?, health_score:integer?, health_label:text?, ndvi_change:numeric?, health_score_change:integer?, weeks_of_decline:integer?=0, alert_triggered:boolean?=false, alert_reason:text?, raw_cdse_response:jsonb?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id, plot_id→coffee_plots.id
- **RLS:** SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; ALL: `(auth.role() = 'service_role'::text)`; ALL: `true`
- **Indexes:** idx_sat_health: (health_label); idx_satellite_alerts: (alert_triggered) WHERE (alert_triggered = true); idx_satellite_health_label: (health_label); coffee_satellite_indices_plot_id_image_date_key: (plot_id, image_date); idx_sat_plot_id: (plot_id); idx_sat_farm_id: (farm_id); idx_sat_date: (image_date DESC); idx_sat_alert: (alert_triggered) WHERE (alert_triggered = true); idx_satellite_plot_date: (plot_id, image_date DESC)
- **Triggers:** none

### `coffee_scouting_records`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, plot_id:uuid, scouting_date:date=CURRENT_DATE, scouted_by:text?, observation_type:text, severity_level:text?, trees_sampled:integer?, pest_count_total:integer?, pest_count_per_tree:numeric?, cbd_green_berries_affected:integer?, cbd_yellow_berries_affected:integer?, cbd_red_berries_affected:integer?, clr_leaves_affected:integer?, clr_defoliation_observed:boolean?, area_affected_ha:numeric?, percentage_plot_affected:numeric?, weather_past_week:text?, action_taken:text?, spray_activity_id:uuid?, threshold_breached:boolean?=false, alert_level:text?, symptoms_description:text?, photo_urls:ARRAY?, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** plot_id→coffee_plots.id, farm_id→farms.id, spray_activity_id→coffee_activities.id
- **RLS:** ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_scouting_threshold: (threshold_breached); idx_scouting_farm_id: (farm_id); idx_scouting_plot_id: (plot_id); idx_scouting_date: (scouting_date DESC); idx_scouting_type: (observation_type)
- **Triggers:** update_coffee_scouting_records_updated_at (BEFORE)

### `compliance_audit_log`
- **Columns:** id:uuid, plot_id:uuid?, action:text?, actor_id:uuid?, actor_type:text?, old_value:jsonb?, new_value:jsonb?, notes:text?, created_at:timestamp?=now()
- **FKs:** none
- **RLS:** none
- **Indexes:** none (pkey only)
- **Triggers:** none

### `constituencies`
- **Columns:** id:text, name:varchar, county_id:text, population_2009:integer?, created_at:timestamp?=CURRENT_TIMESTAMP
- **FKs:** county_id→counties.id
- **RLS:** none
- **Indexes:** constituencies_county_id_name_key: (county_id, name); idx_constituencies_county: (county_id)
- **Triggers:** none

### `counties`
- **Columns:** id:text, name:varchar, population_2009:integer?, created_at:timestamp?=CURRENT_TIMESTAMP
- **FKs:** none
- **RLS:** none
- **Indexes:** counties_name_key: (name)
- **Triggers:** none

### `cows`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, cow_tag:text, qr_code:text?, name:text?, breed:text?, birth_date:date?, sex:text?, sire_id:uuid?, dam_id:uuid?, status:text?='active'::text, purpose:text?='dairy'::text, purchase_date:date?, purchase_price:numeric?, source:text?, exit_date:date?, exit_reason:text?, exit_value:numeric?, notes:text?, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** dam_id→cows.id, sire_id→cows.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`; ALL: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** cows_qr_code_key: (qr_code); idx_cows_farm_id: (farm_id); idx_cows_status: (status); idx_cows_farm: (farm_id); cows_cow_tag_key: (cow_tag)
- **Triggers:** trg_cow_parents_same_farm (BEFORE), update_cows_updated_at (BEFORE)

### `error_events`
- **Columns:** id:uuid=gen_random_uuid(), message:text, stack_trace:text?, severity:text?, farm_id:uuid?, user_id:uuid?, endpoint:text?, request_id:uuid?, method:text?, status_code:integer?, response_time_ms:integer?, user_agent:text?, ip_address:text?, context_json:jsonb?, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `((farm_id IS NULL) OR (auth.uid() IN ( SELECT farm_managers.user_id FROM farm_managers WHERE (farm_managers.farm_id = error_events.farm_i...`
- **Indexes:** idx_error_events_request_id: (request_id); idx_error_events_severity_created: (severity, created_at DESC); idx_error_events_user_created: (user_id, created_at DESC); idx_error_events_endpoint_created: (endpoint, created_at DESC); idx_error_events_farm_created: (farm_id, created_at DESC)
- **Triggers:** none

### `farm_events`
- **Columns:** id:uuid, farm_id:uuid?, event_type:text?, event_data:jsonb?, created_at:timestamp?, processed_at:timestamp?
- **FKs:** none
- **RLS:** none
- **Indexes:** none (pkey only)
- **Triggers:** none

### `farm_managers`
- **Columns:** user_id:uuid, farm_id:uuid, role:text?, created_at:timestamptz?=now()
- **FKs:** none
- **RLS:** ALL/INSERT: `(auth.uid() = user_id)`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_farm_managers_farm_id: (farm_id); idx_farm_managers_farm: (farm_id); idx_farm_managers_user: (user_id); idx_farm_managers_user_farm: (user_id, farm_id); idx_farm_managers_user_id: (user_id)
- **Triggers:** none

### `farm_type_configs`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, farm_type:text, active_modules:ARRAY?='{}'::text[], measurement_units:text?='metric'::text, language:text?='english'::text, alerts_enabled:boolean?=true, alert_channels:ARRAY?='{whatsapp}'::text[], ai_diagnostics_enabled:boolean?=true, voice_notes_enabled:boolean?=false, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** farm_type_configs_farm_id_farm_type_key: (farm_id, farm_type); idx_farm_type_configs_farm_id: (farm_id)
- **Triggers:** none

### `farms`
- **Columns:** id:uuid=gen_random_uuid(), farm_name:text, owner_name:text, phone:text, email:text?, location:text?, county:text?, sub_county:text?, ward:text?, gps_latitude:numeric?, gps_longitude:numeric?, farm_types:ARRAY?='{}'::text[], primary_enterprise:text?, land_size_acres:numeric?, is_active:boolean?=true, subscription_tier:text?='free'::text, subscription_start_date:date?, subscription_end_date:date?, created_at:timestamp?=now(), updated_at:timestamp?=now(), whatsapp_language:text?='en'::text
- **FKs:** none
- **RLS:** SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers WHERE ((farm_managers.farm_id = farms.id) AND (farm_managers.user_id = auth.uid()))))`; ALL: `(auth.role() = 'service_role'::text)`; INSERT: `true`
- **Indexes:** farms_phone_key: (phone); idx_farms_subscription: (subscription_tier, subscription_end_date) WHERE (subscription_end_date IS NOT NULL); idx_farms_subscription_tier: (subscription_tier); idx_farms_phone: (phone)
- **Triggers:** trg_farms_updated_at (BEFORE), update_farms_updated_at (BEFORE)

### `feed_records`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, record_date:date, feed_type:text?, quantity_kg:numeric?, cost:numeric?, animal_group:text?, number_of_animals:integer?, notes:text?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_feed_records_farm_id: (farm_id)
- **Triggers:** none

### `financial_records`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, transaction_date:date, enterprise_type:text?, category:text, subcategory:text?, description:text?, amount:numeric, payment_method:text?, transaction_ref:text?, cow_id:uuid?, animal_id:uuid?, plot_id:text?, receipt_url:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id, cow_id→cows.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_financial_records_farm_id: (farm_id); idx_financial_date: (transaction_date); idx_financial_farm: (farm_id)
- **Triggers:** none

### `goat_milk_records`
- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, record_date:date, morning_milk:numeric?, evening_milk:numeric?, total_milk:numeric?, lactation_number:integer?, days_in_milk:integer?, milk_quality:text?, notes:text?, created_at:timestamp?=now(), midday_milk:numeric?=0
- **FKs:** animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(animal_id)`
- **Indexes:** idx_goat_milk_records_record_date: (record_date); goat_milk_records_animal_id_record_date_key: (animal_id, record_date); idx_goat_milk_animal_date: (animal_id, record_date); idx_goat_milk_records_animal_record_date: (animal_id, record_date); idx_goat_milk_records_animal_id: (animal_id)
- **Triggers:** none

### `health_records`
- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, treatment_date:date, disease:text?, symptoms:text?, treatment:text?, drug_name:text?, dosage:text?, vet_name:text?, vet_contact:text?, withdrawal_days:integer?, safe_milk_date:date?, safe_meat_date:date?, cost:numeric?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_health_records_cow_id: (cow_id); idx_health_cow: (cow_id)
- **Triggers:** none

### `kidding_lambing_records`
- **Columns:** id:uuid=gen_random_uuid(), dam_id:uuid, breeding_event_id:uuid?, delivery_date:date, delivery_type:text?, kid_lamb_id:uuid?, sex:text?, birth_weight:numeric?, vigor_score:text?, colostrum_given:boolean?, colostrum_time:text?, complications:text?, dam_condition_post_delivery:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** breeding_event_id→small_ruminant_breeding.id, dam_id→small_ruminants.id, kid_lamb_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(dam_id)`
- **Indexes:** idx_kidding_lambing_dam_id: (dam_id)
- **Triggers:** none

### `message_queue`
- **Columns:** id:uuid=gen_random_uuid(), source:text, phone_number:text, message_content:text, status:text='pending'::text, attempts:integer?=0, last_error:text?, payload:jsonb?, created_at:timestamptz?=now(), processed_at:timestamptz?, retry_at:timestamptz?
- **FKs:** none
- **RLS:** SELECT/UPDATE: `true`
- **Indexes:** idx_message_queue_phone: (phone_number); idx_message_queue_status: (status); idx_message_queue_created_at: (created_at DESC); idx_message_queue_retry_at: (retry_at) WHERE (status = 'pending'::text)
- **Triggers:** none

### `message_results`
- **Columns:** id:uuid=gen_random_uuid(), message_id:uuid, farm_id:uuid, source:text, intent_type:text, intent_payload:jsonb?, execution_result:jsonb?, created_at:timestamptz?=now()
- **FKs:** message_id→message_queue.id, farm_id→farms.id
- **RLS:** INSERT: `true`
- **Indexes:** idx_message_results_farm_id: (farm_id); idx_message_results_intent_type: (intent_type); idx_message_results_created_at: (created_at DESC)
- **Triggers:** none

### `milk_production`
- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, farm_id:uuid, record_date:date, morning_milk:numeric?, midday_milk:numeric?, evening_milk:numeric?, total_milk:numeric?, lactation_number:integer?, days_in_milk:integer?, milk_quality:text?, fat_content:numeric?, temperature:numeric?, notes:text?, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** farm_id→farms.id, animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** unique_animal_date: (animal_id, record_date); idx_milk_production_farm_date: (farm_id, record_date DESC); idx_milk_production_animal: (animal_id, record_date DESC); idx_milk_production_lactation: (animal_id, lactation_number, days_in_milk)
- **Triggers:** milk_production_updated_at (BEFORE)

### `milk_records`
- **Columns:** id:uuid=gen_random_uuid(), cow_id:uuid, record_date:date, morning_milk:numeric?, evening_milk:numeric?, total_milk:numeric?, lactation_number:integer?, days_in_milk:integer?, milk_quality:text?, notes:text?, created_at:timestamp?=now(), midday_milk:numeric?=0
- **FKs:** cow_id→cows.id
- **RLS:** ALL: `(cow_id IN ( SELECT cows.id FROM cows WHERE (cows.farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_...`; DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_cow_id(cow_id)`
- **Indexes:** idx_milk_cow_date: (cow_id, record_date); idx_milk_records_cow_id: (cow_id); idx_milk_records_record_date: (record_date); idx_milk_records_cow_record_date: (cow_id, record_date); milk_records_cow_id_record_date_key: (cow_id, record_date)
- **Triggers:** none

### `newsletter_subscribers`
- **Columns:** id:uuid=gen_random_uuid(), email:text, subscribed_at:timestamptz?=now(), status:text?='active'::text, created_at:timestamptz?=now()
- **FKs:** none
- **RLS:** INSERT: `true`; SELECT: `(auth.uid() = id)`
- **Indexes:** newsletter_subscribers_email_key: (email)
- **Triggers:** none

### `phone_otp_codes`
- **Columns:** id:uuid=gen_random_uuid(), phone_number:text, otp_code:text, expires_at:timestamptz, metadata:jsonb?, created_at:timestamptz?=now()
- **FKs:** none
- **RLS:** ALL/DELETE/INSERT/SELECT/UPDATE: `true`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_phone_otp_phone: (phone_number); phone_otp_codes_phone_number_key: (phone_number); idx_phone_otp_expires: (expires_at)
- **Triggers:** none

### `poultry_batches`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_name:text, bird_type:text, breed:text?, date_of_placement:date=CURRENT_DATE, initial_count:integer, current_count:integer, source:text?, purchase_price_per_bird:numeric?, house_number:text?, housing_system:text?, expected_laying_date:date?, target_weight_kg:numeric?, status:text='active'::text, closed_date:date?, notes:text?, created_at:timestamptz=now(), updated_at:timestamptz=now()
- **FKs:** farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_batches.farm_id) AND (fm.user_id = auth.uid()))))`
- **Indexes:** idx_poultry_batches_farm: (farm_id); idx_poultry_batches_placement: (farm_id, date_of_placement DESC); idx_poultry_batches_farm_status: (farm_id, status)
- **Triggers:** trg_poultry_batches_updated_at (BEFORE)

### `poultry_egg_records`
- **Columns:** id:uuid=gen_random_uuid(), batch_id:uuid, record_date:date=CURRENT_DATE, total_eggs:integer, broken_eggs:integer=0, collected_eggs:integer?, grade_a:integer?=0, grade_b:integer?=0, grade_c:integer?=0, notes:text?, created_at:timestamptz=now()
- **FKs:** batch_id→poultry_batches.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(batch_id IN ( SELECT poultry_batches.id FROM poultry_batches WHERE (poultry_batches.farm_id IN ( SELECT farm_managers.farm_id FROM farm_...`; DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM (poultry_batches pb JOIN farm_managers fm ON ((fm.farm_id = pb.farm_id))) WHERE ((pb.id = poultry_egg_records.bat...`
- **Indexes:** idx_poultry_eggs_date_range: (record_date, batch_id); idx_poultry_eggs_batch_date: (batch_id, record_date DESC); idx_poultry_egg_batch_date: (batch_id, record_date DESC); poultry_egg_records_batch_date_key: (batch_id, record_date)
- **Triggers:** none

### `poultry_feed_records`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid?, record_date:date=CURRENT_DATE, feed_type:text, quantity_kg:numeric, cost_per_kg:numeric=0, total_cost:numeric=0, days_remaining:integer?, notes:text?, created_at:timestamptz=now()
- **FKs:** farm_id→farms.id, batch_id→poultry_batches.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_feed_records.farm_id) AND (fm.user_id = auth.uid()))))`; DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_poultry_feed_farm: (farm_id, record_date DESC); idx_poultry_feed_batch_date: (batch_id, record_date DESC); idx_poultry_feed_farm_date: (farm_id, record_date DESC); idx_poultry_feed_batch: (batch_id, record_date DESC)
- **Triggers:** none

### `poultry_health_records`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid, event_date:date=CURRENT_DATE, event_type:text, vaccine_name:text?, vaccine_batch:text?, disease:text?, symptoms:text?, drug_name:text?, dosage:text?, vet_name:text?, vet_contact:text?, withdrawal_days:integer?, safe_from_date:date?, cost:numeric?, next_due_date:date?, notes:text?, created_at:timestamptz=now()
- **FKs:** batch_id→poultry_batches.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`; DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_health_records.farm_id) AND (fm.user_id = auth.uid()))))`
- **Indexes:** idx_poultry_health_farm: (farm_id); idx_poultry_health_event: (batch_id, event_type); idx_poultry_health_next_due: (farm_id, next_due_date) WHERE (next_due_date IS NOT NULL); idx_poultry_health_due: (farm_id, next_due_date) WHERE (next_due_date IS NOT NULL); idx_poultry_health_batch: (batch_id, event_date DESC)
- **Triggers:** none

### `poultry_mortality`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid, record_date:date=CURRENT_DATE, record_type:text='mortality'::text, count_dead:integer, cause:text?, symptoms:text?, notes:text?, created_at:timestamptz=now()
- **FKs:** farm_id→farms.id, batch_id→poultry_batches.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_mortality.farm_id) AND (fm.user_id = auth.uid()))))`; DELETE/INSERT/SELECT/UPDATE: `(batch_id IN ( SELECT poultry_batches.id FROM poultry_batches WHERE (poultry_batches.farm_id IN ( SELECT farm_managers.farm_id FROM farm_...`
- **Indexes:** idx_poultry_mortality_batch_date: (batch_id, record_date DESC); idx_poultry_mortality_date: (record_date, batch_id); idx_poultry_mortality_farm: (farm_id, record_date DESC); idx_poultry_mortality_batch: (batch_id, record_date DESC)
- **Triggers:** none

### `poultry_sales`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, batch_id:uuid?, sale_date:date=CURRENT_DATE, sale_type:text, quantity:numeric, unit:text, price_per_unit:numeric, total_price:numeric, buyer_name:text?, buyer_contact:text?, payment_method:text?='Cash'::text, payment_status:text?='paid'::text, market:text?, notes:text?, created_at:timestamptz=now()
- **FKs:** batch_id→poultry_batches.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `(EXISTS ( SELECT 1 FROM farm_managers fm WHERE ((fm.farm_id = poultry_sales.farm_id) AND (fm.user_id = auth.uid()))))`; DELETE/INSERT/SELECT/UPDATE: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_poultry_sales_farm_date: (farm_id, sale_date DESC); idx_poultry_sales_farm: (farm_id, sale_date DESC); idx_poultry_sales_batch: (batch_id, sale_date DESC); idx_poultry_sales_type: (farm_id, sale_type)
- **Triggers:** none

### `rate_limits`
- **Columns:** id:bigint=nextval('rate_limits_id_seq'::regclass), user_id:uuid?, farm_id:uuid?, endpoint:text, request_count:integer?=1, reset_at:timestamptz, created_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(user_id = auth.uid())`
- **Indexes:** idx_rate_limits_reset_at: (reset_at); idx_rate_limits_user_endpoint_reset: (user_id, endpoint, reset_at)
- **Triggers:** none

### `small_ruminant_breeding`
- **Columns:** id:uuid=gen_random_uuid(), dam_id:uuid, heat_date:date?, service_date:date, service_type:text?, sire_id:uuid?, sire_breed:text?, sire_tag:text?, pregnancy_check_date:date?, pregnancy_result:text?, expected_delivery_date:date?, actual_delivery_date:date?, number_of_offspring:integer?, offspring_ids:ARRAY?, delivery_type:text?, complications:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** dam_id→small_ruminants.id, sire_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(dam_id)`
- **Indexes:** idx_small_ruminant_breeding_dam: (dam_id); idx_small_ruminant_breeding_dam_id: (dam_id)
- **Triggers:** none

### `small_ruminant_health`
- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, event_date:date, event_type:text, vaccine_type:text?, vaccine_name:text?, vaccine_batch_number:text?, next_vaccination_due:date?, disease:text?, symptoms:text?, treatment:text?, drug_name:text?, dosage:text?, vet_name:text?, vet_contact:text?, withdrawal_days:integer?, safe_consumption_date:date?, cost:numeric?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(animal_id)`
- **Indexes:** idx_small_ruminant_health_animal: (animal_id); idx_small_ruminant_health_animal_id: (animal_id)
- **Triggers:** none

### `small_ruminant_sales`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, animal_id:uuid?, sale_date:date, sale_type:text, buyer_name:text?, buyer_contact:text?, live_weight_kg:numeric?, dressed_weight_kg:numeric?, price_per_kg:numeric?, total_price:numeric, milk_quantity_liters:numeric?, milk_price_per_liter:numeric?, payment_method:text?, payment_status:text?='paid'::text, market_location:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_small_ruminant_sales_farm_id: (farm_id)
- **Triggers:** none

### `small_ruminants`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, animal_tag:text, qr_code:text?, ear_notch_pattern:text?, name:text?, species:text, breed:text?, upgrade_level:text?, sex:text, birth_date:date, birth_weight:numeric?, sire_id:uuid?, dam_id:uuid?, breeding_type:text?, status:text?='active'::text, purpose:text?, source:text?, purchase_price:numeric?, purchase_date:date?, exit_date:date?, exit_reason:text?, exit_value:numeric?, coat_color:text?, distinguishing_marks:text?, notes:text?, created_at:timestamp?=now(), updated_at:timestamp?=now()
- **FKs:** dam_id→small_ruminants.id, farm_id→farms.id, sire_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_small_ruminants_status: (status); small_ruminants_qr_code_key: (qr_code); idx_small_ruminants_farm: (farm_id); idx_small_ruminants_farm_id: (farm_id); small_ruminants_animal_tag_key: (animal_tag)
- **Triggers:** trg_ruminant_parents_same_farm (BEFORE), update_small_ruminants_updated_at (BEFORE)

### `transactions`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid?, user_id:uuid?, amount:numeric, phone_number:text, merchant_request_id:text, checkout_request_id:text, status:text='pending'::text, mpesa_receipt_number:text?, result_desc:text?, months_added:integer=1, created_at:timestamptz?=now(), updated_at:timestamptz?=now()
- **FKs:** farm_id→farms.id
- **RLS:** SELECT: `(user_id = auth.uid())`; ALL: `(auth.role() = 'service_role'::text)`
- **Indexes:** idx_transactions_farm_id_created: (farm_id, created_at DESC); idx_transactions_checkout_request_id: (checkout_request_id)
- **Triggers:** trg_transactions_updated_at (BEFORE)

### `vet_visits`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid, cow_id:uuid?, visit_date:date, vet_name:text, vet_contact:text?, visit_reason:text?, diagnosis:text?, prescription:text?, cost:numeric?, next_visit_date:date?, notes:text?, created_at:timestamp?=now()
- **FKs:** cow_id→cows.id, farm_id→farms.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm(farm_id)`
- **Indexes:** idx_vet_visits_farm_id: (farm_id)
- **Triggers:** none

### `wards`
- **Columns:** id:text, name:varchar, constituency_id:text, ward_uid:varchar?, population_2009:integer?, created_at:timestamp?=CURRENT_TIMESTAMP
- **FKs:** constituency_id→constituencies.id
- **RLS:** none
- **Indexes:** idx_wards_constituency: (constituency_id); wards_constituency_id_name_key: (constituency_id, name)
- **Triggers:** none

### `weight_records`
- **Columns:** id:uuid=gen_random_uuid(), animal_id:uuid, record_date:date, weight_kg:numeric, age_days:integer?, average_daily_gain:numeric?, body_condition_score:numeric?, measurement_type:text?, notes:text?, created_at:timestamp?=now()
- **FKs:** animal_id→small_ruminants.id
- **RLS:** DELETE/INSERT/SELECT/UPDATE: `can_manage_farm_by_small_ruminant_id(animal_id)`
- **Indexes:** idx_weight_records_animal_id: (animal_id)
- **Triggers:** none

### `whatsapp_messages`
- **Columns:** id:uuid=gen_random_uuid(), farm_id:uuid?, sender_phone:text, message_text:text?, message_type:text?, media_url:text?, media_type:text?, intent:text?, intent_confidence:numeric?, entities_extracted:jsonb?, response_text:text?, response_sent_at:timestamp?, session_id:text?, conversation_context:jsonb?, created_at:timestamp?=now()
- **FKs:** farm_id→farms.id
- **RLS:** ALL: `(auth.role() = 'service_role'::text)`; INSERT/SELECT: `can_manage_farm(farm_id)`; SELECT: `(farm_id IN ( SELECT farm_managers.farm_id FROM farm_managers WHERE (farm_managers.user_id = auth.uid())))`
- **Indexes:** idx_whatsapp_messages_farm: (farm_id, created_at DESC) WHERE (farm_id IS NOT NULL); idx_whatsapp_messages_phone: (sender_phone, created_at DESC); idx_whatsapp_messages_farm_id: (farm_id); idx_whatsapp_created: (created_at); idx_whatsapp_phone: (sender_phone); idx_whatsapp_farm: (farm_id)
- **Triggers:** none.

# Framed Insight Web — Database Views Reference

## Dashboard & Farm Summary

### `v_farm_summary`
```sql
WITH dairy_stats AS (
SELECT c.farm_id,
count(c.id) AS total_cows,
count(c.id) FILTER (WHERE c.status = 'active'::text AND c.purpose = 'dairy'::text) AS producing_cows,
round(COALESCE(avg(mr.total_milk) FILTER (WHERE mr.record_date >= (CURRENT_DATE - 7)), 0::numeric), 1) AS avg_daily_milk_7d,
round(COALESCE(sum(COALESCE(mr.morning_milk, 0::numeric) + COALESCE(mr.midday_milk, 0::numeric) + COALESCE(mr.evening_milk, 0::numeric)) FILTER (WHERE mr.record_date = CURRENT_DATE), 0::numeric), 1) AS today_milk_liters,
count(DISTINCT mr.cow_id) FILTER (WHERE mr.record_date >= (CURRENT_DATE - 30)) AS active_milking_cows_30d
FROM cows c
LEFT JOIN milk_records mr ON mr.cow_id = c.id
GROUP BY c.farm_id
), coffee_stats AS (
SELECT cp_1.farm_id,
count(DISTINCT cp_1.plot_id) AS total_coffee_plots,
count(cp_1.id) AS total_coffee_plants,
count(cp_1.id) FILTER (WHERE COALESCE(cp_1.age_years, 0::numeric) >= 3::numeric) AS mature_coffee_plants,
count(cp_1.id) FILTER (WHERE cp_1.eudr_compliant = true) AS eudr_compliant_plants,
count(cp_1.id) FILTER (WHERE cp_1.plant_status = 'productive'::text) AS productive_plants
FROM coffee_plants cp_1
GROUP BY cp_1.farm_id
), harvest_stats AS (
SELECT ch.farm_id,
round(COALESCE(sum(ch.cherry_kg) FILTER (WHERE EXTRACT(year FROM ch.harvest_date) = EXTRACT(year FROM CURRENT_DATE)), 0::numeric), 1) AS season_cherry_kg,
round(COALESCE(sum(ch.total_value) FILTER (WHERE EXTRACT(year FROM ch.harvest_date) = EXTRACT(year FROM CURRENT_DATE)), 0::numeric), 0) AS season_coffee_revenue_kes,
max(ch.harvest_date) AS last_harvest_date
FROM coffee_harvests ch
GROUP BY ch.farm_id
), ruminant_stats AS (
SELECT sr_1.farm_id,
count(sr_1.id) FILTER (WHERE sr_1.status = 'active'::text) AS total_active_ruminants,
count(sr_1.id) FILTER (WHERE sr_1.status = 'active'::text AND sr_1.species = 'goat'::text) AS total_goats,
count(sr_1.id) FILTER (WHERE sr_1.status = 'active'::text AND sr_1.species = 'sheep'::text) AS total_sheep,
count(sr_1.id) FILTER (WHERE sr_1.status = 'active'::text AND sr_1.sex = 'female'::text) AS female_ruminants,
count(sr_1.id) FILTER (WHERE sr_1.created_at >= date_trunc('month'::text, now())) AS added_this_month
FROM small_ruminants sr_1
GROUP BY sr_1.farm_id
), poultry_stats AS (
SELECT pb.farm_id,
count(pb.id) FILTER (WHERE pb.status = 'active'::text) AS active_batches,
COALESCE(sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text), 0::bigint) AS total_birds,
COALESCE(sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text AND (pb.bird_type = ANY (ARRAY['layer'::text, 'dual_purpose'::text]))), 0::bigint) AS layer_birds,
COALESCE(sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text AND pb.bird_type = 'broiler'::text), 0::bigint) AS broiler_birds,
COALESCE(sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text AND pb.bird_type = 'kienyeji'::text), 0::bigint) AS kienyeji_birds
FROM poultry_batches pb
GROUP BY pb.farm_id
), egg_today AS (
SELECT pb.farm_id,
COALESCE(sum(per.total_eggs), 0::bigint) AS today_eggs
FROM poultry_egg_records per
JOIN poultry_batches pb ON pb.id = per.batch_id
WHERE per.record_date = CURRENT_DATE
GROUP BY pb.farm_id
), alert_stats AS (
SELECT a.farm_id,
count(a.id) FILTER (WHERE a.status = 'pending'::text) AS pending_alerts,
count(a.id) FILTER (WHERE a.status = 'pending'::text AND a.alert_priority = 'high'::text) AS high_priority_alerts
FROM alerts a
GROUP BY a.farm_id
)
SELECT f.id,
f.farm_name,
f.owner_name,
f.phone,
f.subscription_tier,
f.land_size_acres,
f.farm_types,
f.created_at,
COALESCE(d.total_cows, 0::bigint) AS total_cows,
COALESCE(d.producing_cows, 0::bigint) AS producing_cows,
COALESCE(d.today_milk_liters, 0::numeric) AS today_milk_liters,
COALESCE(d.avg_daily_milk_7d, 0::numeric) AS avg_daily_milk_7d,
COALESCE(d.active_milking_cows_30d, 0::bigint) AS active_milking_cows_30d,
COALESCE(cp.total_coffee_plots, 0::bigint) AS total_coffee_plots,
COALESCE(cp.total_coffee_plants, 0::bigint) AS total_coffee_plants,
COALESCE(cp.mature_coffee_plants, 0::bigint) AS mature_coffee_plants,
COALESCE(cp.productive_plants, 0::bigint) AS productive_coffee_plants,
COALESCE(cp.eudr_compliant_plants, 0::bigint) AS eudr_compliant_plants,
COALESCE(h.season_cherry_kg, 0::numeric) AS season_cherry_kg,
COALESCE(h.season_coffee_revenue_kes, 0::numeric) AS season_coffee_revenue_kes,
h.last_harvest_date,
COALESCE(sr.total_active_ruminants, 0::bigint) AS total_small_ruminants,
COALESCE(sr.total_goats, 0::bigint) AS total_goats,
COALESCE(sr.total_sheep, 0::bigint) AS total_sheep,
COALESCE(sr.female_ruminants, 0::bigint) AS female_ruminants,
COALESCE(sr.added_this_month, 0::bigint) AS ruminants_added_this_month,
COALESCE(al.pending_alerts, 0::bigint) AS pending_alerts,
COALESCE(al.high_priority_alerts, 0::bigint) AS high_priority_alerts,
'dairy'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) AS has_dairy,
'coffee'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) AS has_coffee,
'sheep_goat'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) AS has_small_ruminants,
COALESCE(f.subscription_tier, 'smallholder'::text) AS effective_tier,
CASE
WHEN 'dairy'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) THEN 1
ELSE 0
END +
CASE
WHEN 'coffee'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) THEN 1
ELSE 0
END +
CASE
WHEN 'sheep_goat'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) THEN 1
ELSE 0
END +
CASE
WHEN 'poultry'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) THEN 1
ELSE 0
END AS enterprise_count,
'poultry'::text = ANY (COALESCE(f.farm_types, '{}'::text[])) AS has_poultry,
COALESCE(po.active_batches, 0::bigint) AS poultry_active_batches,
COALESCE(po.total_birds, 0::bigint) AS total_poultry_birds,
COALESCE(po.layer_birds, 0::bigint) AS poultry_layers,
COALESCE(po.broiler_birds, 0::bigint) AS poultry_broilers,
COALESCE(po.kienyeji_birds, 0::bigint) AS poultry_kienyeji,
COALESCE(et.today_eggs, 0::bigint) AS today_eggs
FROM farms f
LEFT JOIN dairy_stats d ON d.farm_id = f.id
LEFT JOIN coffee_stats cp ON cp.farm_id = f.id
LEFT JOIN harvest_stats h ON h.farm_id = f.id
LEFT JOIN ruminant_stats sr ON sr.farm_id = f.id
LEFT JOIN poultry_stats po ON po.farm_id = f.id
LEFT JOIN egg_today et ON et.farm_id = f.id
LEFT JOIN alert_stats al ON al.farm_id = f.id;
```
### `v_active_subscriptions`
```sql
SELECT id AS farm_id,
farm_name,
phone,
subscription_tier,
subscription_end_date,
created_at AS farm_created_at,
CASE
WHEN subscription_end_date IS NOT NULL AND subscription_end_date > now() THEN 'active'::text
WHEN subscription_end_date IS NULL AND (now() - created_at::timestamp with time zone) < '14 days'::interval THEN 'trial'::text
WHEN subscription_end_date IS NOT NULL AND subscription_end_date <= now() AND (now() - subscription_end_date::timestamp with time zone) < '3 days'::interval THEN 'grace'::text
ELSE 'expired'::text
END AS sub_status,
GREATEST(0::numeric, EXTRACT(epoch FROM subscription_end_date::timestamp with time zone - now()) / 86400::numeric)::integer AS days_remaining
FROM farms f
WHERE is_active = true;
```
## Dairy & Livestock

### `v_daily_production`
```sql
WITH cow_agg AS (
SELECT cow.farm_id,
mr.record_date,
count(DISTINCT mr.cow_id) AS cows_milked,
sum(COALESCE(mr.morning_milk, 0::numeric)) AS total_morning_milk,
sum(COALESCE(mr.midday_milk, 0::numeric)) AS total_midday_milk,
sum(COALESCE(mr.evening_milk, 0::numeric)) AS total_evening_milk,
sum(COALESCE(mr.morning_milk, 0::numeric) + COALESCE(mr.midday_milk, 0::numeric) + COALESCE(mr.evening_milk, 0::numeric)) AS total_milk_liters
FROM milk_records mr
JOIN cows cow ON cow.id = mr.cow_id
GROUP BY cow.farm_id, mr.record_date
), goat_agg AS (
SELECT goat.farm_id,
gmr.record_date,
count(DISTINCT gmr.animal_id) AS goats_milked,
sum(COALESCE(gmr.morning_milk, 0::numeric)) AS goat_morning_milk,
sum(COALESCE(gmr.midday_milk, 0::numeric)) AS goat_midday_milk,
sum(COALESCE(gmr.evening_milk, 0::numeric)) AS goat_evening_milk,
sum(COALESCE(gmr.morning_milk, 0::numeric) + COALESCE(gmr.midday_milk, 0::numeric) + COALESCE(gmr.evening_milk, 0::numeric)) AS total_goat_milk_liters
FROM goat_milk_records gmr
JOIN small_ruminants goat ON goat.id = gmr.animal_id
GROUP BY goat.farm_id, gmr.record_date
)
SELECT COALESCE(c.farm_id, g.farm_id) AS farm_id,
COALESCE(c.record_date, g.record_date) AS record_date,
COALESCE(c.cows_milked, 0::bigint) AS cows_milked,
COALESCE(c.total_morning_milk, 0::numeric) AS total_morning_milk,
COALESCE(c.total_midday_milk, 0::numeric) AS total_midday_milk,
COALESCE(c.total_evening_milk, 0::numeric) AS total_evening_milk,
COALESCE(c.total_milk_liters, 0::numeric) AS total_milk_liters,
COALESCE(g.goats_milked, 0::bigint) AS goats_milked,
COALESCE(g.goat_morning_milk, 0::numeric) AS goat_morning_milk,
COALESCE(g.goat_midday_milk, 0::numeric) AS goat_midday_milk,
COALESCE(g.goat_evening_milk, 0::numeric) AS goat_evening_milk,
COALESCE(g.total_goat_milk_liters, 0::numeric) AS total_goat_milk_liters,
COALESCE(c.total_milk_liters, 0::numeric) + COALESCE(g.total_goat_milk_liters, 0::numeric) AS grand_total_milk
FROM cow_agg c
FULL JOIN goat_agg g ON c.farm_id = g.farm_id AND c.record_date = g.record_date;
```
### `v_animal_milk_summary`
```sql
SELECT a.id AS animal_id,
a.animal_tag,
a.name,
a.species,
a.breed,
count(mp.id) AS records_count,
round(avg(mp.total_milk), 2) AS avg_daily_milk,
round(sum(mp.total_milk), 2) AS total_milk_7days,
max(mp.record_date) AS last_record_date,
max(mp.lactation_number) AS current_lactation,
max(mp.days_in_milk) AS current_days_in_milk
FROM small_ruminants a
LEFT JOIN milk_production mp ON a.id = mp.animal_id AND mp.record_date >= (CURRENT_DATE - '7 days'::interval)
WHERE (a.purpose = ANY (ARRAY['dairy'::text, 'dual'::text])) AND a.status = 'active'::text
GROUP BY a.id, a.animal_tag, a.name, a.species, a.breed
ORDER BY (round(avg(mp.total_milk), 2)) DESC NULLS LAST;
```
## Coffee Finance & P&L

### `v_season_pnl`
```sql
WITH harvest_revenue AS (
SELECT h.farm_id,
h.harvest_year,
h.harvest_season,
COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'cherry'::text), 0::numeric) AS cherry_kg_total,
COALESCE(sum(h.total_value) FILTER (WHERE h.produce_type = 'cherry'::text), 0::numeric) AS cherry_revenue,
COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'mbuni'::text), 0::numeric) AS mbuni_kg_total,
COALESCE(sum(h.total_value) FILTER (WHERE h.produce_type = 'mbuni'::text), 0::numeric) AS mbuni_revenue,
count(*) AS total_deliveries,
count(*) FILTER (WHERE h.payment_status = 'pending'::text) AS deliveries_pending,
count(*) FILTER (WHERE h.payment_status = 'advance_paid'::text) AS deliveries_advance,
count(*) FILTER (WHERE h.payment_status = 'paid'::text) AS deliveries_paid,
count(*) FILTER (WHERE h.payment_status = 'partial'::text) AS deliveries_partial,
COALESCE(sum(h.total_value), 0::numeric) AS revenue_total_expected,
COALESCE(sum(h.amount_paid), 0::numeric) AS revenue_received,
CASE
WHEN sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'cherry'::text) > 0::numeric THEN round(sum(h.total_value) FILTER (WHERE h.produce_type = 'cherry'::text) / sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'cherry'::text), 2)
ELSE NULL::numeric
END AS avg_cherry_price_per_kg,
CASE
WHEN sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'mbuni'::text) > 0::numeric THEN round(sum(h.total_value) FILTER (WHERE h.produce_type = 'mbuni'::text) / sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'mbuni'::text), 2)
ELSE NULL::numeric
END AS avg_mbuni_price_per_kg
FROM coffee_harvests h
GROUP BY h.farm_id, h.harvest_year, h.harvest_season
), activity_costs AS (
SELECT a.farm_id,
EXTRACT(year FROM a.activity_date)::integer AS harvest_year,
COALESCE(sum(a.total_cost), 0::numeric) AS total_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = 'fertilizer'::text), 0::numeric) AS fertilizer_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = 'spraying'::text), 0::numeric) AS spraying_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = 'weeding'::text), 0::numeric) AS weeding_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = 'pruning'::text), 0::numeric) AS pruning_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = 'mulching'::text), 0::numeric) AS mulching_costs,
COALESCE(sum(a.cost_labour), 0::numeric) AS labour_costs,
COALESCE(sum(a.cost_inputs), 0::numeric) AS input_costs
FROM coffee_activities a
GROUP BY a.farm_id, (EXTRACT(year FROM a.activity_date)::integer)
)
SELECT r.farm_id,
f.farm_name,
r.harvest_year,
r.harvest_season,
r.cherry_kg_total,
r.mbuni_kg_total,
r.cherry_kg_total + r.mbuni_kg_total AS total_kg_delivered,
r.cherry_revenue,
r.mbuni_revenue,
r.cherry_revenue + r.mbuni_revenue AS total_revenue_expected,
r.revenue_received,
GREATEST(0::numeric, r.cherry_revenue + r.mbuni_revenue - r.revenue_received) AS revenue_outstanding,
r.avg_cherry_price_per_kg,
r.avg_mbuni_price_per_kg,
c.total_costs,
c.fertilizer_costs,
c.spraying_costs,
c.weeding_costs,
c.pruning_costs,
c.mulching_costs,
c.labour_costs,
c.input_costs,
r.revenue_received - COALESCE(c.total_costs, 0::numeric) AS net_profit_realised,
r.cherry_revenue + r.mbuni_revenue - COALESCE(c.total_costs, 0::numeric) AS net_profit_expected,
CASE
WHEN (r.cherry_revenue + r.mbuni_revenue) > 0::numeric THEN round((r.cherry_revenue + r.mbuni_revenue - COALESCE(c.total_costs, 0::numeric)) / (r.cherry_revenue + r.mbuni_revenue) * 100::numeric, 1)
ELSE NULL::numeric
END AS margin_pct,
CASE
WHEN (r.cherry_kg_total + r.mbuni_kg_total) > 0::numeric THEN round(COALESCE(c.total_costs, 0::numeric) / (r.cherry_kg_total + r.mbuni_kg_total), 2)
ELSE NULL::numeric
END AS cost_per_kg,
r.total_deliveries,
r.deliveries_pending,
r.deliveries_advance,
r.deliveries_paid,
r.deliveries_partial
FROM harvest_revenue r
LEFT JOIN farms f ON f.id = r.farm_id
LEFT JOIN activity_costs c ON c.farm_id = r.farm_id AND c.harvest_year = r.harvest_year
ORDER BY r.harvest_year DESC, r.harvest_season;
```
### `v_plot_pnl`
```sql
WITH plot_revenue AS (
SELECT h.farm_id,
h.plot_name,
h.harvest_year,
h.harvest_season,
COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)), 0::numeric) AS total_kg,
COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'cherry'::text), 0::numeric) AS cherry_kg,
COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE h.produce_type = 'mbuni'::text), 0::numeric) AS mbuni_kg,
COALESCE(sum(h.total_value), 0::numeric) AS total_revenue,
COALESCE(sum(h.amount_paid), 0::numeric) AS revenue_received,
count(*) FILTER (WHERE h.payment_status = 'pending'::text) AS pending_payments,
count(*) AS total_deliveries
FROM coffee_harvests h
GROUP BY h.farm_id, h.plot_name, h.harvest_year, h.harvest_season
), plot_costs AS (
SELECT a.farm_id,
cp.plot_name,
EXTRACT(year FROM a.activity_date)::integer AS harvest_year,
COALESCE(sum(a.total_cost), 0::numeric) AS total_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = 'spraying'::text), 0::numeric) AS spray_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = 'fertilizer'::text), 0::numeric) AS fertilizer_costs,
COALESCE(sum(a.total_cost) FILTER (WHERE a.activity_type = ANY (ARRAY['weeding'::text, 'pruning'::text, 'mulching'::text])), 0::numeric) AS other_costs
FROM coffee_activities a
JOIN coffee_plots cp ON cp.id = a.plot_id
GROUP BY a.farm_id, cp.plot_name, (EXTRACT(year FROM a.activity_date)::integer)
)
SELECT r.farm_id,
f.farm_name,
r.plot_name,
r.harvest_year,
r.harvest_season,
r.cherry_kg,
r.mbuni_kg,
r.total_kg,
r.total_revenue,
r.revenue_received,
r.pending_payments,
r.total_deliveries,
COALESCE(c.total_costs, 0::numeric) AS total_costs,
COALESCE(c.spray_costs, 0::numeric) AS spray_costs,
COALESCE(c.fertilizer_costs, 0::numeric) AS fertilizer_costs,
COALESCE(c.other_costs, 0::numeric) AS other_costs,
r.total_revenue - COALESCE(c.total_costs, 0::numeric) AS net_profit,
CASE
WHEN r.total_kg > 0::numeric THEN round(r.total_revenue / r.total_kg, 2)
ELSE NULL::numeric
END AS revenue_per_kg,
CASE
WHEN r.total_kg > 0::numeric THEN round(COALESCE(c.total_costs, 0::numeric) / r.total_kg, 2)
ELSE NULL::numeric
END AS cost_per_kg,
CASE
WHEN r.total_revenue > 0::numeric THEN round((r.total_revenue - COALESCE(c.total_costs, 0::numeric)) / r.total_revenue * 100::numeric, 1)
ELSE NULL::numeric
END AS margin_pct
FROM plot_revenue r
LEFT JOIN farms f ON f.id = r.farm_id
LEFT JOIN plot_costs c ON c.farm_id = r.farm_id AND c.plot_name = r.plot_name AND c.harvest_year = r.harvest_year
ORDER BY r.harvest_year DESC, (r.total_revenue - COALESCE(c.total_costs, 0::numeric)) DESC NULLS LAST;
```
### `v_payment_tracker`
```sql
SELECT h.id,
h.farm_id,
f.farm_name,
h.plot_name,
h.harvest_date,
h.harvest_year,
h.harvest_season,
h.produce_type,
COALESCE(h.produce_kg, h.cherry_kg) AS produce_kg,
h.cooperative_name,
h.receipt_number,
h.factory_code,
h.lot_number,
h.price_per_kg,
h.total_value,
h.payment_status,
h.payment_date,
h.amount_paid,
h.total_value - COALESCE(h.amount_paid, 0::numeric) AS amount_outstanding,
CURRENT_DATE - h.harvest_date AS days_since_delivery,
CASE
WHEN h.produce_type = 'mbuni'::text AND h.payment_status = 'pending'::text AND (CURRENT_DATE - h.harvest_date) > 90 THEN 'payment_overdue'::text
WHEN h.produce_type = 'cherry'::text AND h.payment_status = 'pending'::text AND (CURRENT_DATE - h.harvest_date) > 7 THEN 'advance_overdue'::text
WHEN h.produce_type = 'cherry'::text AND (h.payment_status = ANY (ARRAY['advance_paid'::text, 'partial'::text])) AND (CURRENT_DATE - h.harvest_date) > 90 THEN 'final_overdue'::text
WHEN h.payment_status = 'paid'::text THEN 'complete'::text
ELSE 'on_track'::text
END AS payment_flag,
h.mbuni_accepted,
h.mbuni_rejection_reason,
h.notes,
h.created_at
FROM coffee_harvests h
LEFT JOIN farms f ON f.id = h.farm_id
ORDER BY h.harvest_date DESC;
```
### `v_season_cost_summary`
```sql
SELECT a.farm_id,
f.farm_name,
EXTRACT(year FROM a.activity_date)::integer AS harvest_year,
a.activity_type,
count(*) AS activity_count,
COALESCE(sum(a.total_cost), 0::numeric) AS total_cost,
COALESCE(sum(a.cost_labour), 0::numeric) AS total_labour_cost,
COALESCE(sum(a.cost_inputs), 0::numeric) AS total_input_cost,
round(avg(a.total_cost), 2) AS avg_cost_per_activity,
round(avg(a.cost_labour), 2) AS avg_labour_per_activity,
round(avg(a.cost_inputs), 2) AS avg_inputs_per_activity,
COALESCE(sum(a.area_covered_ha), 0::numeric) AS total_area_covered_ha,
CASE
WHEN sum(a.area_covered_ha) > 0::numeric THEN round(sum(a.total_cost) / sum(a.area_covered_ha), 2)
ELSE NULL::numeric
END AS cost_per_hectare
FROM coffee_activities a
LEFT JOIN farms f ON f.id = a.farm_id
GROUP BY a.farm_id, f.farm_name, (EXTRACT(year FROM a.activity_date)::integer), a.activity_type
ORDER BY (EXTRACT(year FROM a.activity_date)::integer) DESC, (COALESCE(sum(a.total_cost), 0::numeric)) DESC;
```
### `v_coffee_season_costs`
```sql
SELECT ca.farm_id,
cp.plot_name,
ca.plot_id,
EXTRACT(year FROM ca.activity_date) AS year,
ca.activity_type,
count(*) AS activity_count,
sum(COALESCE(ca.cost_inputs, 0::numeric)) AS total_input_cost,
sum(COALESCE(ca.cost_labour, 0::numeric)) AS total_labour_cost,
sum(COALESCE(ca.total_cost, 0::numeric)) AS total_cost
FROM coffee_activities ca
LEFT JOIN coffee_plots cp ON cp.id = ca.plot_id
GROUP BY ca.farm_id, cp.plot_name, ca.plot_id, (EXTRACT(year FROM ca.activity_date)), ca.activity_type
ORDER BY (EXTRACT(year FROM ca.activity_date)) DESC, (sum(COALESCE(ca.total_cost, 0::numeric))) DESC;
```
### `coffee_revenue_summary`
```sql
SELECT farm_id,
EXTRACT(year FROM harvest_date) AS harvest_year,
count(*) AS total_harvests,
sum(COALESCE(total_value, 0::numeric)) AS total_revenue,
avg(COALESCE(total_value, 0::numeric)) AS avg_revenue_per_harvest
FROM coffee_harvests h
GROUP BY farm_id, (EXTRACT(year FROM harvest_date));
```
### `coffee_cost_summary`
```sql
SELECT farm_id,
EXTRACT(year FROM activity_date) AS activity_year,
count(*) AS total_activities,
sum(COALESCE(total_cost, 0::numeric)) AS total_costs,
avg(COALESCE(total_cost, 0::numeric)) AS avg_cost_per_activity
FROM coffee_activities a
GROUP BY farm_id, (EXTRACT(year FROM activity_date));
```
## Coffee Compliance & Health

### `cooperative_eudr_summary`
```sql
SELECT cp.farm_id,
f.farm_name,
f.county,
count(cp.id) AS total_plots,
round(sum(cp.area_hectares), 3) AS total_hectares,
count(cp.id) FILTER (WHERE cp.eudr_risk_level = 'low'::text) AS low_risk_plots,
count(cp.id) FILTER (WHERE cp.eudr_risk_level = 'medium'::text) AS medium_risk_plots,
count(cp.id) FILTER (WHERE cp.eudr_risk_level = 'high'::text) AS high_risk_plots,
count(cp.id) FILTER (WHERE cp.gps_polygon IS NOT NULL) AS plots_with_polygon,
count(cp.id) FILTER (WHERE cp.afa_geo_mapping_id IS NOT NULL) AS afa_verified_plots
FROM coffee_plots cp
JOIN farms f ON f.id = cp.farm_id
GROUP BY cp.farm_id, f.farm_name, f.county;
```
### `v_current_scouting_alerts`
```sql
SELECT sr.id AS scouting_record_id,
sr.farm_id,
f.farm_name,
sr.plot_id,
cp.plot_name,
cp.region_name,
sr.scouting_date,
sr.observation_type,
sr.severity_level,
sr.pest_count_per_tree,
sr.threshold_breached,
sr.alert_level,
sr.action_taken,
dt.action_threshold,
dt.action_count,
dt.recommended_product,
dt.application_notes,
CURRENT_DATE - sr.scouting_date AS days_since_detection,
CASE
WHEN sr.action_taken = ANY (ARRAY['sprayed_immediately'::text, 'calendar_spray_sufficient'::text]) THEN 'resolved'::text
WHEN sr.action_taken = 'scheduled_spray'::text AND (CURRENT_DATE - sr.scouting_date) <= 3 THEN 'pending_action'::text
WHEN sr.action_taken = 'scheduled_spray'::text AND (CURRENT_DATE - sr.scouting_date) > 3 THEN 'overdue'::text
WHEN sr.action_taken = 'none'::text AND sr.threshold_breached THEN 'action_required'::text
ELSE 'monitoring'::text
END AS status
FROM coffee_scouting_records sr
JOIN farms f ON f.id = sr.farm_id
LEFT JOIN coffee_plots cp ON cp.id = sr.plot_id
LEFT JOIN coffee_disease_thresholds dt ON dt.disease_pest_type = sr.observation_type AND dt.region_name = cp.region_name
WHERE sr.scouting_date >= (CURRENT_DATE - '30 days'::interval) AND sr.observation_type <> 'healthy'::text
ORDER BY (
CASE sr.alert_level
WHEN 'emergency'::text THEN 1
WHEN 'action_required'::text THEN 2
WHEN 'watch'::text THEN 3
ELSE 4
END), sr.scouting_date DESC;
```
### `v_disease_pressure_analytics`
```sql
SELECT cp.region_name,
EXTRACT(month FROM sr.scouting_date)::integer AS month,
EXTRACT(year FROM sr.scouting_date)::integer AS year,
sr.observation_type,
count(*) AS detection_count,
count(*) FILTER (WHERE sr.threshold_breached) AS threshold_breaches,
count(*) FILTER (WHERE sr.alert_level = 'emergency'::text) AS emergency_alerts,
avg(sr.pest_count_per_tree) AS avg_pest_count,
count(*) FILTER (WHERE sr.severity_level = 'light'::text) AS light_severity_count,
count(*) FILTER (WHERE sr.severity_level = 'moderate'::text) AS moderate_severity_count,
count(*) FILTER (WHERE sr.severity_level = 'severe'::text) AS severe_severity_count,
avg(
CASE
WHEN sr.action_taken = 'sprayed_immediately'::text THEN 0
WHEN sr.spray_activity_id IS NOT NULL THEN (( SELECT coffee_activities.activity_date
FROM coffee_activities
WHERE coffee_activities.id = sr.spray_activity_id)) - sr.scouting_date
ELSE NULL::integer
END) AS avg_days_to_spray
FROM coffee_scouting_records sr
LEFT JOIN coffee_plots cp ON cp.id = sr.plot_id
WHERE sr.observation_type <> 'healthy'::text
GROUP BY cp.region_name, (EXTRACT(month FROM sr.scouting_date)::integer), (EXTRACT(year FROM sr.scouting_date)::integer), sr.observation_type
ORDER BY (EXTRACT(year FROM sr.scouting_date)::integer) DESC, (EXTRACT(month FROM sr.scouting_date)::integer) DESC, (count(*)) DESC;
```
## Coffee Satellite & Weather

### `v_plot_latest_satellite`
```sql
SELECT DISTINCT ON (cp.id) cp.id AS plot_id,
cp.farm_id,
cp.plot_name,
cp.area_hectares,
cp.region_name,
csi.image_date,
csi.ndvi_mean,
csi.ndre_mean,
csi.ndwi_mean,
csi.ndvi_std,
csi.health_score,
csi.health_label,
csi.ndvi_change,
csi.health_score_change,
csi.weeks_of_decline,
csi.alert_triggered,
csi.alert_reason,
EXTRACT(epoch FROM now() - csi.image_date::timestamp without time zone::timestamp with time zone)::integer / 86400 AS days_since_image,
CASE
WHEN csi.image_date IS NULL THEN NULL::text
WHEN (EXTRACT(epoch FROM now() - csi.image_date::timestamp without time zone::timestamp with time zone)::integer / 86400) <= 7 THEN 'current'::text
WHEN (EXTRACT(epoch FROM now() - csi.image_date::timestamp without time zone::timestamp with time zone)::integer / 86400) <= 14 THEN 'recent'::text
WHEN (EXTRACT(epoch FROM now() - csi.image_date::timestamp without time zone::timestamp with time zone)::integer / 86400) <= 30 THEN 'stale'::text
ELSE 'very_stale'::text
END AS data_freshness
FROM coffee_plots cp
LEFT JOIN coffee_satellite_indices csi ON cp.id = csi.plot_id
ORDER BY cp.id, csi.image_date DESC NULLS LAST;
```
### `v_plot_ndvi_trend`
```sql
SELECT plot_id,
image_date,
ndvi_mean,
ndre_mean,
health_score,
health_label,
alert_triggered,
row_number() OVER (PARTITION BY plot_id ORDER BY image_date) AS reading_number
FROM coffee_satellite_indices
WHERE image_date >= (CURRENT_DATE - '90 days'::interval)
ORDER BY plot_id, image_date;
```
### `v_farm_satellite_health`
```sql
SELECT cp.farm_id,
count(DISTINCT cp.id) AS total_plots_monitored,
count(DISTINCT
CASE
WHEN csi.health_label = 'good'::text THEN cp.id
ELSE NULL::uuid
END) AS plots_good,
count(DISTINCT
CASE
WHEN csi.health_label = 'watch'::text THEN cp.id
ELSE NULL::uuid
END) AS plots_watch,
count(DISTINCT
CASE
WHEN csi.health_label = 'stress'::text THEN cp.id
ELSE NULL::uuid
END) AS plots_stress,
count(DISTINCT
CASE
WHEN csi.health_label = 'critical'::text THEN cp.id
ELSE NULL::uuid
END) AS plots_critical,
count(DISTINCT
CASE
WHEN csi.alert_triggered = true THEN cp.id
ELSE NULL::uuid
END) AS plots_with_alerts,
round(avg(csi.health_score)) AS avg_health_score,
round(avg(csi.ndvi_mean), 3) AS avg_ndvi,
max(csi.image_date) AS most_recent_image,
count(DISTINCT
CASE
WHEN (EXTRACT(epoch FROM now() - csi.image_date::timestamp without time zone::timestamp with time zone)::integer / 86400) > 14 THEN cp.id
ELSE NULL::uuid
END) AS stale_plots
FROM coffee_plots cp
LEFT JOIN LATERAL ( SELECT coffee_satellite_indices.id,
coffee_satellite_indices.farm_id,
coffee_satellite_indices.plot_id,
coffee_satellite_indices.image_date,
coffee_satellite_indices.acquired_at,
coffee_satellite_indices.cloud_cover_pct,
coffee_satellite_indices.sentinel_tile,
coffee_satellite_indices.ndvi_mean,
coffee_satellite_indices.ndvi_min,
coffee_satellite_indices.ndvi_max,
coffee_satellite_indices.ndvi_std,
coffee_satellite_indices.ndre_mean,
coffee_satellite_indices.ndre_min,
coffee_satellite_indices.ndre_max,
coffee_satellite_indices.ndwi_mean,
coffee_satellite_indices.ndwi_min,
coffee_satellite_indices.ndwi_max,
coffee_satellite_indices.health_score,
coffee_satellite_indices.health_label,
coffee_satellite_indices.ndvi_change,
coffee_satellite_indices.health_score_change,
coffee_satellite_indices.weeks_of_decline,
coffee_satellite_indices.alert_triggered,
coffee_satellite_indices.alert_reason,
coffee_satellite_indices.raw_cdse_response,
coffee_satellite_indices.created_at
FROM coffee_satellite_indices
WHERE coffee_satellite_indices.plot_id = cp.id
ORDER BY coffee_satellite_indices.image_date DESC
LIMIT 1) csi ON true
GROUP BY cp.farm_id;
```
### `v_plot_latest_weather`
```sql
SELECT cp.id AS plot_id,
cp.farm_id,
cp.plot_name,
cp.region_name,
cw.date AS weather_date,
cw.temperature_2m_mean,
cw.precipitation_sum,
cw.relative_humidity_2m_mean,
cw.soil_moisture_0_to_10cm,
cw.cbd_risk_score,
cw.clr_risk_score,
cw.drought_stress_score,
avg(cw.cbd_risk_score) OVER (PARTITION BY cp.id ORDER BY cw.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg_cbd_risk_7d,
avg(cw.clr_risk_score) OVER (PARTITION BY cp.id ORDER BY cw.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg_clr_risk_7d,
avg(cw.drought_stress_score) OVER (PARTITION BY cp.id ORDER BY cw.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg_drought_risk_7d
FROM coffee_plots cp
LEFT JOIN LATERAL ( SELECT cpw.id,
cpw.plot_id,
cpw.date,
cpw.temperature_2m_mean,
cpw.temperature_2m_max,
cpw.temperature_2m_min,
cpw.precipitation_sum,
cpw.relative_humidity_2m_mean,
cpw.soil_moisture_0_to_10cm,
cpw.evapotranspiration,
cpw.weather_code,
cpw.cbd_risk_score,
cpw.clr_risk_score,
cpw.drought_stress_score,
cpw.created_at
FROM coffee_plot_weather cpw
WHERE cpw.plot_id = cp.id
ORDER BY cpw.date DESC
LIMIT 1) cw ON true
WHERE cp.id IS NOT NULL;
```
## Poultry

### `v_poultry_summary`
```sql
WITH batch_stats AS (
SELECT pb.farm_id,
count(pb.id) FILTER (WHERE pb.status = 'active'::text) AS active_batches,
sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text) AS total_birds,
sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text AND pb.bird_type = 'layer'::text) AS total_layers,
sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text AND pb.bird_type = 'broiler'::text) AS total_broilers,
sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text AND pb.bird_type = 'kienyeji'::text) AS total_kienyeji,
sum(pb.current_count) FILTER (WHERE pb.status = 'active'::text AND pb.bird_type = 'dual_purpose'::text) AS total_dual
FROM poultry_batches pb
GROUP BY pb.farm_id
), egg_stats AS (
SELECT pb.farm_id,
round(sum(pe.total_eggs) FILTER (WHERE pe.record_date = CURRENT_DATE)::numeric, 0) AS today_eggs,
round(avg(pe.total_eggs) FILTER (WHERE pe.record_date >= (CURRENT_DATE - 7)), 1) AS avg_daily_eggs_7d,
sum(pe.total_eggs) FILTER (WHERE pe.record_date >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)) AS month_eggs
FROM poultry_egg_records pe
JOIN poultry_batches pb ON pb.id = pe.batch_id
GROUP BY pb.farm_id
), mortality_stats AS (
SELECT pm.farm_id,
sum(pm.count_dead) FILTER (WHERE pm.record_date >= (CURRENT_DATE - 7)) AS deaths_last_7d,
sum(pm.count_dead) FILTER (WHERE pm.record_date >= (CURRENT_DATE - 30)) AS deaths_last_30d
FROM poultry_mortality pm
GROUP BY pm.farm_id
), feed_stats AS (
SELECT DISTINCT ON (poultry_feed_records.farm_id) poultry_feed_records.farm_id,
poultry_feed_records.days_remaining AS feed_days_remaining
FROM poultry_feed_records
WHERE poultry_feed_records.days_remaining IS NOT NULL
ORDER BY poultry_feed_records.farm_id, poultry_feed_records.record_date DESC
), revenue_stats AS (
SELECT poultry_sales.farm_id,
round(sum(poultry_sales.total_price) FILTER (WHERE poultry_sales.sale_date >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)), 0) AS revenue_this_month,
round(sum(poultry_sales.total_price) FILTER (WHERE poultry_sales.sale_date >= (CURRENT_DATE - 30)), 0) AS revenue_last_30d
FROM poultry_sales
GROUP BY poultry_sales.farm_id
)
SELECT f.id AS farm_id,
COALESCE(bs.active_batches, 0::bigint) AS active_batches,
COALESCE(bs.total_birds, 0::bigint) AS total_birds,
COALESCE(bs.total_layers, 0::bigint) AS total_layers,
COALESCE(bs.total_broilers, 0::bigint) AS total_broilers,
COALESCE(bs.total_kienyeji, 0::bigint) AS total_kienyeji,
COALESCE(es.today_eggs, 0::numeric) AS today_eggs,
COALESCE(es.avg_daily_eggs_7d, 0::numeric) AS avg_daily_eggs_7d,
COALESCE(es.month_eggs, 0::bigint) AS month_eggs,
COALESCE(ms.deaths_last_7d, 0::bigint) AS deaths_last_7d,
COALESCE(ms.deaths_last_30d, 0::bigint) AS deaths_last_30d,
COALESCE(fs.feed_days_remaining, 0) AS feed_days_remaining,
COALESCE(rs.revenue_this_month, 0::numeric) AS revenue_this_month,
COALESCE(rs.revenue_last_30d, 0::numeric) AS revenue_last_30d,
'poultry'::text = ANY (f.farm_types) AS has_poultry
FROM farms f
LEFT JOIN batch_stats bs ON bs.farm_id = f.id
LEFT JOIN egg_stats es ON es.farm_id = f.id
LEFT JOIN mortality_stats ms ON ms.farm_id = f.id
LEFT JOIN feed_stats fs ON fs.farm_id = f.id
LEFT JOIN revenue_stats rs ON rs.farm_id = f.id;
```
## System / Maintenance

### `v_message_queue_stats`
```sql
SELECT status,
count(*) AS count,
min(created_at) AS oldest_message,
max(created_at) AS newest_message,
round(EXTRACT(epoch FROM now() - min(created_at)) / 60.0, 1) AS oldest_age_minutes
FROM message_queue
GROUP BY status;
```
### `v_error_events_to_delete`
```sql
SELECT id
FROM error_events
WHERE created_at < (now() - '30 days'::interval);
```
### `v_api_logs_to_delete`
```sql
SELECT id
FROM api_request_logs
WHERE created_at < (now() - '7 days'::interval);
```

# Framed Insight Web — Schema Conventions & Semantics

## 1. Enum-like text columns

Postgres stores these as plain `text`, not real enums, so nothing stops an invalid value at the column level — validation has to happen in application code or via the RLS/trigger layer.

### `coffee_harvests`
- `produce_type` (default `'cherry'`): `'cherry'` | `'mbuni'`. Drives branching logic in `v_season_pnl`, `v_payment_tracker`, and `v_plot_pnl` (different payment-overdue windows: cherry = 7 days to advance, mbuni = 90 days to final payment).
- `payment_status` (default `'pending'`): `'pending'` | `'advance_paid'` | `'partial'` | `'paid'`. `v_payment_tracker.payment_flag` and `v_season_pnl` deliveries breakdown both branch on this.
- `processing_method` (default `'Wet/Washed'`): free text in practice, but `'Wet/Washed'` is the only value currently produced by the UI.

### `cows`
- `status` (default `'active'`): `'active'` | (others used in `exit_reason`-paired states, e.g. sold/died — check `exit_date`/`exit_reason` together when `status != 'active'`).
- `purpose` (default `'dairy'`): `'dairy'` | other values used by `v_farm_summary.producing_cows` filter (`status='active' AND purpose='dairy'`).

### `small_ruminants`
- `status` (default `'active'`): `'active'` | exited states (paired with `exit_date`/`exit_reason`/`exit_value`).
- `species`: `'goat'` | `'sheep'` — referenced directly in `v_farm_summary.ruminant_stats` (`total_goats`, `total_sheep`).
- `purpose`: `'dairy'` | `'dual'` | (meat-only, implied) — `v_animal_milk_summary` filters `purpose IN ('dairy','dual')`.
- `sex`: `'male'` | `'female'` — `v_farm_summary.female_ruminants` filters on this.

### `poultry_batches`
- `bird_type`: `'layer'` | `'broiler'` | `'kienyeji'` | `'dual_purpose'`. All poultry views (`v_poultry_summary`, `v_farm_summary.poultry_stats`) branch on these four exact strings — a fifth value would silently fall through every `FILTER (WHERE bird_type = ...)` clause and undercount totals.
- `status` (default `'active'`): `'active'` | closed states (paired with `closed_date`).

### `v_payment_tracker.payment_flag` (computed, not stored)
Possible values: `'payment_overdue'` | `'advance_overdue'` | `'final_overdue'` | `'complete'` | `'on_track'`. Useful for filtering in app code if querying this view directly.

## 2. Denormalized fields that must stay in sync

### `coffee_harvests.harvest_year` / `harvest_season`
Both are stored columns, **not** generated from `harvest_date`, even though they conceptually derive from it. `v_season_pnl`, `v_plot_pnl`, `coffee_revenue_summary` all `GROUP BY` these stored columns directly (not `EXTRACT(year FROM harvest_date)`). If application code inserts a `harvest_date` without setting `harvest_year`/`harvest_season` to match, the harvest will be invisible to season-based P&L views or will appear in the wrong season — there's no trigger or constraint that backfills or validates this.

### `coffee_harvests.produce_kg` vs `cherry_kg`
Both are `NOT NULL numeric`. Every view uses `COALESCE(produce_kg, cherry_kg)` as the effective quantity — `cherry_kg` appears to be the legacy column and `produce_kg` the current one. New inserts should populate both (or at minimum `produce_kg`, with `cherry_kg` set to a consistent value such as 0 or the same figure) to avoid `NOT NULL` violations and to keep both fields meaningful if older code still reads `cherry_kg` directly.

### `coffee_activities` cost fields
`total_cost`, `cost_labour`, and `cost_inputs` are independent nullable columns with no enforced relationship (`total_cost` is not a generated sum of the other two). `v_season_pnl.activity_costs` sums `total_cost` for the headline cost figure but separately sums `cost_labour`/`cost_inputs` for the breakdown — if these aren't kept consistent at insert time, the breakdown won't reconcile with the total shown elsewhere.

## 3. Cross-farm write constraints (enforced by triggers, not column types)

These will silently succeed for valid same-farm data and **raise a Postgres exception** on cross-tenant references. Application code calling INSERT/UPDATE on these tables should catch and surface these errors to the user rather than letting them bubble as generic 500s.

- **`calving_records`** — `trg_calf_same_farm` (BEFORE INSERT/UPDATE): if `calf_id` is set, it must reference a `cows` row with the same `farm_id` as the row referenced by `cow_id`. Raises `'calf_id must belong to the same farm as cow_id'`.
- **`cows`** — `trg_cow_parents_same_farm` (BEFORE INSERT/UPDATE): if `dam_id` or `sire_id` is set, each must reference a `cows` row with the same `farm_id` as the row being written. Raises `'dam_id must belong to the same farm'` / `'sire_id must belong to the same farm'`. Only re-checks on UPDATE if `dam_id`/`sire_id`/`farm_id` actually changed.
- **`small_ruminants`** — `trg_ruminant_parents_same_farm` (BEFORE INSERT/UPDATE): same pattern as above, scoped to `small_ruminants.dam_id`/`sire_id`.

**Practical implication:** when building forms or AI-agent flows that let a user pick a calf/dam/sire from a dropdown, the dropdown options should already be scoped to `farm_id = current_farm` via RLS — but if an agent constructs an INSERT directly (e.g. from a WhatsApp intent parser matching an animal by tag across all farms), it must filter candidates by `farm_id` *before* insert, or the trigger will reject the write.

## 4. RLS function reference

Two helper functions gate almost all row-level security in this schema. Neither is redefined per-table — they're shared functions referenced by `using`/`with_check` expressions.

- **`can_manage_farm(farm_id)`** — used by tables that have their own `farm_id` column directly (`coffee_harvests`, `coffee_activities`, `small_ruminants`, `cows`, `poultry_batches`, `alerts`, `financial_records`, etc.). Resolves to checking `farm_id IN (SELECT farm_managers.farm_id FROM farm_managers WHERE user_id = auth.uid())`.
- **`can_manage_farm_by_cow_id(cow_id)`** — used by tables that reference a cow but don't store `farm_id` themselves (`milk_records`, `health_records`, `vet_visits`, `calving_records`, `breeding_events`, `calves`). Joins through `cows.farm_id`.
- **`can_manage_farm_by_small_ruminant_id(animal_id)`** — same pattern for small-ruminant-linked tables (`goat_milk_records`, `small_ruminant_health`, `weight_records`, `small_ruminant_sales`, `small_ruminant_breeding`, `kidding_lambing_records`).

**Implication for agents:** if a new table is added that references `cow_id` or `animal_id` without a direct `farm_id` column, RLS will need one of the `*_by_*_id` helper functions — copying a plain `can_manage_farm(farm_id)` policy onto such a table would fail (no `farm_id` column) or silently deny all access.

## 5. Tables with no RLS (intentional)

These are either public reference data or service-role-only — do not add user-facing RLS policies expecting `farm_id` scoping, since these tables don't carry tenant data:

- `counties`, `constituencies`, `wards` — GIS reference lookups
- `coffee_pest_library`, `coffee_disease_thresholds`, `coffee_calendar_regions` — shared agronomic reference data (the disease thresholds table does have one `SELECT true` policy for "anyone can read")
- `message_queue`, `message_results` — service-role only (WhatsApp bot infrastructure)
- `phone_otp_codes` — anon-role read/write for OTP flow, by design

## 6. Open items / known gaps (carried from prior audits)

- **Small ruminant species coverage:** `small_ruminant_breeding` and `kidding_lambing_records` exist as the goat/sheep equivalents of `breeding_events`/`calving_records` — but use `dam_id`/`sire_id`/`kid_lamb_id` naming (not `cow_id`/`calf_id`). An agent translating between cattle and small-ruminant reproduction records needs to map these field names, not assume parity.
- **`calves` vs `calving_records`:** both exist and both link to `cows`. `calves` appears to be an older/parallel table (`dam_id`, `sire_code` as free text, `weaning_date`/`weaning_weight`) while `calving_records` is the newer structured version (`breeding_event_id` FK, `calf_vigor`, `delivery_type`). Confirm which is the source of truth before writing to either — writing to both risks double-counting in any future "total calves" aggregation.
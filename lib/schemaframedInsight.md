Framed Insight Web — Database Schema Dictionary📊 1. Relational Views Schema (public, extensions, vault)public.v_daily_productionAggregates and merges milk production records from cows and small ruminants (goats) by farm and date (p. 3).SQL Query Logic:sqlWITH cow_agg AS (
    SELECT 
        cow.farm_id,
        mr.record_date,
        count(DISTINCT mr.cow_id) AS cows_milked,
        sum(COALESCE(mr.morning_milk, (0)::numeric)) AS total_morning_milk,
        sum(COALESCE(mr.midday_milk, (0)::numeric)) AS total_midday_milk,
        sum(COALESCE(mr.evening_milk, (0)::numeric)) AS total_evening_milk,
        sum(((COALESCE(mr.morning_milk, (0)::numeric) + COALESCE(mr.midday_milk, (0)::numeric)) + COALESCE(mr.evening_milk, (0)::numeric))) AS total_milk_liters
    FROM (milk_records mr
    JOIN cows cow ON ((cow.id = mr.cow_id)))
    GROUP BY cow.farm_id, mr.record_date
), goat_agg AS (
    SELECT 
        goat.farm_id,
        gmr.record_date,
        count(DISTINCT gmr.animal_id) AS goats_milked,
        sum(COALESCE(gmr.morning_milk, (0)::numeric)) AS goat_morning_milk,
        sum(COALESCE(gmr.midday_milk, (0)::numeric)) AS goat_midday_milk,
        sum(COALESCE(gmr.evening_milk, (0)::numeric)) AS goat_evening_milk,
        sum(((COALESCE(gmr.morning_milk, (0)::numeric) + COALESCE(gmr.midday_milk, (0)::numeric)) + COALESCE(gmr.evening_milk, (0)::numeric))) AS total_goat_milk_liters
    FROM (goat_milk_records gmr
    JOIN small_ruminants goat ON ((goat.id = gmr.animal_id)))
    GROUP BY goat.farm_id, gmr.record_date
)
SELECT 
    COALESCE(c.farm_id, g.farm_id) AS farm_id,
    COALESCE(c.record_date, g.record_date) AS record_date,
    COALESCE(c.cows_milked, (0)::bigint) AS cows_milked,
    COALESCE(c.total_morning_milk, (0)::numeric) AS total_morning_milk,
    COALESCE(c.total_midday_milk, (0)::numeric) AS total_midday_milk,
    COALESCE(c.total_evening_milk, (0)::numeric) AS total_evening_milk,
    COALESCE(c.total_milk_liters, (0)::numeric) AS total_milk_liters,
    COALESCE(g.goats_milked, (0)::bigint) AS goats_milked,
    COALESCE(g.goat_morning_milk, (0)::numeric) AS goat_morning_milk,
    COALESCE(g.goat_midday_milk, (0)::numeric) AS goat_midday_milk,
    COALESCE(g.goat_evening_milk, (0)::numeric) AS goat_evening_milk,
    COALESCE(g.total_goat_milk_liters, (0)::numeric) AS total_goat_milk_liters,
    (COALESCE(c.total_milk_liters, (0)::numeric) + COALESCE(g.total_goat_milk_liters, (0)::numeric)) AS grand_total_milk
FROM (cow_agg c
FULL JOIN goat_agg g ON (((c.farm_id = g.farm_id) AND (c.record_date = g.record_date))));
Use code with caution.public.v_current_scouting_alertsCalculates real-time crop disease or pest threats over a moving 30-day window (p. 2).SQL Query Logic:sqlSELECT 
    sr.id AS scouting_record_id,
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
    (CURRENT_DATE - sr.scouting_date) AS days_since_detection,
    CASE
        WHEN (sr.action_taken = ANY (ARRAY['sprayed_immediately'::text, 'calendar_spray_sufficient'::text])) THEN 'resolved'::text
        WHEN ((sr.action_taken = 'scheduled_spray'::text) AND ((CURRENT_DATE - sr.scouting_date) <= 3)) THEN 'pending_action'::text
        WHEN ((sr.action_taken = 'scheduled_spray'::text) AND ((CURRENT_DATE - sr.scouting_date) > 3)) THEN 'overdue'::text
        WHEN ((sr.action_taken = 'none'::text) AND sr.threshold_breached) THEN 'action_required'::text
        ELSE 'monitoring'::text
    END AS status
FROM (((coffee_scouting_records sr
  JOIN farms f ON ((f.id = sr.farm_id)))
  LEFT JOIN coffee_plots cp ON ((cp.id = sr.plot_id)))
  LEFT JOIN coffee_disease_thresholds dt ON (((dt.disease_pest_type = sr.observation_type) AND (dt.region_name = cp.region_name))))
WHERE ((sr.scouting_date >= (CURRENT_DATE - '30 days'::interval)) AND (sr.observation_type <> 'healthy'::text))
ORDER BY
    CASE sr.alert_level
        WHEN 'emergency'::text THEN 1
        WHEN 'action_required'::text THEN 2
        WHEN 'watch'::text THEN 3
        ELSE 4
    END, sr.scouting_date DESC;
Use code with caution.public.v_plot_pnlGenerates profit and loss data frames at individual field/plot granularities, matching seasonal harvest deliveries against recorded operational overhead (p. 4).SQL Query Logic:sqlWITH plot_revenue AS (
    SELECT 
        h.farm_id,
        h.plot_name,
        h.harvest_season,
        h.harvest_year,
        COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)), (0)::numeric) AS total_kg,
        COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE (h.produce_type = 'cherry'::text)), (0)::numeric) AS cherry_kg,
        COALESCE(sum(COALESCE(h.produce_kg, h.cherry_kg)) FILTER (WHERE (h.produce_type = 'mbuni'::text)), (0)::numeric) AS mbuni_kg,
        COALESCE(sum(h.total_value), (0)::numeric) AS total_revenue,
        COALESCE(sum(h.amount_paid), (0)::numeric) AS revenue_received,
        count(*) FILTER (WHERE (h.payment_status = 'pending'::text)) AS pending_payments,
        count(*) AS total_deliveries
    FROM coffee_harvests h
    GROUP BY h.farm_id, h.plot_name, h.harvest_year, h.harvest_season
), plot_costs AS (
    SELECT 
        a.farm_id,
        cp.plot_name,
        (EXTRACT(year FROM a.activity_date))::integer AS harvest_year,
        COALESCE(sum(a.total_cost), (0)::numeric) AS total_costs,
        COALESCE(sum(a.total_cost) FILTER (WHERE (a.activity_type = 'spraying'::text)), (0)::numeric) AS spray_costs,
        COALESCE(sum(a.total_cost) FILTER (WHERE (a.activity_type = 'fertilizer'::text)), (0)::numeric) AS fertilizer_costs,
        COALESCE(sum(a.total_cost) FILTER (WHERE (a.activity_type = ANY (ARRAY['weeding'::text, 'pruning'::text, 'mulching'::text]))), (0)::numeric) AS other_costs
    FROM (coffee_activities a
    JOIN coffee_plots cp ON ((cp.id = a.plot_id)))
    GROUP BY a.farm_id, cp.plot_name, ((EXTRACT(year FROM a.activity_date))::integer)
)
SELECT 
    r.farm_id, f.farm_name, r.plot_name, r.harvest_year, r.harvest_season, r.cherry_kg, r.mbuni_kg, r.total_kg,
    r.total_revenue, r.revenue_received, r.pending_payments, r.total_deliveries,
    COALESCE(c.total_costs, (0)::numeric) AS total_costs,
    COALESCE(c.spray_costs, (0)::numeric) AS spray_costs,
    COALESCE(c.fertilizer_costs, (0)::numeric) AS fertilizer_costs,
    COALESCE(c.other_costs, (0)::numeric) AS other_costs,
    (r.total_revenue - COALESCE(c.total_costs, (0)::numeric)) AS net_profit,
    CASE WHEN (r.total_kg > (0)::numeric) THEN round((r.total_revenue / r.total_kg), 2) ELSE NULL::numeric END AS revenue_per_kg,
    CASE WHEN (r.total_kg > (0)::numeric) THEN round((COALESCE(c.total_costs, (0)::numeric) / r.total_kg), 2) ELSE NULL::numeric END AS cost_per_kg,
    CASE WHEN (r.total_revenue > COALESCE(c.total_costs, (0)::numeric)) THEN round((((r.total_revenue - COALESCE(c.total_costs, (0)::numeric)) / r.total_revenue) * (100)::numeric), 1) ELSE NULL::numeric END AS margin_pct
FROM ((plot_revenue r
LEFT JOIN plot_costs c ON (((c.farm_id = r.farm_id) AND (c.plot_name = r.plot_name) AND (c.harvest_year = r.harvest_year))))
LEFT JOIN farms f ON ((f.id = r.farm_id)))
ORDER BY r.harvest_year DESC, (r.total_revenue - COALESCE(c.total_costs, (0)::numeric)) DESC NULLS LAST;
Use code with caution.public.v_plot_latest_satelliteRetrieves the most recent remote sensing metrics mapped against discrete polygon fields (p. 7).SQL Query Logic:sqlSELECT DISTINCT ON (cp.id) 
    cp.id AS plot_id, cp.farm_id, cp.plot_name, cp.area_hectares, cp.region_name,
    csi.image_date, csi.ndvi_mean, csi.ndre_mean, csi.ndwi_mean, csi.ndvi_std,
    csi.health_score, csi.health_label, csi.ndvi_change, csi.health_score_change,
    csi.weeks_of_decline, csi.alert_triggered, csi.alert_reason,
    ((EXTRACT(epoch FROM (now() - ((csi.image_date)::timestamp without time zone)::timestamp with time zone)))::integer / 86400) AS days_since_image,
    CASE
        WHEN (csi.image_date IS NULL) THEN NULL::text
        WHEN (((EXTRACT(epoch FROM (now() - ((csi.image_date)::timestamp without time zone)::timestamp with time zone)))::integer / 86400) <= 7) THEN 'current'::text
        WHEN (((EXTRACT(epoch FROM (now() - ((csi.image_date)::timestamp without time zone)::timestamp with time zone)))::integer / 86400) <= 14) THEN 'recent'::text
        WHEN (((EXTRACT(epoch FROM (now() - ((csi.image_date)::timestamp without time zone)::timestamp with time zone)))::integer / 86400) <= 30) THEN 'stale'::text
        ELSE 'very_stale'::text
    END AS data_freshness
FROM (coffee_plots cp
LEFT JOIN coffee_satellite_indices csi ON ((cp.id = csi.plot_id)))
ORDER BY cp.id, csi.image_date DESC NULLS LAST;
Use code with caution.public.v_active_subscriptionsEvaluates platform entitlement windows, calculating operational grace periods or expiration flags (p. 8).SQL Query Logic:sqlSELECT 
    id AS farm_id, farm_name, phone, subscription_end_date, created_at AS farm_created_at, subscription_tier,
    CASE
        WHEN ((subscription_end_date IS NOT NULL) AND (subscription_end_date > now())) THEN 'active'::text
        WHEN ((subscription_end_date IS NULL) AND ((now() - (created_at)::timestamp with time zone) < '14 days'::interval)) THEN 'trial'::text
        WHEN ((subscription_end_date IS NOT NULL) AND (subscription_end_date <= now()) AND ((now() - (subscription_end_date)::timestamp with time zone) < '3 days'::interval)) THEN 'grace'::text
        ELSE 'expired'::text
    END AS sub_status,
    (GREATEST((0)::numeric, (EXTRACT(epoch FROM ((subscription_end_date)::timestamp with time zone - now())) / (86400)::numeric)))::integer AS days_remaining
FROM farms f
WHERE (is_active = true);
Use code with caution.Clean System / Maintenance Viewspublic.v_error_events_to_delete: SELECT id FROM error_events WHERE (created_at < (now() - '30 days'::interval)); (p. 1)public.v_api_logs_to_delete: SELECT id FROM api_request_logs WHERE (created_at < (now() - '7 days'::interval)); (p. 1)extensions.pg_stat_statements_info: Tracks structural execution stat balance metrics reset indicators (p. 1).vault.decrypted_secrets: System internal reference placeholder (definition: null) (p. 1).🗂 2. Main Structural Tables Schema (public)📦 Table: milk_productionTracks multi-session daily dairy weight readings for registered smaller livestock (p. 12).Column NameData TypeNullableDefault Value / Constraintsid 🔑uuidNOgen_random_uuid()farm_id 🔗uuidNOReferences table farms(id)animal_id 🔗uuidNOReferences table small_ruminants(id)record_datedateNONonemorning_milknumericYESNonemidday_milknumericYESNoneevening_milknumericYESNonetotal_milknumericYESNonelactation_numberintegerYESNonedays_in_milkintegerYESNonefat_contentnumericYESNonemilk_qualitytextYESNonetemperaturenumericYESNonenotestextYESNonecreated_attimestamp with tzYESnow()updated_attimestamp with tzYESnow()Row Level Security (RLS) Policies:Users can view own farm milk records: SELECT allowed where farm_id IN (SELECT farm_managers.farm_id FROM farm_managers WHERE user_id = auth.uid()) (p. 13).Users can insert own farm milk records: INSERT verification WITH CHECK where farm_id IN (SELECT farm_managers.farm_id FROM farm_managers WHERE user_id = auth.uid()) (p. 13).Users can update own farm milk records: UPDATE permitted matching identical farm_managers map check expressions (p. 13).Users can delete own farm milk records: DELETE permitted matching identical farm_managers map check expressions (p. 13).📦 Table: coffee_harvestsStores yield delivery metrics, processing paths, and receipt structures for agricultural lots (p. 33).Column NameData TypeNullableDefault Value / Constraintsid 🔑uuidNOgen_random_uuid()farm_id 🔗uuidNOReferences table farms(id)harvest_datedateNONoneplot_nametextNONoneproduce_typetextYES'cherry'::textprocessing_methodtextYES'Wet/Washed'::textcherry_kgnumericNONoneproduce_kgnumericNONoneparchment_kgnumericYESNoneclean_coffee_kgnumericYESNonequality_gradetextYESNoneprice_per_kgnumericYESNonetotal_valuenumericYESNoneamount_paidnumericYESNonepayment_statustextYES'pending'::textpayment_datedateYESNonereceipt_numbertextYESNonelot_numbertextYESNonefactory_codetextYESNonecooperative_nametextYESNonebuyer_nametextYESNonembuni_acceptedbooleanYEStruembuni_rejection_reasontextYESNonecherry_conditiontextYESNonence_transaction_idtextYESNoneharvest_yearintegerYESNoneharvest_seasontextYESNonenotestextYESNonecreated_attimestampYESnow()Row Level Security (RLS) Policies:Farm managers can access their coffee harvests: ALL operational methods verified directly against native subquery structures linking matching active profile records (auth.uid()) (p. 34).Users can view/insert/update/delete coffee harvests for farms they manage: Managed via standard regional procedural checks (can_manage_farm(farm_id)) (p. 34).📦 Table: coffee_plot_weatherMaintains environmental telemetry and calculated crop pathology threat risk indices at fine field thresholds (p. 20).Column NameData TypeNullableDefault Valueid 🔑uuidNOgen_random_uuid()plot_id 🔗uuidNOReferences table coffee_plots(id)datedateNONonetemperature_2m_meannumericYESNonetemperature_2m_maxnumericYESNonetemperature_2m_minnumericYESNonerelative_humidity_2m_meannumericYESNoneprecipitation_sumnumericYESNoneevapotranspirationnumericYESNonesoil_moisture_0_to_10cmnumericYESNoneweather_codeintegerYESNonecbd_risk_scoreintegerYESCoffee Berry Disease risk mapping indexclr_risk_scoreintegerYESCoffee Leaf Rust risk mapping indexdrought_stress_scoreintegerYESDrought Stress structural tracker indexcreated_attimestamp with tzYESnow()Row Level Security (RLS) Policies:Farm managers can read: SELECT allowed if EXISTS (SELECT 1 FROM farm_managers fm JOIN coffee_plots cp ON cp.farm_id = fm.farm_id WHERE fm.user_id = auth.uid() AND cp.id = coffee_plot_weather.plot_id) (p. 20).Service role full access: Allows ALL operations for backend workers checking token context metadata roles ((auth.jwt() ->> 'role') = 'service_role') (p. 21).📦 Table: small_ruminantsCentral physical registry tracking discrete biological tags, lineages, and production targets for livestock (p. 37).Column NameData TypeNullableDefault Valueid 🔑uuidNOgen_random_uuid()farm_id 🔗uuidNOReferences table farms(id)animal_tagtextNOMandatory unique ear tag referencenametextYESNonespeciestextNOe.g., 'goat', 'sheep' (p. 10)breedtextYESNonesextextNONonepurposetextYESe.g., 'dairy', 'meat', 'dual' (p. 8)statustextYES'active'::text (p. 8)birth_datedateNONonebirth_weightnumericYESNoneweaning_datedateYESNoneweaning_weightnumericYESNonedam_id 🔗uuidYESSelf-referencing link to small_ruminants(id)sire_id 🔗uuidYESSelf-referencing link to small_ruminants(id)sire_id_codetextYESExternal AI/Sire inventory string contextcoat_colortextYESNonedistinguishing_markstextYESNoneear_notch_patterntextYESNoneqr_codetextYESNonepurchase_pricenumericYESNonepurchase_datedateYESNoneexit_datedateYESNoneexit_reasontextYESNoneexit_valuenumericYESNoneupgrade_leveltextYESBreed purity index categorizationcreated_attimestampYESnow()updated_attimestampYESnow()Row Level Security (RLS) Policies:Restricted via global can_manage_farm(farm_id) mechanics across all standard CRUD vectors (SELECT, INSERT, UPDATE, DELETE) (p. 38).📦 Table: poultry_batchesTracks production lots for various avian enterprises (p. 28).Column NameData TypeNullableDefault Valueid 🔑uuidNOgen_random_uuid()farm_id 🔗uuidNOReferences table farms(id)batch_nametextNONonebird_typetextNOe.g., 'layer', 'broiler', 'kienyeji' (p. 9)breedtextYESNoneinitial_countintegerNONonecurrent_countintegerNONonepurchase_price_per_birdnumericYESNonedate_of_placementdateNOCURRENT_DATEexpected_laying_datedateYESNonehousing_systemtextYESNonehouse_numbertextYESNonetarget_weight_kgnumericYESNonesourcetextYESHatchery source mapping contextstatustextNO'active'::textclosed_datedateYESNonenotestextYESNonecreated_attimestamp with tzNOnow()updated_attimestamp with tzNOnow()Row Level Security (RLS) Policies:Doubled checks enforce either standard nested explicit farm_managers profile scans or standalone optimized exists constraints: EXISTS (SELECT 1 FROM farm_managers fm WHERE fm.farm_id = poultry_batches.farm_id AND fm.user_id = auth.uid()) (p. 29).📦 Table: error_eventsApplication diagnostic framework collecting unhandled runtime bugs and API crash logs (p. 16).Column NameData TypeNullableDefault Valueid 🔑uuidNOgen_random_uuid()farm_id 🔗uuidYESReferences table farms(id)user_iduuidYESAssociated authenticated application userrequest_iduuidYESNoneendpointtextYESTarget route URLmethodtextYESHTTP action context methodstatus_codeintegerYESHTTP error code returnedresponse_time_msintegerYESSystem response timing captureseveritytextYESNonemessagetextNOCore exception stringstack_tracetextYESStack detailcontext_jsonjsonbYESContext parametersuser_agenttextYESBrowser metadata signatureip_addresstextYESRequest origin addresscreated_attimestamp with tzYESnow()Row Level Security (RLS) Policies:Users can view their farm's error events: Open SELECT filters row entries if (farm_id IS NULL) OR (auth.uid() IN (SELECT farm_managers.user_id FROM farm_managers WHERE farm_managers.farm_id = error_events.farm_id)) (p. 16).
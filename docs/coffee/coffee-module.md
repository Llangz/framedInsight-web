# Coffee Module

The most built-out enterprise in framedInsight, reflecting the founder's own background as a coffee factory manager and cooperative committee chairman. This document covers the farm-level coffee features (plots, activities, harvests, finance, pests/disease, satellite, weather). For the cooperative-scale supply chain (factory intake through to a published consumer passport), see `docs/coffee/coffee-passports.md` and `docs/architecture/traceability-architecture.md`. For EUDR specifically, see `docs/coffee/eudr-module.md`.

## 1. The Land Model: Plots vs Plants

`coffee_plots` is the primary land-parcel unit a farmer manages day to day — it carries the GPS point or polygon, variety, planting date, tree counts, and (denormalized) EUDR risk fields. `coffee_plants` exists at a finer grain — an individual tree with its own GPS point and QR code — used where per-tree tracking matters specifically for EUDR plant-level compliance flags, rather than for everyday farm management. Most day-to-day activity (recording activities, harvests, scouting) happens at the plot level; the plant-level table is a narrower, EUDR-driven addition.

A plot's area can be entered as **acres in the UI** but is always **stored in hectares** in the database (`area_hectares`) — every form that touches plot area converts at entry/submit time (`ACRES_TO_HA` conversion constant), not at read time. This matters if writing any direct database query or import script: the UI consistently does the conversion, the schema never stores acres.

### GPS capture: point vs polygon, and the 4-hectare branch

Plot boundary capture (`PlotBoundaryMapper` component) supports a persistent crosshair, undo/clear/done controls, live area calculation, and a walk-the-boundary GPS mode for plots too irregular to map by eye on a satellite image. Internally this produces a GeoJSON polygon (`coffee_plots.gps_polygon`), but **EUDR submission format branches on plot area**: plots under 4 hectares submit a single centroid point, plots at or above 4 ha submit the full polygon (`lib/eudr-constants.ts::getEudrGeolocationFormat` — see `docs/coffee/eudr-module.md`). The overwhelming majority of Kenyan smallholder coffee plots are well under 1 hectare, so point format is the common case in practice even though the polygon-capture UI is the more visible feature.

Satellite imagery for the boundary mapper is capped at `maxNativeZoom = 17` in the Leaflet config — this was deliberately lowered from the Leaflet default after rural Kenyan coverage at higher zoom levels was found to be unavailable/blank, which silently broke the map for areas outside major towns.

## 2. Field Activities — the Nutrition / Crop Protection Restructure

`coffee_activities` is the general field-work log: fertilizer/spray application, weeding, pruning, mulching, labour costs. The dashboard presents this to farmers under **two semantically correct agronomic categories — "Nutrition" and "Crop Protection"** — rather than the original flatter "fertilizer"/"spraying" framing, because that's how Kenyan extension officers and cooperative agronomists actually talk about these activities. This was a **UI-layer relabeling, not a schema change**: the database column `activity_type` still stores the original literal values.

| UI category (what the farmer sees) | DB `activity_type` value written | Sub-fields shown |
|---|---|---|
| Nutrition | `fertilizer` | `nutrition_method` (soil-applied vs foliar), `fertilizer_type` or `foliar_product` |
| Crop Protection | `spraying` | `protection_type`, `product_name`, `dilution_rate`, `spray_equipment` (stored as `application_method`) |
| Weeding | `weeding` (unchanged) | `weeding_method` |
| Pruning | `pruning` (unchanged) | `pruning_type` |
| Mulching / Other | `mulching` / `other` (unchanged) | free-text `material_or_desc` |

This mapping is why `docs/database/views-reference.md`'s P&L views (`v_season_pnl`, `v_plot_pnl`, `v_season_cost_summary`) correctly filter on `activity_type = 'fertilizer'`/`'spraying'` rather than the newer UI labels — **those views did not need updating when the UI was restructured**, and should not be changed to filter on `'nutrition'`/`'crop_protection'` literal strings, because the database never stores those.

`total_cost` is computed client-side as `cost_labour + cost_inputs` before submit, and enforced server-side by a `CHECK` constraint added in `20260625_coffee_activities_total_cost_check.sql` (added `NOT VALID`, so pre-existing rows weren't retroactively checked — see `docs/database/data-dictionary.md` §2).

### Built-in agrochemical compliance checking

Before a Crop Protection (or foliar Nutrition) activity can be saved, the entered product name is checked against `lib/agrochemical-compliance.ts` — a canonical list of active ingredients sourced from the **PCPB/Ministry of Agriculture's June 2025 press statement** (which named 77 banned, 202 restricted, and 151 under-review products) plus EU MRL Regulation (EC) 396/2005 export-residue limits. Each entry carries:
- `kenyaStatus`: `banned_kenya` | `restricted_kenya` | `under_review` | `banned_eu_export` | `ok`
- `euExportRisk`: whether the product is fine domestically but would jeopardize an EU-bound export lot's EUDR/MRL compliance
- Recommended alternatives and a human-readable reason shown directly to the farmer

A `'critical'` severity result **blocks the save outright** (`isBlocked` in `ActivityRecordClient.tsx` — the farmer must remove the non-compliant product before continuing); lower severities presumably warn without blocking (worth checking `getComplianceSeverity`'s exact threshold logic directly if building on this). This means compliance checking happens **client-side at entry time**, not as a database constraint — there's nothing stopping a non-compliant product name from being inserted via a direct API call that bypasses this specific UI component.

## 3. Harvests, Payments & Finance

`coffee_harvests` is the revenue anchor — every delivery (to a buyer, a cooperative factory, or directly to NCE auction) gets one row. Key business logic, fully detailed in `docs/database/data-dictionary.md` §1-2 and `docs/database/views-reference.md` §3:

- **Cherry vs mbuni** (`produce_type`) have different payment-overdue windows (cherry: 7-day advance; mbuni: 90-day final) — `v_payment_tracker.payment_flag` is the canonical place this logic lives.
- **`mbuni_accepted`/`mbuni_rejection_reason`** — a factory can reject mbuni (sun-dried, lower-grade cherry) deliveries; these fields capture that outcome.
- **`produce_kg` vs legacy `cherry_kg`** — always populate both on insert; every view reads `COALESCE(produce_kg, cherry_kg)`.
- **`harvest_year`/`harvest_season`** — stored, not derived; must be set consistently with `harvest_date` or the delivery becomes invisible to season-based P&L.

`coffee_financials` exists alongside `coffee_harvests`/`coffee_activities` for general cash transactions that don't fit either (e.g. recording an input purchase as a standalone financial entry) — see the data-dictionary naming-trap notes if extending this further; there's some overlap in purpose with `coffee_inputs` that's worth resolving rather than extending in three different directions.

## 4. Pest & Disease Management

Three generations of this feature exist; only the current one should be extended (full history in `docs/database/data-dictionary.md` §6):

1. ~~`coffee_diseases`~~ — earliest, **no longer live**.
2. `coffee_health_records` — AI-diagnosis fields, photo URLs. Still live, but `coffee_scouting_records` is the actively-developed current model.
3. **`coffee_scouting_records`** (current) — structured field observation with `severity_level`, `threshold_breached`, `alert_level`, and a link to the spray activity taken in response (`spray_activity_id → coffee_activities.id`).

`coffee_disease_thresholds` provides **region-specific** watch/action/emergency count thresholds (publicly readable reference data) — `coffee_scouting_records` is joined against it (by matching `region_name` + `observation_type`/`disease_pest_type`) in `v_current_scouting_alerts` to decide whether a given pest count actually warrants an alert for that region, rather than applying one universal threshold across all of Kenya's coffee-growing zones. `coffee_pest_library` supplies the identification reference content (symptoms, control measures, photos) shown alongside a scouting entry.

The **AI diagnosis route** (`app/api/ai/diagnose/route.ts`) accepts a photo URL plus `enterpriseType` and returns a structured diagnosis (disease name, severity, confidence, affected %, recommended treatment) via a Zod-validated LLM call — prompted specifically toward Coffee Berry Disease / Leaf Rust when `enterpriseType = 'coffee'`, vs. livestock conditions for dairy/small-ruminant enterprises. This is a general-purpose route shared across enterprises, not coffee-specific despite coffee being its most visible use.

## 5. Satellite Monitoring (NDVI Health)

`coffee_satellite_indices` stores per-plot, per-image-date vegetation indices (NDVI, NDRE, NDWI) fetched from Sentinel imagery via the `fetch-plot-indices` edge function, plus a computed `health_score`/`health_label` and week-over-week decline tracking (`weeks_of_decline`, `alert_triggered`). `coffee_satellite_fetch_log` records fetch attempts (including failures/cloud-cover issues) separately from the actual index data — useful for diagnosing "why hasn't this plot's health score updated" without that diagnostic noise living in the same table as the actual readings.

Three views serve this data to the dashboard at different granularities — latest-reading-per-plot (`v_plot_latest_satellite`, with a computed `data_freshness` label), a 90-day trend series for charting (`v_plot_ndvi_trend`), and a farm-wide rollup of how many plots are in each health bracket (`v_farm_satellite_health`). See `docs/database/views-reference.md` §5 for the exact SQL patterns.

## 6. Weather-Driven Disease Risk

`coffee_plot_weather` holds daily Open-Meteo weather pulls per plot plus three **computed risk scores**: `cbd_risk_score` (Coffee Berry Disease), `clr_risk_score` (Coffee Leaf Rust), `drought_stress_score`. `v_plot_latest_weather` exposes these with a 7-day trailing window-function average (not a simple latest-reading) so a risk reading reflects recent conditions even between fetches. Partial indexes (`idx_weather_cbd_risk WHERE cbd_risk_score > 60`, similarly for CLR/drought) exist specifically to make "show me plots currently at elevated risk" queries fast without scanning every weather row ever recorded.

## 7. Where the Cooperative-Scale Supply Chain Picks Up

Everything above is farm-level. The moment cherry leaves the farm and is delivered to a factory, it enters a separate, cooperative-scoped chain (`factory_intake_lots` → `lot_farmer_deliveries` → `processing_batches` → ... → `coffee_passports`) that's documented fully in `docs/architecture/traceability-architecture.md` and `docs/coffee/coffee-passports.md`. `coffee_quality_records` (cupping scores, certifications) is the bridge table linking a specific harvest to the quality data that eventually feeds a passport's `quality_metrics`.
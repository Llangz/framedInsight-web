# Database Views Reference

23 views/materialized-views are live and confirmed (22 in the regular `pg_views` export, `docs_source/views.json` — complete, well under its 100-row cap — plus the materialized `v_farm_summary`, which doesn't show up in that export because materialized views live in a separate Postgres catalog from regular views). One additional view referenced in code/migrations, `v_eudr_assessment_stream`, is **not live** — see the drift note in `docs/architecture/platform-overview.md` §10.

## 1. Dashboard & Farm Summary

### `v_farm_summary` (MATERIALIZED VIEW)
The dashboard's single most important read. Aggregates seven CTEs — dairy stats, coffee plant/plot stats, harvest stats, small-ruminant stats, poultry batch stats, today's egg count, and pending-alert counts — into one row per farm. Refreshed by trigger (`refresh_farm_summary()`, `REFRESH MATERIALIZED VIEW CONCURRENTLY`) on writes to `farms`, `cows`, `milk_records`, `coffee_plots`, `small_ruminants`, `poultry_batches`, `poultry_egg_records` — see the staleness gap noted in `docs/database/triggers-reference.md` §1 for the tables that feed this view *without* triggering a refresh (`coffee_harvests`, `poultry_mortality`/`feed_records`/`sales`/`health_records`).

Notable computed fields: `enterprise_count` (sums boolean flags for dairy/coffee/sheep_goat/poultry membership in `farm_types`), `effective_tier` (defaults to `'smallholder'` if `subscription_tier` is null), and per-enterprise boolean flags (`has_dairy`, `has_coffee`, `has_small_ruminants`, `has_poultry`) computed by checking `farm_types`. Note the array value checked is `'sheep_goat'`, not `'small_ruminant'` or `'goat'` — worth knowing if writing code elsewhere that needs to test the same membership and shouldn't silently fail to match.

### `v_active_subscriptions`
Derives a live `sub_status` (`active | trial | grace | expired`) and `days_remaining` from `farms.subscription_end_date`/`created_at`, rather than each caller re-implementing the date math. Logic: `active` if `subscription_end_date` is set and in the future; `trial` if no end date *and* the farm is less than 14 days old; `grace` if the end date passed within the last 3 days; everything else is `expired`. **Important for billing code to use this view rather than re-deriving status** — the 14-day trial window and 3-day grace period are encoded only here.

## 2. Dairy & Livestock

### `v_daily_production`
`FULL JOIN` of cattle milk (`milk_records` via `cows`) and goat/sheep milk (`goat_milk_records` via `small_ruminants`) aggregated by `farm_id, record_date`, producing a `grand_total_milk` across both species. Note it joins `goat_milk_records`, **not** `milk_production` — see the naming-trap note in `data-dictionary.md` §6; if goat milk is actually being recorded into `milk_production` instead in some flow, this view would under-report.

### `v_animal_milk_summary`
Per-animal 7-day rolling milk summary for small ruminants only (`small_ruminants` joined to `milk_production` this time — the two goat-milk tables are each the backing source for a *different* view, which is itself worth knowing). Filters to `purpose IN ('dairy','dual') AND status='active'`, ordered by average daily milk descending — this is what backs a "best milkers" leaderboard view if one exists in the UI.

## 3. Coffee Finance & P&L

### `v_season_pnl`
Farm × year × season P&L. Revenue side groups `coffee_harvests` by `produce_type` (cherry vs mbuni — see `data-dictionary.md` §1 for why this split matters) computing `revenue_outstanding = GREATEST(0, expected - received)`. Cost side groups `coffee_activities` **by literal `activity_type` string** (`fertilizer`, `spraying`, `weeding`, `pruning`, `mulching`) — these are the legacy granular values, still correctly populated today because the UI's "Nutrition"/"Crop Protection" relabeling is translated back to `fertilizer`/`spraying` at write time (see `docs/coffee/coffee-module.md` for the exact mapping) — this view did **not** need updating when that UI restructure happened, and shouldn't be "fixed" to filter on `'nutrition'`/`'crop_protection'` literal strings, because the database never stores those values. Computes `margin_pct` and `cost_per_kg`.

### `v_plot_pnl`
Same shape as `v_season_pnl` but grouped by `plot_name` instead of farm-wide — lets a farmer see which specific plot is most profitable. Cost breakdown here is coarser (`spray_costs`, `fertilizer_costs`, and an `other_costs` bucket lumping weeding/pruning/mulching together) than `v_season_pnl`'s finer five-way split.

### `v_payment_tracker`
Per-harvest-delivery payment status with a computed `payment_flag` — the canonical logic for "is this farmer owed money and is it overdue":
```
mbuni  + pending          + >90 days  → payment_overdue
cherry + pending          + >7 days   → advance_overdue
cherry + advance_paid/partial + >90 days → final_overdue
paid                                    → complete
(else)                                  → on_track
```
This is the one place in the schema where the cherry/mbuni payment-timeline difference (§1 of `data-dictionary.md`) is made fully explicit and queryable directly — any UI surfacing "overdue payments" should query this view rather than re-implementing the day-count logic.

### `v_season_cost_summary` / `v_coffee_season_costs`
Two views doing very similar farm/plot × year × `activity_type` cost rollups, differing mainly in grouping granularity (farm-level with per-activity averages vs plot-level) — likely built for different specific UI screens (overall cost trends vs per-plot cost breakdown) rather than one superseding the other.

### `coffee_revenue_summary` / `coffee_cost_summary`
The simplest, oldest-feeling pair in this group — flat farm × year totals with no cherry/mbuni split, no payment-status awareness, no activity-type breakdown. Likely predates `v_season_pnl`/`v_payment_tracker` and may now be superseded by them for anything beyond a basic top-line number; worth checking whether any current UI still queries these two directly versus the richer views before assuming they're load-bearing.

## 4. Coffee Compliance & Health

### `cooperative_eudr_summary`
Farm-level EUDR rollup: total plots/hectares, plot counts by `eudr_risk_level` (low/medium/high), how many have a GPS polygon vs just a point, how many are AFA-verified. Despite the "cooperative" name, it groups by `farm_id`/`farm_name`/`county` — not by `cooperative_id` — so it's really a farm-level EUDR dashboard view that a cooperative officer would query across multiple farms, not a single pre-aggregated cooperative-wide row.

### `v_current_scouting_alerts`
The active pest/disease alert feed: scouting records from the last 30 days (excluding `observation_type = 'healthy'`), left-joined to the matching regional `coffee_disease_thresholds` row, with a computed `status`:
```
action_taken IN (sprayed_immediately, calendar_spray_sufficient)        → resolved
action_taken = scheduled_spray AND ≤3 days since detection              → pending_action
action_taken = scheduled_spray AND >3 days since detection              → overdue
action_taken = none AND threshold_breached                              → action_required
(else)                                                                   → monitoring
```
Ordered by alert severity (`emergency` first), then most recent. This is what should back any "needs attention" pest/disease widget.

### `v_disease_pressure_analytics`
Region × month × year × pest-type detection analytics — counts, threshold breaches, severity distribution, and a computed `avg_days_to_spray` (time between scouting detection and the linked spray activity, via `spray_activity_id`, or `0` if `action_taken = 'sprayed_immediately'`). Useful for regional pest-pressure trend reporting, distinct from `v_current_scouting_alerts`'s per-farm operational alert feed.

## 5. Coffee Satellite & Weather

### `v_plot_latest_satellite`
`DISTINCT ON (plot_id)` pattern to get each plot's single most recent satellite reading, with a computed `data_freshness` (`current` ≤7 days, `recent` ≤14, `stale` ≤30, `very_stale` beyond) — directly drives whatever "last updated" badge appears on the plot health UI.

### `v_plot_ndvi_trend`
90-day NDVI/NDRE/health-score time series per plot with a `row_number()` window function for chart x-axis ordering — feeds an actual trend chart, not a summary table.

### `v_farm_satellite_health`
Farm-level rollup of plot health labels (`good`/`watch`/`stress`/`critical`) using a `LATERAL JOIN ... LIMIT 1` per plot (functionally equivalent to the `DISTINCT ON` pattern above, just written differently) plus a `stale_plots` count for plots whose latest image is >14 days old.

### `v_plot_latest_weather`
Latest weather reading per plot via the same `LATERAL JOIN` pattern, plus **7-day rolling averages of the three computed risk scores** (`avg_cbd_risk_7d`, `avg_clr_risk_7d`, `avg_drought_risk_7d`) using a window function (`AVG(...) OVER (PARTITION BY plot_id ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`) — this is genuinely a 7-row trailing average, not a simple average-of-all-time, so a plot's risk reading reflects recent conditions even on a day with no fresh weather data fetched (it carries forward from the last `LATERAL`-joined row).

## 6. Poultry

### `v_poultry_summary`
Farm-level poultry dashboard rollup — active batch/bird counts by `bird_type` (exact four values, see `data-dictionary.md` §1), today's/7-day-average/month-to-date egg counts, 7-day and 30-day mortality, feed-days-remaining (via `DISTINCT ON` on most recent `poultry_feed_records` entry per farm), and this-month/last-30-days revenue from `poultry_sales`. This is the view `v_farm_summary`'s `poultry_stats` CTE is a *partial* subset of (the materialized view doesn't carry egg/mortality/revenue figures — only batch/bird counts and today's eggs) — for full poultry detail, the dashboard queries this view directly rather than relying on `v_farm_summary` alone.

## 7. Cooperative / Traceability

### `v_passport_chain`
Joins `coffee_passports` → `export_lots` → `cooperatives` into one flat row: passport identity/JSON fields, export shipment details (buyer, grade, EUDR DDS reference, departure date), and cooperative location. This is the query the passport-assembly and public passport API logic reads from — a single-row lookup rather than the app doing three separate joins itself.

## 8. System / Maintenance (Cleanup Candidate Views)

Each of these three is a tiny `SELECT id FROM ... WHERE created_at < now() - interval`, meant to be consumed by a scheduled cleanup job — **none of the three appears to currently be queried by a scheduled job** in this codebase pass (see the maintenance-function note in `docs/database/functions-reference.md` §7 about `cleanup_old_messages()`/`delete_expired_otps()` having the same "defined but not obviously scheduled" issue):

- **`v_error_events_to_delete`** — `error_events` older than 30 days.
- **`v_api_logs_to_delete`** — `api_request_logs` older than 7 days.
- **`v_message_queue_stats`** — *not* a cleanup-candidate view despite being in this category; it's an operational dashboard (`status, count, oldest_message, newest_message, oldest_age_minutes` grouped by `message_queue.status`) — useful for monitoring whether the per-minute pg_cron drain job is keeping up or falling behind.

## 9. Confirmed Not Live

**`v_eudr_assessment_stream`** (defined in `20260428_create_farm_events.sql`) and the five views in `materialized-views.sql` (`v_eudr_summary`, `v_plot_status`, `v_daily_production_new`, `v_compliance_timeline`, `v_active_alerts`) do not exist in the current live database — see `docs/architecture/platform-overview.md` §10 for why.
# Database Triggers Reference

45 triggers live in the `public` schema (complete — `docs_source/triggers.json` returned 52 rows total, well under its 100-row cap, so this list isn't truncated, unlike the functions/policies/indexes exports). Grouped by what they're for, not alphabetically, since the "why" matters more than the trigger name here.

## 1. Materialized View Refresh (`v_farm_summary`)

One trigger per source table, all calling `refresh_farm_summary()` `AFTER INSERT OR UPDATE OR DELETE`:

| Table | Trigger |
|---|---|
| `farms` | `trigger_refresh_farm_summary_farms` |
| `cows` | `trigger_refresh_farm_summary_cows` |
| `milk_records` | `trigger_refresh_farm_summary_milk` |
| `coffee_plots` | `trigger_refresh_farm_summary_coffee` |
| `small_ruminants` | `trigger_refresh_farm_summary_ruminants` |
| `poultry_batches` | `trigger_refresh_farm_summary_poultry_batches` |
| `poultry_egg_records` | `trigger_refresh_farm_summary_poultry_eggs` |

That's exactly seven source tables — every write to any of them triggers a full `REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_farm_summary` (see `docs/database/functions-reference.md` §4 for why `CONCURRENTLY`).

> ⚠️ **Staleness gap worth knowing about**: `coffee_harvests`, `poultry_mortality`, `poultry_feed_records`, `poultry_sales`, and `poultry_health_records` all feed figures *into* `v_farm_summary` (season cherry revenue, feed-days-remaining, mortality counts, etc. — see the view's actual SQL in `views-reference.md`) but **do not themselves have a refresh trigger**. In practice the dashboard summary for these figures only becomes current again after *some other* trigger-bearing table is written to (e.g. logging a new harvest won't update `season_coffee_revenue_kes` on the dashboard until the next time someone also touches `cows`, `coffee_plots`, etc.). This is very likely an oversight from when poultry/coffee-harvest fields were added to the view after the original trigger set was written, not a deliberate design choice — worth adding the missing five triggers if dashboard staleness on these specific figures has ever been reported.

## 2. Generic `updated_at` Stamping

`BEFORE UPDATE`, sets `NEW.updated_at = now()`. Five different (functionally identical) backing functions are in use — see `docs/database/functions-reference.md` §6 for the consolidation note:

| Table | Trigger | Function |
|---|---|---|
| `coffee_activities` | `update_coffee_activities_updated_at` | `update_updated_at_column()` |
| `coffee_disease_thresholds` | `update_coffee_disease_thresholds_updated_at` | `update_updated_at_column()` |
| `coffee_pest_library` | `update_coffee_pest_library_updated_at` | `update_updated_at_column()` |
| `coffee_plants` | `update_coffee_plants_updated_at` | `update_updated_at_column()` |
| `coffee_plots` | `update_coffee_plots_updated_at` | `update_updated_at_column()` |
| `coffee_scouting_records` | `update_coffee_scouting_records_updated_at` | `update_updated_at_column()` |
| `cows` | `update_cows_updated_at` | `update_updated_at_column()` |
| `farms` | `update_farms_updated_at` | `update_updated_at_column()` |
| `small_ruminants` | `update_small_ruminants_updated_at` | `update_updated_at_column()` |
| `coffee_eudr_compliance` | `trg_coffee_eudr_compliance_updated_at` | `update_coffee_eudr_compliance_updated_at()` |
| `milk_production` | `milk_production_updated_at` | `update_milk_production_updated_at()` |
| `poultry_batches` | `trg_poultry_batches_updated_at` | `set_poultry_batch_updated_at()` |
| `farms` | `trg_farms_updated_at` | `set_updated_at()` |
| `transactions` | `trg_transactions_updated_at` | `set_updated_at()` |
| `coffee_passports` | `set_updated_at_coffee_passports` | `set_updated_at()` |
| `export_lots` | `set_updated_at_export_lots` | `set_updated_at()` |
| `mill_lots` | `set_updated_at_mill_lots` | `set_updated_at()` |
| `processing_batches` | `set_updated_at_processing_batches` | `set_updated_at()` |

> Note **`farms` has two separate `updated_at` triggers** (`trg_farms_updated_at` → `set_updated_at()`, and `update_farms_updated_at` → `update_updated_at_column()`), both `BEFORE UPDATE`, both doing the exact same thing. Harmless (idempotent — both just set the same timestamp to `now()` in the same statement), but it's a duplicate that should be cleaned up to avoid confusion the next time someone debugs an `updated_at` issue on `farms` and finds two triggers instead of one.

## 3. Cross-Farm Integrity Guards

`BEFORE INSERT OR UPDATE`, raise an exception rather than silently allow a cross-tenant parent/child reference. Full business-rule explanation (exact error messages, practical implications for forms/agents) is in `docs/database/data-dictionary.md` §3 — this is just the trigger inventory:

| Table | Trigger | Function | Guards |
|---|---|---|---|
| `calving_records` | `trg_calf_same_farm` | `enforce_calf_same_farm()` | `calf_id` must share `cow_id`'s farm |
| `cows` | `trg_cow_parents_same_farm` | `enforce_cow_parents_same_farm()` | `dam_id`/`sire_id` must share the row's own `farm_id` |
| `small_ruminants` | `trg_ruminant_parents_same_farm` | `enforce_ruminant_parents_same_farm()` | same pattern, goat/sheep |

## 4. Append-Only Enforcement (Rules, Not Triggers — Noted Here For Completeness)

`traceability_events` blocks UPDATE and DELETE via `CREATE RULE ... DO INSTEAD NOTHING`, which is a different Postgres mechanism from a trigger (rules rewrite the query at parse time; triggers fire per-row at execution time) and so **does not appear in this trigger inventory or in `docs_source/triggers.json`** — it would only show up in a query against `pg_rewrite`/`pg_rules`. Documented in full in `docs/architecture/traceability-architecture.md` §3; flagged here so its absence from this list isn't mistaken for the ledger being mutable.

## 5. What's Notably *Absent*

- **No `updated_at` trigger on `coffee_harvests`, `coffee_financials`, `financial_records`, `breeding_events`, `calving_records`, `health_records`, `vet_visits`, or most of the poultry/small-ruminant child tables** (`poultry_egg_records`, `poultry_feed_records`, `poultry_mortality`, `poultry_sales`, `poultry_health_records`, `goat_milk_records`, `small_ruminant_*`, `weight_records`, `kidding_lambing_records`). These tables either don't have an `updated_at` column at all (many of the child/event-style tables are insert-only by nature — a milk record for a given day isn't typically edited after the fact), or have one that simply never gets bumped on UPDATE. Worth checking before relying on `updated_at` for "last modified" sorting/display on any of these.
- **No trigger validates `coffee_harvests.harvest_year`/`harvest_season` against `harvest_date`**, or `coffee_activities.total_cost` against `cost_labour + cost_inputs` at the trigger level — the latter has a `CHECK` constraint instead (`20260625_coffee_activities_total_cost_check.sql`, added `NOT VALID`), the former has nothing at all. See `docs/database/data-dictionary.md` §2 for the practical risk this creates.
- **No `ON DELETE` cascade-style trigger for `farm_managers`** when a `farms` row is deleted, or vice versa — relies entirely on whatever `ON DELETE` foreign-key behavior is set at the constraint level (not all of which were captured with their delete-action in this pass; worth a direct check on any FK where orphaned-row risk matters, e.g. deleting a cooperative).
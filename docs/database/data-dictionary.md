# Data Dictionary

This document covers what `schema-reference.md` doesn't: the *business meaning* of fields, which text columns are really enums (and what values they actually take), which fields are denormalized and must be kept in sync by application code, and naming traps that look obvious but aren't. Most of this was distilled from actual view/trigger logic, not guessed from column names — each claim below points at the specific view or trigger that depends on it.

## 1. Enum-Like Text Columns

Postgres stores all of these as plain `text`, not real `enum` types — nothing stops an invalid value at the column level. Validation has to happen in application code, or implicitly via what the views/triggers branch on.

### `coffee_harvests`
- **`produce_type`** (default `'cherry'`): `'cherry'` | `'mbuni'`. This single field drives materially different payment-tracking logic downstream: `v_payment_tracker`, `v_season_pnl`, and `v_plot_pnl` all branch on it because cherry and mbuni have *different overdue windows* — cherry expects an advance payment within 7 days, mbuni expects final payment within 90 days. Getting this field wrong on insert doesn't just mis-categorize a delivery, it silently changes when the farmer's payment is flagged overdue.
- **`payment_status`** (default `'pending'`): `'pending'` | `'advance_paid'` | `'partial'` | `'paid'`. Computed `v_payment_tracker.payment_flag` and the deliveries breakdown in `v_season_pnl` both branch on this.
- **`processing_method`** (default `'Wet/Washed'`): free text in the column definition, but `'Wet/Washed'` is the only value the current UI ever produces.

### `cows`
- **`status`** (default `'active'`): `'active'` | exited states. When `status != 'active'`, check `exit_date`/`exit_reason` together — they're paired, not independent.
- **`purpose`** (default `'dairy'`): `v_farm_summary`'s `producing_cows` count filters on `status='active' AND purpose='dairy'` specifically — a beef-purpose active cow won't count toward that figure.

### `small_ruminants`
- **`status`** (default `'active'`): same exited-state pairing as `cows.status`.
- **`species`**: `'goat'` | `'sheep'` — `v_farm_summary` breaks totals out by this directly (`total_goats`, `total_sheep`).
- **`purpose`**: `'dairy'` | `'dual'` | meat-only (implied, no explicit third value seen). `v_animal_milk_summary` filters `purpose IN ('dairy','dual')` — a meat-purpose animal is excluded from milk reporting even if someone records milk for it.
- **`sex`**: `'male'` | `'female'` — referenced by `v_farm_summary.female_ruminants`.

### `poultry_batches`
- **`bird_type`**: exactly `'layer'` | `'broiler'` | `'kienyeji'` | `'dual_purpose'`. **This is a sharp edge**: every poultry view (`v_poultry_summary`, the poultry block of `v_farm_summary`) branches on these four literal strings via `FILTER (WHERE bird_type = '...')`. A fifth value — even a reasonable one, like `'turkey'` — wouldn't error, it would just silently fall through every filter and undercount totals with no error anywhere in the pipeline.
- **`status`** (default `'active'`): paired with `closed_date` when not active.

### `processing_batches` / `mill_lots` / `export_lots`
These three have proper `CHECK` constraints (not just convention), so invalid values *do* fail loudly here, unlike the tables above:
- `processing_batches.status`: `intake | pulping | fermenting | washing | drying | milled | exported | closed`
- `mill_lots.status`: `pending | milled | graded | auctioned | sold | exported`
- `export_lots.status`: `pending | confirmed | shipped | arrived | completed`
- `coffee_passports.status`: `draft | published | archived` — the public-read RLS policy on `coffee_passports` checks specifically for `'published'`, so a typo here (e.g. `'publish'`) wouldn't error on write but would make the passport silently invisible to the public API.

### Computed, not stored
`v_payment_tracker.payment_flag`: `'payment_overdue'` | `'advance_overdue'` | `'final_overdue'` | `'complete'` | `'on_track'` — useful to know if you're filtering on this view directly in app code, since it doesn't exist as a column anywhere.

## 2. Denormalized Fields That Must Stay In Sync

### `coffee_harvests.harvest_year` / `harvest_season`
Both are **stored columns**, not generated from `harvest_date`, even though they conceptually derive from it. `v_season_pnl`, `v_plot_pnl`, and `coffee_revenue_summary` all `GROUP BY` these stored columns directly — not `EXTRACT(year FROM harvest_date)`. There is no trigger or constraint that backfills or validates consistency. **Practical implication**: if application code inserts a `harvest_date` without setting matching `harvest_year`/`harvest_season`, that harvest becomes invisible to every season-based P&L view, or appears under the wrong season, with no error anywhere.

### `coffee_harvests.produce_kg` vs `cherry_kg`
Both are `NOT NULL numeric`. Every view computes the effective quantity as `COALESCE(produce_kg, cherry_kg)` — `cherry_kg` is the legacy column, `produce_kg` the current one. New inserts should populate both (or at minimum `produce_kg`, with `cherry_kg` set to a sane value like 0 or a duplicate figure) — leaving `cherry_kg` at some stale default while only writing `produce_kg` won't break the COALESCE-based views, but will break any older code path still reading `cherry_kg` directly.

### `coffee_activities` cost fields
`total_cost`, `cost_labour`, `cost_inputs` are three independent nullable numeric columns — **`total_cost` is not a generated sum**, just convention. The client (`ActivityRecordClient.tsx`) computes `total_cost = cost_labour + cost_inputs` at entry time, and a `CHECK` constraint added in `20260625_coffee_activities_total_cost_check.sql` now enforces `ABS(total_cost - (cost_labour + cost_inputs)) < 0.01` for new/updated rows going forward (added `NOT VALID`, so pre-existing rows aren't retroactively checked unless someone runs the follow-up `VALIDATE CONSTRAINT` — worth checking whether that's been run). `v_season_pnl.activity_costs` sums `total_cost` for the headline figure but separately sums `cost_labour`/`cost_inputs` for the breakdown — these will only reconcile if the constraint holds.

### `coffee_plots.eudr_risk_level` vs `coffee_eudr_compliance.risk_level`
`coffee_eudr_compliance` is the authoritative, append-and-upsert EUDR record per plot. `coffee_plots` carries its own denormalized `eudr_risk_level`/`eudr_risk_assessed_at`/`eudr_risk_details` columns, written by the same `check-eudr-risk` edge function in the same pass, purely to support legacy reads on the plot-detail page without an extra join. If a future code path writes to `coffee_eudr_compliance` directly (bypassing the edge function), `coffee_plots`'s copy will go stale silently.

## 3. Cross-Farm Write Constraints (Enforced by Triggers, Not Column Types)

These succeed silently for valid same-farm data and **raise a Postgres exception** for cross-tenant references — there's no column-level constraint that would catch this earlier, so a generic "INSERT failed" 500 is what the API would otherwise return without specific handling.

- **`calving_records`** — `trg_calf_same_farm` (BEFORE INSERT/UPDATE): if `calf_id` is set, it must reference a `cows` row sharing the same `farm_id` as the row referenced by `cow_id`. Raises `'calf_id must belong to the same farm as cow_id'`.
- **`cows`** — `trg_cow_parents_same_farm` (BEFORE INSERT/UPDATE): if `dam_id`/`sire_id` is set, each must reference a same-farm `cows` row. Raises `'dam_id must belong to the same farm'` / `'sire_id must belong to the same farm'`. On UPDATE, only re-checks if `dam_id`/`sire_id`/`farm_id` actually changed (not on every unrelated column update).
- **`small_ruminants`** — `trg_ruminant_parents_same_farm` (BEFORE INSERT/UPDATE): identical pattern, scoped to `small_ruminants.dam_id`/`sire_id`.

**Implication for any form, bulk-import tool, or AI-agent flow** that lets a user pick a calf/dam/sire: the candidate list should already be scoped to the current farm by the query (RLS will do this automatically for a SELECT), but if something constructs an INSERT/UPDATE directly from external input — e.g. a WhatsApp message parser matching an animal by ear-tag text across what it thinks is "the farm" — it must filter candidates by `farm_id` *before* attempting the write, or the trigger will reject it.

## 4. RLS Helper Function Reference

Three helper functions gate almost all row-level security in this schema. None are redefined per-table — every policy that uses one references the same shared function. (Full policy-by-policy detail is in `docs/database/rls-policies.md`; this is just the "which helper applies to which table shape" cheat sheet.)

- **`can_manage_farm(p_farm_id uuid)`** — for tables that carry their own `farm_id` column directly (`coffee_harvests`, `coffee_activities`, `small_ruminants`, `cows`, `poultry_batches`, `alerts`, `financial_records`, etc.). Resolves `farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())` **OR** "is a cooperative officer for the cooperative this farm is `managed_by_coop_id`-linked to."
- **`can_manage_farm_by_cow_id(p_cow_id uuid)`** — for tables that reference a cow but don't store `farm_id` themselves (`milk_records`, `health_records`, `vet_visits`, `calving_records`, `breeding_events`, `calves`). Joins through `cows.farm_id`.
- **`can_manage_farm_by_small_ruminant_id(p_animal_id uuid)`** — same pattern for small-ruminant-linked tables (`goat_milk_records`, `small_ruminant_health`, `weight_records`, `small_ruminant_sales`, `small_ruminant_breeding`, `kidding_lambing_records`).

**Implication for schema changes**: a new table that references `cow_id` or `animal_id` without its own `farm_id` column needs one of the `*_by_*_id` helpers — applying a plain `can_manage_farm(farm_id)` policy to such a table would either fail outright (no `farm_id` column to reference) or silently deny all access (if someone works around it by passing a `null`/wrong value).

## 5. Tables With No RLS (Intentional, Not an Oversight)

Don't "fix" these by adding `farm_id`-scoped policies — they don't carry tenant data:

- `counties`, `constituencies`, `wards` — GIS/administrative reference lookups.
- `coffee_pest_library`, `coffee_calendar_regions` — shared agronomic reference data, no RLS at all (publicly readable by omission, not by an explicit `USING (true)` policy).
- `coffee_disease_thresholds` — reference data, but *does* have one explicit `SELECT: true` policy, functionally equivalent to no RLS but written defensively.
- `message_queue`, `message_results` — service-role only (WhatsApp bot infrastructure; `message_queue` has `SELECT/UPDATE: true` for the queue worker, not farm-scoped).
- `phone_otp_codes` — anon-role read/write by design, for the pre-authentication OTP flow.
- `auth_phone_salts` — RLS enabled but zero policies (stricter than "no RLS": not even a permissive default, just nothing — service-role only).

## 6. Naming Traps

### `milk_production` vs `milk_records` — these are NOT both cattle tables
`milk_records` is the cattle milk table (`cow_id → cows.id`). **`milk_production`, despite its generic name, is a small-ruminant (goat/sheep) table** — its only animal FK is `animal_id → small_ruminants.id`. To make this more confusing, `goat_milk_records` *also* exists, with a near-identical column shape to `milk_production`, also FK'd to `small_ruminants.id`. There appear to be two parallel goat/sheep milk tables live simultaneously. Before writing new goat/sheep milk-recording code, check which of the two the relevant dashboard page (`app/dashboard/smallRuminants/milk/`) actually writes to — don't assume `milk_production` is the cattle table just because the name is generic, and don't write to both expecting them to be kept in sync (nothing keeps them in sync if they are in fact two independent tables).

### `calves` vs `calving_records` — likely two generations of the same concept
Both exist, both link to `cows`. `calves` looks like the older/parallel table: `dam_id`, `sire_code` as free text, `weaning_date`/`weaning_weight`. `calving_records` looks like the newer, more structured version: FK to `breeding_events`, `calf_vigor`, `delivery_type` fields. **Confirm which one is the source of truth before writing to either** — writing to both for the same calving event risks double-counting in any future "total calves born" aggregation, and neither table currently has a trigger or constraint preventing that duplication.

### `small_ruminant_breeding` / `kidding_lambing_records` vs `breeding_events` / `calving_records`
These are the goat/sheep equivalents of the cattle reproduction tables, but use different field naming (`dam_id`/`sire_id`/`kid_lamb_id` rather than `cow_id`/`calf_id`). Anyone building cross-species reproduction reporting (or an AI agent translating between the two) needs to map these field names explicitly — there's no shared view or abstraction layer doing this today.

### `coffee_inputs` vs `coffee_activities`
Both record input/labour application to coffee plots, with overlapping fields (`fertilizer_type`, `labor_cost`/`cost_labour`, `quantity`). `coffee_activities` is clearly the current, actively-developed table (it has the most recent migrations — the Nutrition/Crop Protection restructure, the total_cost CHECK constraint — and the dedicated dashboard sub-navigation). `coffee_inputs` looks like an earlier, narrower table that may predate that restructure. Treat `coffee_activities` as authoritative for new feature work unless you find a current UI path that still writes to `coffee_inputs`.

### `coffee_health_records` vs `coffee_scouting_records` (and the now-gone `coffee_diseases`)
Three generations of the same underlying need (record a pest/disease observation), only one of them current. `coffee_diseases` (from an early migration) is **not in the live schema at all** — superseded. `coffee_health_records` (AI-diagnosis fields, photo URLs) looks like the second generation. `coffee_scouting_records` (threshold-breach flags, severity levels, linkage to a specific spray activity via `spray_activity_id`, and joined against `coffee_disease_thresholds` in `v_current_scouting_alerts`/`v_disease_pressure_analytics`) is the current, most actively-used model — it's the one the live dashboard alerting views are built on.

## 7. Where the "Source of Truth" Genuinely Splits by Tenant Type

A handful of fields exist on `farms` specifically to support the cooperative-managed model, and are meaningless/always-default for an individually-owned farm:

- `managed_by_coop_id`, `coop_factory_id` — null for individually-owned farms.
- `is_coop_managed` — `false` by default; `true` for cooperative-pre-mapped farms.
- `claim_token` — unique, non-null only while a cooperative-mapped farm is awaiting claim by its real owner; set back to `null` the moment the farm is claimed (see `claim_cooperative_farm` in `docs/database/functions-reference.md`).

A farm can transition `is_coop_managed=true, claim_token=<set>` → `claim_token=null` (claimed) over its lifetime, but once claimed it stays `is_coop_managed=true` permanently — claiming attaches an owner, it doesn't detach the farm from the cooperative.
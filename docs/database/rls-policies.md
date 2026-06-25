# Row-Level Security Policies

RLS is the actual enforcement layer in this schema — most API routes pass the user's JWT straight through to PostgREST/Supabase and rely on RLS rather than duplicating authorization logic in TypeScript. This document covers the *patterns* policies follow across the schema; for the literal policy list per table, see the **RLS** line in each table's entry in `docs/database/schema-reference.md`.

> **Coverage note**: the live policy export (`docs_source/policies.json`) is capped at 100 rows by the export tool and the cut lands alphabetically mid-schema (covers tables through `feed_records`; everything from `financial_records` onward, alphabetically, isn't in that raw export). This document's per-table detail in `schema-reference.md` doesn't depend on that truncated export, though — it draws from `lib/schemaframedInsight.md` (a fuller internal reference covering all 60 pre-cooperative tables' policies) plus the cooperative/passport-platform migrations read directly for the 13 newer tables. The only tables whose RLS wasn't independently confirmed from either source are `factory_intake_lots` and `lot_farmer_deliveries` (see the note in `schema-reference.md`'s header) — worth a direct check on those two specifically.

## 1. The Three Helper-Function Patterns

Covered in depth in `docs/database/data-dictionary.md` §4 and `docs/database/functions-reference.md` §1 — summarized here as the dominant pattern:

| Helper | Used by tables shaped like | Cooperative-officer access included? |
|---|---|---|
| `can_manage_farm(farm_id)` | Tables with their own `farm_id` column | **Yes** — ORs in cooperative-officer access via `farms.managed_by_coop_id` |
| `can_manage_farm_by_cow_id(cow_id)` | Tables joined through `cows.id` | **No** — only checks `farm_managers` directly |
| `can_manage_farm_by_small_ruminant_id(animal_id)` | Tables joined through `small_ruminants.id` | **No** — same limitation |

This asymmetry is worth restating here because it's easy to assume cooperative officers have uniform access across a farm's data when they don't: a coffee cooperative's officer can manage a member farm's `coffee_plots`/`coffee_harvests`/etc. (direct `farm_id`, via `can_manage_farm`), but if that same farm also runs dairy, the officer **cannot** see its `milk_records`, `health_records`, `breeding_events`, `calving_records`, `calves`, or `vet_visits` — those tables' RLS doesn't check the cooperative path at all. Whether this is a deliberate scope decision (cooperatives in this codebase are coffee-focused) or an oversight from when the cooperative model was added after these tables already existed isn't something this pass could determine from the code alone — flagging as a question for the maintainer rather than asserting either way.

## 2. Direct-Inline-Subquery Pattern (Pre-Dates the Helper Functions)

A second, older pattern shows up especially on tables touched early in the project's history: instead of calling `can_manage_farm(farm_id)`, the policy inlines the same logic directly:
```sql
farm_id IN (SELECT farm_managers.farm_id FROM farm_managers WHERE farm_managers.user_id = auth.uid())
```
This is functionally almost identical to `can_manage_farm` **except it omits the cooperative-officer OR-branch** — it only ever grants access via direct `farm_managers` membership. Tables observed with this inline pattern *instead of* (or *stacked alongside*) the helper function include `coffee_harvests`, `coffee_eudr_compliance`, `milk_production`, `farm_managers` itself (its own RLS, naturally, can't call a function that queries itself in the same way), and the poultry tables (see §3 below). On tables where this inline pattern is the **only** policy (not stacked with `can_manage_farm`), a cooperative officer would be silently denied access even though the table has a `farm_id` column that *could* support cooperative access — worth checking case-by-case against the helper-function table in `schema-reference.md` if cooperative access to a specific enterprise table seems to be missing in testing.

## 3. Stacked/Duplicate Policies (Poultry Tables Specifically)

Every poultry RLS policy added in `20260610_add_poultry_rls.sql` follows a consistent **double-policy** pattern — for example, `poultry_batches` has two separate `FOR ALL` policies covering the same `DELETE/INSERT/SELECT/UPDATE` commands:
```sql
-- Policy 1
USING (farm_id IN (SELECT farm_managers.farm_id FROM farm_managers WHERE farm_managers.user_id = auth.uid()))
-- Policy 2
USING (EXISTS (SELECT 1 FROM farm_managers fm WHERE fm.farm_id = poultry_batches.farm_id AND fm.user_id = auth.uid()))
```
These two are logically equivalent — an `IN (subquery)` and an `EXISTS` correlated subquery checking the exact same condition. Postgres RLS ORs multiple permissive policies together for the same command, so this isn't a security bug (access is still correctly farm-scoped), but it means **every poultry query evaluates two redundant policy checks** instead of one. This pattern repeats identically across `poultry_batches`, `poultry_egg_records`, `poultry_feed_records`, `poultry_health_records`, `poultry_mortality`, and `poultry_sales`. It reads like the migration was written by layering a new policy on top of an existing one without removing the original — worth a cleanup pass (`DROP POLICY` on one of each pair) the next time any of these tables' RLS is touched, purely for query-planner tidiness rather than correctness.

## 4. Service-Role Bypass Pattern

Several tables have an explicit `ALL: (auth.role() = 'service_role'::text)` policy *in addition to* user-facing policies — this is what lets server-side code using the Supabase service-role key (cron jobs, webhooks, edge functions) write to these tables regardless of the per-user policies:

`farm_managers`, `farms`, `transactions`, `audit_logs`, `coffee_satellite_indices`, `coffee_plot_weather`. This is the correct pattern for tables that need both user-facing RLS *and* trusted backend write access (e.g. the M-Pesa webhook writing to `transactions`, or the satellite-fetch edge function writing to `coffee_satellite_indices`) — it is **not** the same as having no RLS; the service-role key itself is a secret that must be protected, since it bypasses RLS entirely by design across the whole database, not just on these tables specifically.

## 5. Public-Read Patterns (No Auth Required)

A small, deliberate set of tables/rows are readable without any authentication:

| Table | Public read condition |
|---|---|
| `coffee_passports` | `status = 'published'` only — draft/archived passports stay private to cooperative officers |
| `coffee_disease_thresholds` | unconditional (`SELECT: true`) |
| `phone_otp_codes` | unconditional, anon role — necessary for the pre-authentication OTP flow itself |
| `newsletter_subscribers` | `INSERT: true` (anyone can subscribe) but `SELECT: auth.uid() = id` (can't browse other subscribers) |
| `message_queue` | `SELECT/UPDATE: true` — not actually "public" in the product sense, this is the queue-worker access pattern, scoped only by the fact that nothing sensitive should be readable by an anon key holder who happens to query this table |

`coffee_pest_library` and `coffee_calendar_regions` have **no RLS at all** (not even an explicit `true` policy) — functionally public-read by omission, since RLS-disabled tables are visible to anyone who can query the schema. See `data-dictionary.md` §5 for the full "tables with no RLS, intentionally" list.

## 6. Cooperative-Officer `FOR ALL` Pattern (Passport Platform Tables)

Every table in the coffee-traceability chain added by `20260624_coffee_passport_platform.sql` follows one consistent shape: cooperative officers get `FOR ALL` access scoped through a join back to `cooperative_officers`, with **no fallback to individual `farm_managers` access at all** — these tables are cooperative-tier resources, not farm-tier ones, so that's the correct scoping, but it's a structurally different pattern from every other table in the schema (which scope through `farm_managers`, optionally OR'd with cooperative access). Two shapes appear depending on whether the table carries `cooperative_id` directly or has to join through a parent table to find it:

```sql
-- Direct cooperative_id column (processing_batches, mill_lots, export_lots, coffee_passports, traceability_events)
USING (EXISTS (SELECT 1 FROM cooperative_officers WHERE cooperative_id = <table>.cooperative_id AND user_id = auth.uid()))

-- Join through a parent table (mill_lot_batches → mill_lots, export_lot_mill_lots → export_lots)
USING (EXISTS (
  SELECT 1 FROM mill_lots ml JOIN cooperative_officers co ON co.cooperative_id = ml.cooperative_id
  WHERE ml.id = mill_lot_batches.mill_lot_id AND co.user_id = auth.uid()
))
```

`coffee_passports` additionally has the public-read policy from §5, stacked alongside its officer-management policy — two different policies for two entirely different audiences on the same table (officers managing it vs. the world reading published ones).

`traceability_events` has no UPDATE/DELETE policy of any kind, by design — not because access is denied via RLS, but because the table-level rules described in `docs/architecture/traceability-architecture.md` §3 make UPDATE/DELETE no-ops regardless of any policy. An RLS policy permitting UPDATE would still never actually let anyone update a row.

## 7. `cooperative_officers` Write Access — A Real Tightening, Worth Knowing the History Of

`cooperative_officers` originally had **no INSERT policy at all** beyond what the `SECURITY DEFINER` signup RPCs (`create_cooperative_with_officer`) could do — meaning the *only* way to add an officer was through that RPC (which always assigns `role = 'admin'` to the cooperative's very first officer). `20260625_cooperative_officers_insert_policy.sql` added an explicit policy letting **existing officers with `role = 'admin'`** insert additional officer rows for their own cooperative:
```sql
WITH CHECK (EXISTS (
  SELECT 1 FROM cooperative_officers existing
  WHERE existing.cooperative_id = cooperative_officers.cooperative_id
  AND existing.user_id = auth.uid() AND existing.role = 'admin'
))
```
This is what makes "an admin officer invites a regular field officer" possible directly via the API rather than needing another RPC — but it also means a cooperative with zero admin-role officers (shouldn't normally happen, since the founding officer is always `admin`, but could occur if someone manually demotes the last admin) would have no path to add new officers except direct database access. Worth keeping in mind if building any "manage officers" UI — it should probably prevent a cooperative's last `admin` from demoting themselves.

## 8. What This Means for New Tables

When adding a new table that needs farm-level scoping, prefer `can_manage_farm(farm_id)` (or one of its `*_by_*_id` siblings, matching the table's actual FK shape — see `data-dictionary.md` §4) over inlining a fresh subquery, both for the cooperative-access OR-branch it gives "for free" on `can_manage_farm`, and to avoid contributing another instance of the duplicate-policy pattern in §3. If the new table is part of the cooperative supply-chain domain instead (joins to `cooperative_id`, not `farm_id`), follow the §6 pattern instead — don't try to force a `farm_id`-shaped table into representing a blended, cooperative-owned resource.
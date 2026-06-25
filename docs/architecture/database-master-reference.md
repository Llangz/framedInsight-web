# Database Master Reference

This is the single-page map of the `public` schema: every domain, what tables live in it, and how the domains connect. For column-level detail see `docs/database/schema-reference.md` and `docs/database/data-dictionary.md`. For the live database export this was built from, see `docs_source/schema_tables.md` (73 tables in `public`, confirmed against the live project — this count and table list is complete, unlike some of the other `docs_source/*.json` exports, which were capped at 100 rows by the export tool and are noted as truncated where relevant).

## 1. Domain Map

```
                              ┌───────────────┐
                              │ cooperatives  │
                              └───────┬───────┘
                       ┌──────────────┼───────────────┐
              ┌────────▼──────┐ ┌─────▼──────────┐ ┌───▼────────────────┐
              │ coop_factories│ │cooperative_     │ │ farms                │
              │               │ │officers         │ │ (managed_by_coop_id) │
              └───────┬───────┘ └─────────────────┘ └──────────┬──────────┘
                      │                                         │
        ┌─────────────┼─────────────────────────────────────────┼───────────────┐
        │             │                                         │ farm_managers │
        ▼             ▼                                         ▼ (user↔farm)  │
┌───────────────┐ ┌─────────────────┐                  ┌──────────────────────┐
│factory_intake_ │ │ farm_type_      │                  │  Enterprise tables    │
│lots            │ │ configs         │                  │  (see §3)             │
└──────┬─────────┘ └─────────────────┘                  └──────────────────────┘
       │
       ▼
┌─────────────────┐     ┌───────────┐     ┌────────────┐     ┌──────────────────┐
│lot_farmer_       │ →   │processing_│ →   │ mill_lots  │ →   │ export_lots       │
│deliveries        │     │batches    │     │            │     │                   │
└──────────────────┘     └───────────┘     └────────────┘     └────────┬──────────┘
                                                                         ▼
                                                                ┌──────────────────┐
                                                                │ coffee_passports  │
                                                                └──────────────────┘
        all of the above also write to → traceability_events (immutable ledger)
```

## 2. Identity & Access Domain

| Table | Responsibility |
|---|---|
| `farm_managers` | The core ownership join: `(user_id, farm_id, role)`. No `farm_id` column exists on this table itself in a denormalized sense — it *is* the denormalized link. |
| `cooperative_officers` | Join between `auth.users` and `cooperatives`, with `role` (`admin` \| `officer`) and (added later) `email`. |
| `auth_phone_salts` | Service-role-only table holding the salt used to derive each phone number's "ghost password" for bridging phone-OTP auth into Supabase's email/password-native Auth system. No RLS policies at all — deliberately. |
| `phone_otp_codes` | Transient OTP codes, one row per phone number (unique constraint), 15-minute expiry. |
| `rate_limits` | Generic per-user/per-endpoint rate limiting (`user_id`, `farm_id`, `endpoint`, `request_count`, `reset_at`). |
| `audit_logs` | Service-role-written audit trail of sensitive actions (`action`, `actor_id`, `resource`, `details jsonb`). |

**Two ownership paths, ORed together by RLS**: a user manages a farm if they have a `farm_managers` row for it, *or* if they're a `cooperative_officers` row for the cooperative the farm's `managed_by_coop_id` points to. See `docs/database/rls-policies.md` §"can_manage_farm".

## 3. Farm & Enterprise Domain

`farms` is the central tenant row. Every enterprise table below carries its own `farm_id`, except where noted as "indirect" (joins through an animal/cow/plot id instead — this matters for which RLS helper function applies; see `docs/database/rls-policies.md`).

| Enterprise | Direct-`farm_id` tables | Indirect tables (join through animal/plot id) |
|---|---|---|
| Coffee | `coffee_plots`, `coffee_activities`, `coffee_harvests`, `coffee_health_records`, `coffee_inputs`, `coffee_eudr_compliance`, `coffee_scouting_records`, `coffee_satellite_indices`, `coffee_financials` | `coffee_quality_records` (→ `coffee_harvests.id`), `coffee_plants` *(carries its own `farm_id` too)*, `coffee_plot_weather` / `coffee_satellite_fetch_log` (→ `coffee_plots.id`) |
| Dairy (cattle) | `cows`, `financial_records` | `milk_records`, `health_records`, `breeding_events`, `calving_records`, `calves`, `vet_visits` (all → `cows.id`) |
| Poultry | `poultry_batches`, `poultry_health_records`, `poultry_feed_records`, `poultry_mortality` *(also carries `farm_id` directly alongside `batch_id`)* | `poultry_egg_records`, `poultry_sales` (→ `poultry_batches.id`) |
| Small ruminants | `small_ruminants` | `goat_milk_records`, `milk_production`, `small_ruminant_health`, `small_ruminant_breeding`, `small_ruminant_sales`, `weight_records`, `kidding_lambing_records` (all → `small_ruminants.id`) |
| Cross-enterprise reference | `farm_type_configs` (per-farm, per-enterprise UX settings: units, language, alert channels), `alerts`, `ai_predictions`, `business_events`, `feed_records` (generic, pre-dates the poultry-specific `poultry_feed_records`) | — |

> **Naming trap to know about**: `milk_production` looks like it should be the dairy-cattle milk table, but its only animal FK is `animal_id → small_ruminants.id` — it's the **goat/sheep** milk table (used alongside, or possibly superseding, `goat_milk_records`; both exist live with near-identical shapes). The cattle milk table is `milk_records` (FK to `cows.id`). Don't assume table names map 1:1 to enterprise the way they read.

## 4. Coffee Traceability Domain (cooperative-scale supply chain)

Added in `20260624_coffee_passport_platform.sql`, this is the most structurally distinct part of the schema — it models a physical supply chain (cherries → wet mill → dry mill → exporter → consumer), not just farm records:

```
lot_farmer_deliveries  →  processing_batches  →  mill_lot_batches (join)  →  mill_lots  →  export_lot_mill_lots (join)  →  export_lots  →  coffee_passports
        ▲                                                                                                                         │
        └── factory_intake_lots                                                                                  traceability_events (append-only, hash-chained)
```

Every table in this chain carries `cooperative_id` directly (not just `farm_id`), because ownership here is at the cooperative/factory level, not the individual farmer level — a `coffee_passport` represents a *blended lot* from potentially hundreds of farmers, not one farm's harvest. See `docs/coffee/coffee-passports.md` and `docs/architecture/traceability-architecture.md` for the full mechanics.

## 5. EUDR Compliance Domain

`coffee_eudr_compliance` is the authoritative per-plot compliance record (`risk_level`, `deforestation_risk`, `forest_cover_pct`, `compliance_status`, `evidence_photos`), populated by the `check-eudr-risk` edge function querying Global Forest Watch's Hansen tree-cover-loss dataset. `coffee_plots` carries a denormalized copy (`eudr_risk_level`, `eudr_risk_assessed_at`, `eudr_risk_details`) for legacy reads on the plot-detail page — the edge function writes both. See `docs/coffee/eudr-module.md`.

## 6. Reference / Lookup Domain

Static or near-static data with no farm scoping:

- `counties`, `constituencies`, `wards` — Kenya's administrative hierarchy (used for farm address fields and dropdowns; backed by a shapefile in `lib/Kenya_Wards/`).
- `coffee_pest_library`, `coffee_disease_thresholds`, `coffee_calendar_regions` — shared agronomic reference data, mostly public-readable.

## 7. Operational / Infrastructure Domain

- `message_queue` / `message_results` — inbound WhatsApp message buffer and the AI intent-parser's output, drained every minute by pg_cron (see `docs/architecture/platform-overview.md` §8).
- `whatsapp_messages` — the conversational log itself (separate from the processing queue).
- `transactions` — M-Pesa Daraja STK Push payment records.
- `api_request_logs`, `error_events`, `business_events` — observability tables, each with a matching `v_*_to_delete` cleanup view (see `docs/database/views-reference.md`).
- `newsletter_subscribers` — marketing site signups, unrelated to the farm-management core.

## 8. Architectural Principles (as implemented, not just aspirational)

- **Multi-tenant by `farm_id`, with a second tenant axis via `cooperative_id`** for the supply-chain tables. Almost nothing in this schema works without one of these two scoping columns.
- **RLS as the actual enforcement layer**, not just a backstop — there is no separate application-level authorization check duplicating what RLS already does for most tables (the API routes mostly rely on PostgREST + RLS, passing the user's JWT through). See `docs/database/rls-policies.md`.
- **Denormalization where read performance matters**, with triggers keeping it in sync: `v_farm_summary` is a *materialized* view refreshed by `REFRESH MATERIALIZED VIEW CONCURRENTLY` on a statement-level trigger after writes to any of seven source tables — explicitly chosen over a plain view after the original (May 2026) version became a dashboard bottleneck, and over a blocking `REFRESH MATERIALIZED VIEW` (without `CONCURRENTLY`) because that would serialize all dashboard reads behind every write.
- **Append-only ledgers where auditability matters more than convenience**: `traceability_events` blocks UPDATE/DELETE at the rule level (`CREATE RULE ... DO INSTEAD NOTHING`), not just by RLS policy — meaning even a service-role connection can't mutate history, only insert new events.
- **Extensibility was a stated goal, and mostly held up**: poultry was added as a complete fourth enterprise without touching the coffee or dairy schemas, by following the same `batches/records-by-batch_id` shape the other enterprises already used.

## 9. See Also

- `docs/database/schema-reference.md` — every table, every column
- `docs/database/data-dictionary.md` — business meaning of fields, enum-like values, denormalization gotchas
- `docs/database/functions-reference.md`, `triggers-reference.md`, `views-reference.md`, `rls-policies.md`
- `docs/architecture/traceability-architecture.md` — the hash-chained ledger in depth
- `docs/architecture/platform-overview.md` — the platform from a product/stack perspective rather than a schema perspective
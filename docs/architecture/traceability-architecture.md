# Traceability Architecture

How framedInsight tracks a bag of coffee from a specific farmer's cherry delivery all the way to a consumer scanning a QR code — and how that chain of custody is made tamper-evident without using a blockchain.

## 1. The Physical Chain This Models

A washing station (factory) doesn't process one farmer's coffee in isolation — it blends cherry from potentially hundreds of farmers delivered on the same day into one fermentation/drying run, then later blends several of those runs into one dry-mill lot, then blends mill lots into one export shipment. Traceability has to model that blending explicitly, or it can't honestly answer "which farms produced this passport's coffee" — the honest answer is always "a set of farms," not "a farm."

```
farmer delivers cherry  →  factory_intake_lots  →  lot_farmer_deliveries (who delivered what, accepted?)
                                                              │
                                                              ▼
                                                    processing_batches
                                          (one day's intake + one fermentation/drying run)
                                                              │
                                              mill_lot_batches (join: many batches → one mill lot)
                                                              ▼
                                                         mill_lots
                                          (dry-mill output: parchment → clean coffee, grades)
                                                              │
                                          export_lot_mill_lots (join: many mill lots → one export lot)
                                                              ▼
                                                        export_lots
                                              (exporter shipment: buyer, port, EUDR DDS reference)
                                                              │
                                                              ▼
                                                     coffee_passports
                                          (the consumer-facing digital identity, one per export lot)
```

Every step writes to `traceability_events` (see §3) regardless of which table it touches — that's what makes the *ledger* span the whole chain even though the *data* is spread across six tables.

## 2. The Passport Itself

`coffee_passports` is deliberately schema-light on its interesting fields — `public_story`, `sustainability_metrics`, `quality_metrics`, and `geo_summary` are all `jsonb`, so the consumer-facing story can evolve (new metrics, new languages, new certifications) without a migration. The shapes documented in the `20260624_coffee_passport_platform.sql` migration comments are the contract `lib/passport/passport.service.ts` actually writes to and `app/api/passport/[passportCode]/route.ts` reads from:

- **`public_story`** — region, county, factory, cooperative name, altitude, varieties, processing method, harvest season, farm count, average farm size, hero image, farmer story, tasting notes.
- **`sustainability_metrics`** — EUDR compliance flag, % of plots deforestation-free, organic/Rainforest Alliance/Fair Trade flags, average forest cover %, total plot area, chemical inputs used.
- **`quality_metrics`** — SCA cupping score, cupper name/date, flavor notes, aroma/acidity/body sub-scores, grade, moisture %, certifications.
- **`geo_summary`** — centroid lat/lng (averaged across contributing plots — see computation note below), plot count, factory location, export port.

### How the payload is actually assembled (`assemblePassportPayload`)

This is computed, not hand-entered, by walking backward from a `processing_batch_id`:

1. Pull the batch, its factory, and its cooperative.
2. Pull every **accepted** delivery (`lot_farmer_deliveries.accepted = true`) linked to that batch's intake lot, joined out to the contributing farms and plots.
3. Pull `coffee_eudr_compliance` rows for every plot in that delivery set.
4. Pull `coffee_quality_records` for every harvest in the set, ranked by cupping score (the best one becomes "the" quality record shown — a blended lot reports its best cupping, not an average).
5. **Sustainability math**: `deforestation_free_plots_pct = (plots with risk_level='low' AND deforestation_risk=false) / total_plots`. `eudr_compliant` in the passport is simply `deforestation_free_plots_pct === 100` — a single non-compliant plot in the blend zeroes out the compliance flag for the whole passport. This is a meaningful business decision worth knowing about: it means blending in even one higher-risk smallholder plot among 400 compliant ones marks the *entire* export lot's passport as not EUDR-compliant, by design (matching how the actual regulation treats commingled lots).
6. **Geo centroid**: a plain arithmetic mean of every contributing plot's (or, if a plot has no GPS, the farm's) latitude/longitude — not area-weighted, not a true polygon union. This is intentionally a "roughly where this coffee is from" summary point for a consumer-facing map, not a regulatory geolocation (the regulatory geolocation lives at the plot level in `coffee_eudr_compliance`, per-plot, not on the passport).
7. **Variety breakdown** is a simple frequency count across contributing plots' `variety` field, sorted descending — the passport lists varieties most-common-first.

### Passport codes

Generated by the `generate_passport_code(p_cooperative_id, p_year)` SQL function: `'FI-' || year || '-' || zero_padded_sequence`, e.g. `FI-2026-0001`. The sequence is **per-cooperative-per-year**, computed by counting existing passports for that cooperative/year combination — there's a narrow race-condition window between the count and the insert (no advisory lock or unique-retry loop), worth knowing about if two officers from the same cooperative could plausibly publish a passport in the same second; in practice, with passport creation being a deliberate officer action (not high-frequency), this is a low-probability gap rather than a confirmed bug.

### Public access

`coffee_passports` RLS: cooperative officers can manage their own cooperative's passports (`FOR ALL`), and **anyone** can `SELECT` a passport where `status = 'published'` — no auth required. This is what backs `/trace/[passportCode]` (consumer-facing) and `/api/passport/[passportCode]` (the public JSON API for roasters/importers, which validates the code format with `^FI-\d{4}-\d{4}$`, edge-caches published passports for 1 hour via `revalidate = 3600`, and returns 404 rather than 403 for unpublished/nonexistent codes — deliberately not distinguishing the two cases to a public caller).

## 3. The Hash-Chained Ledger

`traceability_events` is the audit trail that spans every table in the chain. It is structurally append-only at the database level, not just by convention:

```sql
CREATE OR REPLACE RULE traceability_no_update AS ON UPDATE TO public.traceability_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE traceability_no_delete AS ON DELETE TO public.traceability_events DO INSTEAD NOTHING;
```

A Postgres `RULE` (not a trigger, not just an RLS policy) intercepts UPDATE/DELETE statements and turns them into no-ops — this holds even for a service-role connection that bypasses RLS entirely. The only way to "remove" an event is to never have inserted it.

**Hash chain mechanics** (`lib/passport/passport.service.ts::writeTraceabilityEvent`):

```
current_hash = SHA256({ entityId, eventType, eventData, previousHash ?? 'GENESIS', createdAt })
```

Each new event for a given `(entity_type, entity_id)` looks up the most recent prior event's `current_hash` and uses it as its own `previous_hash`. This gives blockchain-style tamper evidence (altering any historical event's stored `event_data` would change its hash, breaking the chain for every event after it) **without actual blockchain infrastructure** — it's a per-entity hash chain inside a regular Postgres table, which is the right tradeoff here: the trust model is "the cooperative and framedInsight are not adversarial to each other," not "no party in the chain can be trusted," so a public distributed ledger would be solving a problem this platform doesn't have.

Event types observed in the schema/migration comments: `created`, `delivery_added`, `status_changed`, `parchment_recorded`, `nce_linked`, `passport_published`. `entity_type` spans `factory_intake_lot | processing_batch | mill_lot | export_lot | coffee_passport | delivery`.

**Access**: cooperative officers can read and insert events for their own cooperative (scoped via `traceability_events.cooperative_id`); no update/delete policy exists or is needed, since the rules above block both unconditionally. Public read access to events for *published* passports is handled in the app layer (looking up by `passport_code` and filtering), not via a dedicated RLS policy — worth knowing if a future feature wants to expose the full ledger publicly under `/trace/[passportCode]`, since right now that would require new application code, not just a new policy.

## 4. Relationship to `farm_events` (the *other* event log)

It's worth being explicit that this schema has **two** event-log-shaped tables with different scopes and different maturity levels:

- **`traceability_events`** (this document) — coffee supply-chain specific, hash-chained, genuinely append-only at the rule level, actively written to by the passport pipeline.
- **`farm_events`** — older, more general-purpose, originally scoped to EUDR assessment events and designed as the event-sourcing foundation for *all* domains (dairy, compliance, general farm events per its `event_type` comment list). It is live and accepts writes (RLS allows farm managers to insert/select their own farm's events), but its originally-planned consumer view (`v_eudr_assessment_stream`) is not present in the live database — see `docs/architecture/platform-overview.md` §10 for the drift note. Don't assume `farm_events` is wired into a working read pipeline today; treat it as a write-side log awaiting a consumer.

If extending event-sourcing to dairy or poultry, the more proven pattern to copy is `traceability_events` (hash chain + hard append-only rules), not the original `farm_events` design — the former is what's actually carrying production traffic for coffee today.

## 5. EUDR's Role in This Chain

`coffee_eudr_compliance` per-plot data feeds directly into passport sustainability metrics (§2 step 5), but EUDR compliance is assessed and stored at the **plot** level, independent of any specific passport — a plot's risk level doesn't change because it happens to be included in a blend. See `docs/coffee/eudr-module.md` for how that assessment itself works (the Hansen/GFW pipeline, risk thresholds, the point-vs-polygon geolocation rule).
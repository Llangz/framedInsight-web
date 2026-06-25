# Poultry Module

The newest of the four enterprises — built as a complete vertical (16 files, 6 tables with RLS, Kenya-specific vaccination schedule and breed options) in a single development push, deliberately following the `batch/records-by-batch_id` shape already proven by the coffee and dairy modules rather than inventing a new pattern.

## 1. Core Model: Batches, Not Birds

`poultry_batches` is the unit of management — **one row per group of birds placed together**, not one row per bird (unlike `cows`/`small_ruminants`, which are individual-animal records). This is the correct model for poultry in practice: a smallholder or commercial operation places, feeds, and eventually sells birds in batches, and individual-bird tracking would be both impractical and not how Kenyan poultry keepers actually think about their flock. `bird_type` is constrained (by convention, not a DB enum — see `docs/database/data-dictionary.md` §1) to exactly `layer | broiler | kienyeji | dual_purpose` — every aggregating view branches on these four literal strings, so a fifth value would silently fail to be counted anywhere rather than erroring.

Child tables all reference `batch_id` (and, for most, `farm_id` directly too — see the redundant-RLS-policy note in `docs/database/rls-policies.md` §3, which is specific to exactly these six poultry tables): `poultry_egg_records`, `poultry_feed_records`, `poultry_health_records`, `poultry_mortality`, `poultry_sales`.

## 2. Hen-Day Production — the Key Layer Metric

For layer batches, the dashboard computes **hen-day production percentage**: `(average daily eggs over a window) / (current bird count) × 100`. This is the standard poultry-industry productivity metric (eggs actually laid as a percentage of hens that *could* have laid that day), and the codebase treats specific bands as meaningful, consistently across both the batch-detail page and the AI warnings route:

- **≥75%** → "Good"
- **60–74%** → "Average"
- **<60%** → "Below target" — this is also the exact threshold the dashboard's own low-production warning fires at, and the same number the AI warnings route (§3) uses for its `production_drop` severity escalation.

This metric only applies to layers (and is computed for `dual_purpose` batches too, per `isLayer` checks in the batch detail client) — broiler batches don't have an equivalent single headline metric in the same way, since their management goal is growth-to-slaughter-weight rather than sustained daily output.

## 3. AI Early-Warning System

`app/api/ai/livestock-warnings/poultry/route.ts` follows the same `generateObject`-against-Zod-schema pattern as the dairy warnings route (`docs/dairy/dairy-module.md` §3), with nine batch-level warning types and explicit numeric thresholds given to the model rather than left to its judgment:

| Warning type | Trigger |
|---|---|
| `mortality_spike` | ≥3 deaths in the last 7 days, or the same cause recurring 2+ times — `warning` at 3–5 deaths, `critical` above 5 or for a recurring cause |
| `high_mortality_rate` | Cumulative mortality >5% of initial placement → `warning`; >10% → `critical` |
| `feed_stock_critical` / `feed_stock_low` | ≤5 days / ≤10 days of feed remaining (the prompt specifically notes kienyeji and broilers deplete feed faster, for the model to weight accordingly) |
| `production_drop` | Hen-day % below 65% → `warning`; below 50% → `critical` (a batch with no egg data logged at all is flagged as `info` rather than assumed healthy) |
| `vaccination_overdue` | Scheduled vaccination due within 3 days or already past, and not yet recorded as given |
| `health_gap_alert` | No health event logged in 30+ days (`info`-level reminder, not urgent) |
| `age_action_due` | Broilers ≥6 weeks (plan processing/sale) or layers ≥72 weeks (plan flock replacement) — both `info`-level planning nudges |
| `disease_pattern` | The same disease cause dominating recent mortality, combined with nonzero deaths in the last 7 days → `critical`, explicitly framed in the prompt as a possible **biosecurity breach**, not just a health note |

Same critical-severity-triggers-WhatsApp-push behavior as the dairy warnings route, and the same independence from the nightly EWS cron job described in `docs/architecture/platform-overview.md` §8 — see the dairy module doc's note on this for the duplicate-alert consideration.

## 4. Offline Sync — Two Implementations, Only One Actually Wired Up

There are **two** offline-sync-related files in `lib/`, and it's worth being precise about which one poultry (and dairy/coffee) actually use, since their names and stated purpose overlap:

- **`lib/offline-db.ts`** (`DB_VERSION = 3`, dedicated IndexedDB object stores per domain — `poultryOfflineEvents`, `dairyOfflineEvents`, `coffeeOfflineEvents`) — **this is the one actually used**. All five poultry client components that need offline capability (`EggsClient`, `FeedClient`, `MortalityClient`, `HealthClient`, `SalesClient`) import from it directly, and its events are drained by the `sync-offline-events` edge function (which accepts a batch of `poultryEvents` keyed by `eventId`/`entityType`/`farmId`/`batchId`/`payload` and reports back `synced | skipped | failed` per event).
- **`lib/offline-sync-crdt.ts`** — a more theoretically-elaborate CRDT design (timestamp-based scalar merge, multi-value registers for genuinely conflicting values like GPS coordinates, Lamport-clock causality tracking) with detailed doc comments referencing the *Designing Data-Intensive Applications* CRDT pattern. **This file has zero import sites anywhere in `app/` or `components/`** in this pass, still contains literal `// TODO: persist to IndexedDB` comments, and its own conflict-resolution code logs a warning about a `farm_operations` table "not in schema" when it runs — strong signals this is an earlier design exploration that was superseded by the simpler per-domain event-store approach in `offline-db.ts`, not dead code that's secretly still load-bearing.

**Practical implication**: if "CRDT-based offline sync" comes up in conversation about this codebase, it most likely refers to the conceptual approach (deterministic merge instead of last-write-wins) as realized in `offline-db.ts`'s simpler per-domain event log + server-side reconciliation, not to `offline-sync-crdt.ts`'s more formal CRDT primitives, which don't appear to be in the actual data path. Building new offline-capable poultry (or dairy/coffee) features should extend `offline-db.ts`'s pattern — add a new store/entity type following the existing five `PoultryEntityType` variants — rather than reaching for the unused CRDT module.

## 5. Dashboard Structure

`app/dashboard/poultry/`: `add-batch/`, `flock/` (batch list + `flock/[id]/` detail page, which is where the hen-day metric and financials/P&L view for a batch live), `eggs/`, `feed/`, `mortality/`, `health/`, `sales/`, `finance/`, `warnings/`. Each of the record-entry pages (`eggs/`, `feed/`, `mortality/`, `health/`, `sales/`) has its corresponding offline-capable client component wired to `offline-db.ts` as described above.
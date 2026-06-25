# EUDR Compliance Module

EUDR (EU Deforestation Regulation, (EU) 2025/2650) compliance is one of the platform's clearest value propositions for Kenyan coffee — it's a hard regulatory deadline that smallholder cooperatives genuinely cannot meet manually at scale (plot-by-plot GPS evidence for potentially thousands of member farmers), which is exactly the kind of problem software is suited to. This module spans a constants file, an edge function, a database table, an API route, and the public passport's sustainability metrics.

## 1. Regulatory Facts Baked Into the Code

All sourced from `lib/eudr-constants.ts`, which is deliberately the **single source of truth** for these numbers — consumed by the boundary mapper, the edge function (duplicated there for Deno runtime compatibility, with a comment explicitly flagging it as a duplicate to keep in sync), the API route, and any UI banner:

- **Deadlines** (Regulation (EU) 2025/2650, in force May 2026): large/medium operators — **30 December 2026**; micro/small operators, which covers most Kenyan coffee farmers — **30 June 2027**. The code notes a further simplification review is scheduled for 2026 that could shift these again.
- **Kenya's risk tier**: classified **`standard`** risk under the EU's May 2025 country benchmarking — the same tier as most African coffee origins. Critically, **standard risk gets no simplified due-diligence relief**: full plot-level GPS evidence and deforestation-free proof are required for every plot regardless of farm size. Only the *deadline* differs by operator size, not the *rigour* of what's required.
- **Geolocation format** (Art. 9(1)(d)): plots under 4 ha submit a single lat/lng point; plots at or above 4 ha submit a full GeoJSON polygon. Both always at ≥6 decimal places, WGS84/EPSG:4326. Since the overwhelming majority of Kenyan smallholder coffee plots are under 1 hectare, point format is the common case despite the platform's polygon-capture UI being the more visually prominent feature.
- **Reference date**: tree-cover loss is only legally relevant **after 31 December 2020** — loss before that date doesn't trigger non-compliance.

## 2. The Hansen/GFW Dataset Tradeoff (and Why Thresholds Are Widened)

The only tree-cover-loss dataset feasible for per-plot screening at smallholder scale is the **Hansen/UMD 30m resolution layer**, queried via the Global Forest Watch Data API. The alternative, finer-grained "dominant driver" dataset (WRI/Google DeepMind) operates at **1km grid cells** — far too coarse to attribute loss cause for a 0.2–1 hectare plot, so it's explicitly not used here.

Hansen's known failure mode for this use case: it **over-flags coffee agroforestry as "forest loss"** — normal canopy/shade-tree management on a working coffee plot can look like deforestation at 30m resolution. The code compensates with two guards rather than trying to fix the dataset itself:
- **Absolute noise floor**: any total loss under **0.03 ha** is treated as noise/normal husbandry, not deforestation, regardless of what percentage of the (often tiny) plot that represents.
- **Widened ratio thresholds**: loss ratio (loss area / plot area) under **2%** → low risk; **2–12%** → medium; **12%+** → high. These were deliberately widened from a naive 1%/10% split specifically to reduce false positives on coffee agroforestry.

The code is explicit that **the AFA (Agriculture and Food Authority) geo-mapping programme remains the authoritative compliance source** for Kenyan farmers — this platform's GFW-based check is positioned as preliminary screening / early warning, not a replacement for that official channel. Every `riskDetails` string written to `coffee_eudr_compliance.notes` includes this caveat verbatim, so it travels with the data wherever it's read.

## 3. How an Assessment Runs (`check-eudr-risk` edge function)

Triggered fire-and-forget immediately after a plot's boundary is saved — the farmer never waits for it. Sequence:

1. Receive `plot_id` + GeoJSON polygon.
2. Look up `farm_id` and stored `area_hectares` from `coffee_plots` (needed for the compliance table's FK and as a sanity-check against the submitted polygon's computed area).
3. Compute the polygon's area itself (spherical-cap approximation, `polygonAreaHa`) — falls back to the stored `area_hectares` if the computed value is implausibly small (<0.001 ha, e.g. a malformed polygon).
4. Determine geolocation format (point vs polygon) from that area.
5. Call the GFW Data API with a SQL-over-HTTP query against the Hansen dataset, scoped to the submitted polygon geometry, summing loss area by year from 2020 onward.
6. Apply the noise-floor and ratio-threshold guards (§2) to classify `low | medium | high`, or `error` if the GFW call itself fails (with `riskDetails` explicitly stating manual review is required in that case — the assessment doesn't silently default to a misleadingly reassuring "low").
7. **Upsert** into `coffee_eudr_compliance` (`onConflict: 'plot_id'` — one row per plot, always overwritten on reassessment, not appended as history).
8. **Best-effort sync** of `risk_level`/`assessed_at`/`details` back onto `coffee_plots`'s own denormalized columns, for the plot-detail page's inline badge — errors here are explicitly ignored, since the authoritative write to `coffee_eudr_compliance` already succeeded.

`compliance_status` is derived directly from `risk_level`: `low → pending_verification`, `medium → requires_review`, `high → non_compliant`, GFW-call-failure → `error`. Note this means **`low` risk doesn't immediately mean "compliant"** — it means "pending verification," i.e. the automated screen found nothing concerning, but a human/AFA verification step is still implied by the status name, distinct from `coffee_eudr_compliance.afa_verified` (a separate boolean the API route lets a user set when uploading AFA verification documentation).

## 4. ⚠️ A Likely Naming/Semantic Bug Worth Verifying: `forest_cover_pct`

The edge function computes the value it stores in `coffee_eudr_compliance.forest_cover_pct` as:
```ts
forestCoverPct = Math.min(100, (totalLossHa / plotAreaHa) * 100)
```
That is a **loss ratio expressed as a percentage** — "what fraction of this plot's area was detected as tree-cover loss" — not a forest cover percentage in the sense the column name implies ("what fraction of this plot is currently covered by forest"). These are close to inverses of each other conceptually, not the same number. This matters beyond just the column being misleadingly named internally: `lib/passport/passport.service.ts::assemblePassportPayload` averages this exact field across a passport's contributing plots and presents it publicly as `sustainability_metrics.avg_forest_cover_pct` on the **consumer-facing coffee passport** (`docs/coffee/coffee-passports.md` §1). If the computation is indeed a loss ratio rather than a cover ratio, then a passport's public sustainability claim about "average forest cover %" would actually be displaying something closer to an average deforestation-risk ratio — the opposite framing of what the field name promises a reader. This is worth a direct, deliberate check (and likely either a rename of the column/field to something like `loss_ratio_pct`, or a genuine forest-cover computation if that's actually needed) before relying on or publicly displaying this specific number further — flagging it here precisely because it's the kind of subtle, plausible-looking mislabeling that's easy to carry forward into new code without anyone noticing the original computation didn't match the name.

## 5. Fleet-Level Summary & Manual Document Upload (`/api/coffee/eudr`)

**`GET`** returns a farm-wide compliance rollup: total plots, how many are `eudr_risk_level = 'low'` (read from `coffee_plots`'s denormalized copy, not `coffee_eudr_compliance` directly), a compliance percentage, the deadline/days-remaining/risk-tier constants from §1, and a static `requiredDocuments` checklist (`gps_coordinates`, `land_title_deed`, `proof_of_origin`).

**`POST`** lets a farmer attach manual evidence to a plot's compliance record — document uploads, a manual `deforestationRisk` override, or an AFA geo-mapping ID — merging into the existing `raw_api_response` JSON rather than overwriting it, and re-syncing `coffee_plots`'s denormalized fields afterward. This is the human-in-the-loop complement to the automated GFW screen: a farmer (or, more likely, a cooperative officer assisting them) can supply a land title or AFA mapping reference that the automated check has no way to discover on its own.

## 6. Where This Feeds Into the Passport Platform

`coffee_eudr_compliance` rows for a batch's contributing plots are what `assemblePassportPayload` reads to compute a passport's `sustainability_metrics.eudr_compliant` flag — and that computation is strict: **a single non-compliant plot among hundreds zeroes out the entire blended lot's compliance flag** (see `docs/architecture/traceability-architecture.md` §2, step 5). This is a faithful reflection of how the regulation actually treats commingled lots, not a simplification — coffee from many farmers gets physically blended at the wet mill long before export, so "this export lot is compliant" can only honestly mean "every contributing plot was compliant," not an average.
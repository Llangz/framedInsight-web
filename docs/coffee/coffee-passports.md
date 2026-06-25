# Coffee Digital Passports

The consumer/buyer-facing transparency feature that turns framedInsight from a farm-management tool into a traceability platform. This document covers the product purpose and the officer-facing workflow. For the underlying data model and hash-chained ledger mechanics, see `docs/architecture/traceability-architecture.md`; for the table schema, see the "Coffee — Quality & Traceability Chain" section of `docs/database/schema-reference.md`.

## 1. Business Purpose

A coffee passport lets a buyer, roaster, or end consumer verify — for one specific export shipment — where it came from, how it was grown and processed, and whether it's deforestation-free, by scanning a QR code on the bag or visiting a link directly. This matters commercially in two distinct ways for a Kenyan cooperative:

- **EUDR compliance as a sales argument, not just a regulatory burden** — a published passport with `sustainability_metrics.eudr_compliant = true` is something a cooperative can put in front of an EU buyer proactively, ahead of the regulation's enforcement deadline, rather than just scrambling to comply reactively.
- **Provenance/quality story for differentiation** — Kenyan specialty coffee already competes partly on origin story (a specific cooperative, a specific altitude band, specific varieties like SL28/SL34). The passport formalizes that story into something a buyer 6,000 miles away can verify independently rather than just take a label's word for.

## 2. Lifecycle

```
draft  →  published  →  (archived)
```

- **`draft`** — created by a cooperative officer once a processing batch (and, optionally, the export lot it ended up in) is identified. Visible only to officers of the owning cooperative.
- **`published`** — officer explicitly publishes; sets `published_at`, and from this point the passport is publicly readable (no auth) via both `/trace/[passportCode]` and `/api/passport/[passportCode]`.
- **`archived`** — exists as a status value in the `CHECK` constraint; the application code paths for archiving weren't located in this pass, so treat this as a defined-but-possibly-not-yet-wired-up state.

A passport is **not editable after the fact via the assembly pipeline** — `createPassport` computes its payload once, at creation time, from whatever the chain's data looked like then. Allowing an officer to apply manual overrides (`overrides.publicStory`/`sustainabilityMetrics`/`qualityMetrics`, merged on top of the computed values) exists specifically because some fields (hero image, farmer story, tasting notes, certifications) have no automatic source and need a human to supply them — not because the computed fields are expected to need correcting often.

## 3. Officer Workflow

1. **Identify the processing batch** the passport should represent (`processing_batches.id`) — this is what `assemblePassportPayload` walks backward from to find contributing farms, plots, EUDR records, and quality records (full computation logic in `docs/architecture/traceability-architecture.md` §2).
2. **Optionally identify the export lot** if one already exists for this batch's coffee — a passport can be created before export-lot assignment is finalized (`export_lot_id` is nullable and `ON DELETE SET NULL`), but `v_passport_chain` (which backs the public view) won't show buyer/shipment details until it's linked.
3. **`createPassport(...)`** generates the passport code via `generate_passport_code` (format `FI-YYYY-NNNN`, sequential per cooperative per year), computes the full payload, inserts as `draft`, and writes a genesis `traceability_events` row.
4. **Add manual story content** — hero image, farmer narrative, tasting notes — anything the automated assembly couldn't compute, via the `overrides` parameter.
5. **`publishPassport(...)`** — flips `status` to `published`, sets `published_at`, writes a `passport_published` ledger event. From this moment the passport is live at `/trace/FI-YYYY-NNNN`.

`getCoopPassports(cooperativeId)` backs the cooperative dashboard's passport list (`app/dashboard/cooperative/passports/`), joined out to basic export-lot info for display. `getPassportLedger(passportId)` pulls the full `traceability_events` history for a given passport for an audit view.

## 4. The Public Page (`/trace/[passportCode]`)

No authentication required — this is the page a QR code on a coffee bag points to. Design brief (from the route's own code comments): a "soil-to-shelf" dark theme with warm parchment-gold accents evoking coffee parchment and dried cherry, anchored by an animated five-step custody chain (farm → factory → mill → export → passport) showing the handoffs visually rather than just listing data fields. `generateMetadata` builds dynamic Open Graph tags per passport (cooperative name, county, farmer count, varieties, harvest season, hero image) so a shared passport link unfurls nicely on WhatsApp/social — the actual mechanism most of these links will spread through, given the platform's WhatsApp-first orientation.

**View counting**: every successful fetch of a published passport increments `view_count` by reading the current value and writing `+1` — not an atomic SQL increment. Combined with the API route's 1-hour edge cache (`revalidate = 3600`), in practice `view_count` undercounts true page views (cache hits never reach this code at all) and has a narrow theoretical race window for concurrent cache-miss requests. Treat this figure as a directional "roughly how much attention this passport has gotten" indicator, not an exact analytics count.

**Code format validation**: the public API route checks `^FI-\d{4}-\d{4}$` before even attempting a lookup, and returns a generic 404 for both "badly formatted code" and "real code, but not published" — deliberately not distinguishing the two to a public caller, so probing for valid-but-unpublished codes doesn't get an information-leaking different response.

## 5. A Small Naming Inconsistency Worth Knowing About

The `traceability_events` migration's own comments document the expected `event_type` vocabulary as `created | delivery_added | status_changed | parchment_recorded | nce_linked | passport_published`. The actual passport-creation code writes `eventType: 'passport_created'` — not `'created'`. This is a minor naming drift between the migration's documentation and the implementation, not a functional bug (the ledger doesn't validate `event_type` against an enum — it's a free-text column), but worth knowing if writing any reporting/filtering logic against `traceability_events.event_type`: don't assume the migration comment's vocabulary list is exhaustive or exact; check actual written values directly.
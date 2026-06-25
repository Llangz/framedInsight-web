# Dairy Module

The dairy (cattle) enterprise. Conceptually the most "textbook" of the four enterprises — a standard herd-management data model — but with two naming/duplication traps worth knowing before extending it.

## 1. Core Tables

`cows` is the animal record (`cow_tag`, `qr_code`, breed, `purpose` — `dairy` by default — `status`, with `dam_id`/`sire_id` for lineage). Everything else hangs off `cow_id`, not `farm_id` directly, which is why these tables use the `can_manage_farm_by_cow_id` RLS helper rather than `can_manage_farm` (see `docs/database/rls-policies.md` §1 for the access-scope implication this has for cooperative officers specifically):

- **`milk_records`** — daily morning/midday/evening yields per cow. This is the **cattle** milk table.
- **`health_records`** — disease/treatment events, including `withdrawal_days`/`safe_milk_date`/`safe_meat_date` for tracking when treated milk/meat is safe to sell or consume again.
- **`breeding_events`** — heat date, service date, service type, pregnancy check outcome, expected calving date.
- **`calving_records`** — the structured, current model for recording an actual calving, linked back to the `breeding_events` row that led to it.
- **`calves`** — an older, parallel calf record (free-text `sire_code`, weaning fields) that predates `calving_records`. **Both tables are live simultaneously.** Confirm which one any given UI flow actually writes to before adding new calf-tracking logic — see the double-counting risk explained in `docs/database/data-dictionary.md` §6.
- **`vet_visits`** — veterinary visit log (diagnosis, prescription, cost, next visit date) — distinct from `health_records`, which is more of a treatment/disease event log; `vet_visits` is closer to an appointment/billing record.

## 2. The `milk_records` vs `milk_production` Naming Trap

This is important enough to repeat here even though it's documented schema-wide in `docs/database/data-dictionary.md` §6: **`milk_records` is the cattle table** (`cow_id → cows.id`). **`milk_production`, despite sounding generic, is actually the small-ruminant (goat/sheep) milk table** (`animal_id → small_ruminants.id`) — it has nothing to do with dairy cattle at all. If you're building cattle-specific dairy features, the table you want is always `milk_records`, never `milk_production`.

## 3. AI Early-Warning System

`app/api/ai/livestock-warnings/dairy/route.ts` is a structured-output LLM call (Vercel AI SDK's `generateObject` against a Zod schema) that analyzes a farm's active cows and produces only **evidence-based** warnings — the system prompt explicitly instructs the model to be conservative and not generate a warning without real supporting data, returning an empty array for healthy cows rather than padding output. Six warning types, each with specific numeric trigger logic baked into the prompt rather than left to model judgment:

| Warning type | Trigger logic (as specified to the model) |
|---|---|
| `heat_predicted` | Cows cycle every 18–24 days; predicts the next heat window from the last service date. The prompt specifically distinguishes a heat-related single-day milk dip-then-recovery from genuine illness. |
| `milk_decline_anomaly` | Sustained >15% drop over 3+ consecutive days, *while not in a recorded dry-off period* — flagged as a health concern (mastitis, illness), not heat. |
| `calving_due` | `expected_calving_date` within 14 days. |
| `health_check_overdue` | No health event logged in 90+ days. |
| `pregnancy_check_due` | Last service 45+ days ago with no recorded pregnancy outcome. |
| `mastitis_risk` | Uneven morning:evening milk ratio combined with an overall declining trend. |

The model is fed a per-cow summary (7-day vs prior-7-day average milk, % change, last breeding/health event dates) rather than raw table dumps — the aggregation happens in the route handler before the LLM call, which keeps the prompt focused and the token cost bounded regardless of how much historical data a cow has accumulated.

**Critical-severity warnings trigger an immediate WhatsApp push** to the farm's registered phone via LipaChat, formatted as a short bulleted alert directing the farmer to the dashboard for detail — this is a synchronous, on-demand notification (fired from within this same API call when warnings are generated), distinct from the separate daily-batch Early Warning System cron job described in `docs/architecture/platform-overview.md` §8, which pushes from the `alerts` table on a fixed schedule. A farmer calling this warnings endpoint (e.g. by visiting the dairy warnings dashboard page) can trigger an immediate WhatsApp message *in addition to* whatever the nightly EWS cron would have sent — worth knowing if a farmer reports getting "duplicate" or "extra" alerts; the two pathways are genuinely independent and not deduplicated against each other in this pass.

## 4. Dashboard Structure

`app/dashboard/dairy/` covers: `cows/` (list, detail, add), `milk/` and `record-milk/` (note: **two separate routes for what sounds like the same action** — `milk/record/` and `record-milk/` both exist; worth checking whether one is a leftover from a UI restructure rather than two genuinely distinct flows), `breeding/`, `health/`, `herd/` (likely the summary/overview page, distinct from the per-cow `cows/` list), and `warnings/` (the AI early-warning feed described above).

## 5. What's Notably Thinner Than the Coffee Module

Dairy has no equivalent of coffee's satellite monitoring, weather-driven risk scoring, or EUDR-style compliance tracking — which makes sense, since none of those concepts (deforestation regulation, vegetation indices) apply to cattle. The AI diagnose route (`app/api/ai/diagnose/route.ts`, shared across enterprises) does support dairy-specific prompting (mastitis, foot rot) when called with `enterpriseType: 'dairy'`, giving dairy a lighter-weight version of coffee's AI-diagnosis feature without a dedicated dairy-specific endpoint.
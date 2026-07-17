import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl        = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

interface PoultryOfflineEvent {
  eventId: string
  entityType:
    | "poultry_egg_record"
    | "poultry_feed_record"
    | "poultry_mortality"
    | "poultry_health_record"
    | "poultry_sale"
    | "poultry_batch_update"

  farmId: string
  batchId: string
  payload: Record<string, any>
  isoTimestamp: string
}

interface DairyOfflineEvent {
  eventId: string
  entityType: "milk_record" | "cow_registration" | "breeding_event" | "health_check" | "milk_sale"
  farmId: string
  referenceId?: string // cow id
  payload: Record<string, any>
  isoTimestamp: string
}

interface CoffeeOfflineEvent {
  eventId: string
  entityType:
    | "coffee_activity"
    | "coffee_harvest"
    | "coffee_spray_event"
    | "coffee_pruning"
    | "coffee_scouting"
    | "coffee_finance_transaction"
    | "coffee_plot_create"
    | "coffee_plot_update"
  farmId: string
  referenceId?: string // plot id
  payload: Record<string, any>
  isoTimestamp: string
}

interface SmallRuminantOfflineEvent {
  eventId: string
  entityType:
    | "small_ruminant_health"
    | "small_ruminant_weight"
    | "small_ruminant_sale"
    | "small_ruminant_breeding"
    | "small_ruminant_milk"
    | "small_ruminant_registration"
    | "small_ruminant_kidding"
  farmId: string
  referenceId?: string // animal id (registration/milk/weight/health) or breeding record id (kidding)
  payload: Record<string, any>
  isoTimestamp: string
}

interface Result {
  eventId: string
  status: "synced" | "skipped" | "failed"
  reason?: string
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    const body = await req.json()
    const {
      user_id,
      poultryEvents,
      dairyEvents,
      coffeeEvents,
      smallRuminantEvents,
    }: {
      user_id: string
      poultryEvents?: PoultryOfflineEvent[]
      dairyEvents?: DairyOfflineEvent[]
      coffeeEvents?: CoffeeOfflineEvent[]
      smallRuminantEvents?: SmallRuminantOfflineEvent[]
    } = body

    // BUG FIX: this handler previously only ever destructured and validated
    // `poultryEvents`. components/ui/SyncManager.tsx sends a differently-named
    // array per domain (`dairyEvents`, `coffeeEvents`, ...) via a computed key
    // (`[`${domain}Events`]: events`). Any dairy or coffee sync call therefore
    // arrived here with `poultryEvents` undefined, failed
    // `!Array.isArray(poultryEvents)`, and got a 400 back on every attempt -
    // silently, forever, since SyncManager only console.errors a failed sync
    // and leaves the records queued for the next retry. Offline milk and
    // coffee-activity records were being saved to the device and NEVER
    // reaching the database, with the farmer's UI still saying "N records
    // pending sync" as if it were working. Validate against whichever
    // domain arrays are actually present instead of hardcoding one.
    const domains = { poultryEvents, dairyEvents, coffeeEvents, smallRuminantEvents }
    const presentDomains = Object.entries(domains).filter(([, v]) => Array.isArray(v)) as
      [string, any[]][]

    if (!user_id || presentDomains.length === 0) {
      return json({ error: "Invalid payload" }, 400)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ── Get farm context ─────────────────────────────
    const { data: fm, error } = await supabase
      .from("farm_managers")
      .select("farm_id")
      .eq("user_id", user_id)
      .single()

    if (error || !fm) {
      return json({ error: "User not associated with farm" }, 403)
    }

    const farmId = fm.farm_id

    const allResults: Record<string, Result[]> = {}

    // ── Poultry ───────────────────────────────────────
    if (poultryEvents?.length) {
      const sorted = [...poultryEvents].sort(byTimestamp)
      const results: Result[] = []
      for (const event of sorted) {
        const ok = await processPoultryEvent(supabase, farmId, event)
        results.push({ eventId: event.eventId, status: ok ? "synced" : "failed" })
      }
      allResults.poultry = results
    }

    // ── Dairy ─────────────────────────────────────────
    if (dairyEvents?.length) {
      const sorted = [...dairyEvents].sort(byTimestamp)
      const results: Result[] = []
      for (const event of sorted) {
        const ok = await processDairyEvent(supabase, farmId, event)
        results.push({ eventId: event.eventId, status: ok ? "synced" : "failed" })
      }
      allResults.dairy = results
    }

    // ── Coffee ────────────────────────────────────────
    if (coffeeEvents?.length) {
      const sorted = [...coffeeEvents].sort(byTimestamp)
      const results: Result[] = []
      for (const event of sorted) {
        const ok = await processCoffeeEvent(supabase, farmId, event)
        results.push({ eventId: event.eventId, status: ok ? "synced" : "failed" })
      }
      allResults.coffee = results
    }

    // ── Small ruminants ───────────────────────────────
    if (smallRuminantEvents?.length) {
      const sorted = [...smallRuminantEvents].sort(byTimestamp)
      const results: Result[] = []
      for (const event of sorted) {
        const ok = await processSmallRuminantEvent(supabase, farmId, event)
        results.push({ eventId: event.eventId, status: ok ? "synced" : "failed" })
      }
      allResults.smallRuminant = results
    }

    // ── Log one combined sync audit trail entry ──────
    const totalSynced = Object.values(allResults).flat().filter(r => r.status === "synced").length
    const totalFailed = Object.values(allResults).flat().filter(r => r.status === "failed").length

    await supabase.from("farm_events").insert({
      id: crypto.randomUUID(),
      farm_id: farmId,
      event_type: "offline_sync_v2",
      actor_id: user_id,
      actor_type: "farmer",
      created_at: new Date().toISOString(),
      event_data: {
        domains: Object.keys(allResults),
        synced: totalSynced,
        failed: totalFailed,
      },
    })

    // Response shape kept backward-compatible: synced_<domain>_ids per
    // domain, plus the original flat `results` for poultry-only callers.
    const response: Record<string, any> = { results: allResults.poultry ?? [] }
    for (const [domain, results] of Object.entries(allResults)) {
      response[`synced_${domain}_ids`] = results.filter(r => r.status === "synced").map(r => r.eventId)
    }

    return json(response)
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : "Unknown error",
    }, 500)
  }
})

function byTimestamp(a: { isoTimestamp: string }, b: { isoTimestamp: string }) {
  return new Date(a.isoTimestamp).getTime() - new Date(b.isoTimestamp).getTime()
}

/* ─────────────────────────────────────────────── */
/* CORE CRDT POULTRY SYNC ENGINE                  */
/* ─────────────────────────────────────────────── */

async function processPoultryEvent(
  supabase: any,
  farmId: string,
  event: PoultryOfflineEvent
): Promise<boolean> {
  const { entityType, batchId, payload, eventId, isoTimestamp } = event

  const ts = new Date(isoTimestamp).getTime()

  try {
    switch (entityType) {

      /* ───────────── EGGS (LWW per day) ───────────── */
      case "poultry_egg_record": {
        const { data: existing } = await supabase
          .from("poultry_egg_records")
          .select("id, created_at")
          .eq("batch_id", batchId)
          .eq("record_date", payload.record_date)
          .maybeSingle()

        if (!existing) {
          await supabase.from("poultry_egg_records").insert({
            id: eventId,
            farm_id: farmId,
            batch_id: batchId,
            ...payload,
          })
        } else if (ts > new Date(existing.created_at).getTime()) {
          await supabase
            .from("poultry_egg_records")
            .update(payload)
            .eq("id", existing.id)
        }
        return true
      }

      /* ───────────── FEED (append-only) ───────────── */
      case "poultry_feed_record": {
        const { data: exists } = await supabase
          .from("poultry_feed_records")
          .select("id")
          .eq("id", eventId)
          .maybeSingle()

        if (!exists) {
          await supabase.from("poultry_feed_records").insert({
            id: eventId,
            farm_id: farmId,
            batch_id: batchId,
            ...payload,
          })
        }
        return true
      }

      /* ───────────── MORTALITY (append-only + side effect) ───────────── */
      case "poultry_mortality": {
        const { data: exists } = await supabase
          .from("poultry_mortality")
          .select("id")
          .eq("id", eventId)
          .maybeSingle()

        if (!exists) {
          await supabase.from("poultry_mortality").insert({
            id: eventId,
            farm_id: farmId,
            batch_id: batchId,
            ...payload,
          })

          // safe decrement
          await supabase.rpc("decrement_batch_count", {
            batch_id: batchId,
            amount: payload.count_dead ?? 0,
          })
        }
        return true
      }

      /* ───────────── HEALTH (append-only) ───────────── */
      case "poultry_health_record": {
        const { data: exists } = await supabase
          .from("poultry_health_records")
          .select("id")
          .eq("id", eventId)
          .maybeSingle()

        if (!exists) {
          await supabase.from("poultry_health_records").insert({
            id: eventId,
            farm_id: farmId,
            batch_id: batchId,
            ...payload,
          })
        }
        return true
      }

      /* ───────────── SALES (append-only) ───────────── */
      case "poultry_sale": {
        const { data: exists } = await supabase
          .from("poultry_sales")
          .select("id")
          .eq("id", eventId)
          .maybeSingle()

        if (!exists) {
          await supabase.from("poultry_sales").insert({
            id: eventId,
            farm_id: farmId,
            batch_id: batchId,
            ...payload,
          })
        }
        return true
      }

      /* ───────────── BATCH UPDATE (LWW) ───────────── */
      case "poultry_batch_update": {
        const { data: batch } = await supabase
          .from("poultry_batches")
          .select("updated_at")
          .eq("id", batchId)
          .single()

        if (!batch) return false

        if (ts > new Date(batch.updated_at).getTime()) {
          await supabase
            .from("poultry_batches")
            .update({
              ...payload,
              updated_at: isoTimestamp,
            })
            .eq("id", batchId)
        }

        return true
      }

      default:
        console.warn("Unknown event type:", entityType)
        return true
    }
  } catch (err) {
    console.error("Sync error:", err)
    return false
  }
}

/* ─────────────────────────────────────────────── */
/* DAIRY SYNC                                     */
/* ─────────────────────────────────────────────── */

async function processDairyEvent(
  supabase: any,
  farmId: string,
  event: DairyOfflineEvent
): Promise<boolean> {
  const { entityType, referenceId, payload, eventId, isoTimestamp } = event
  const ts = new Date(isoTimestamp).getTime()

  try {
    switch (entityType) {
      /* ───────────── MILK (LWW per cow per day) ───────────── */
      case "milk_record": {
        const { data: existing } = await supabase
          .from("milk_records")
          .select("id, created_at")
          .eq("cow_id", referenceId)
          .eq("record_date", payload.record_date)
          .maybeSingle()

        if (!existing) {
          await supabase.from("milk_records").insert({
            id: eventId, farm_id: farmId, cow_id: referenceId, ...payload,
          })
        } else if (ts > new Date(existing.created_at).getTime()) {
          await supabase.from("milk_records").update(payload).eq("id", existing.id)
        }
        return true
      }

      /* ───────────── COW REGISTRATION (append-only) ───────────── */
      case "cow_registration": {
        const { data: exists } = await supabase
          .from("cows").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("cows").insert({ id: eventId, farm_id: farmId, ...payload })
        }
        return true
      }

      /* ───────────── BREEDING (append-only) ───────────── */
      case "breeding_event": {
        const { data: exists } = await supabase
          .from("breeding_events").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("breeding_events").insert({
            id: eventId, farm_id: farmId, cow_id: referenceId, ...payload,
          })
        }
        return true
      }

      /* ───────────── HEALTH CHECK (append-only) ───────────── */
      case "health_check": {
        const { data: exists } = await supabase
          .from("health_records").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("health_records").insert({
            id: eventId, farm_id: farmId, cow_id: referenceId, ...payload,
          })
        }
        return true
      }

      /* ───────────── MILK SALE (append-only) ───────────── */
      case "milk_sale": {
        const { data: exists } = await supabase
          .from("milk_sales").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("milk_sales").insert({
            id: eventId, farm_id: farmId, cow_id: referenceId ?? null, ...payload,
          })
        }
        return true
      }

      default:
        console.warn("Unknown dairy event type:", entityType)
        return true
    }
  } catch (err) {
    console.error("Dairy sync error:", err)
    return false
  }
}

/* ─────────────────────────────────────────────── */
/* COFFEE SYNC                                    */
/* ─────────────────────────────────────────────── */

async function processCoffeeEvent(
  supabase: any,
  farmId: string,
  event: CoffeeOfflineEvent
): Promise<boolean> {
  const { entityType, referenceId, payload, eventId, isoTimestamp } = event
  const ts = new Date(isoTimestamp).getTime()

  try {
    switch (entityType) {
      /* ───────────── ACTIVITY / SPRAY / PRUNING (append-only) ───────────── */
      case "coffee_activity":
      case "coffee_spray_event":
      case "coffee_pruning": {
        const { data: exists } = await supabase
          .from("coffee_activities").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("coffee_activities").insert({
            id: eventId, farm_id: farmId, plot_id: referenceId,
            activity_type: payload.activity_type ?? entityType.replace("coffee_", ""),
            ...payload,
          })
        }
        return true
      }

      /* ───────────── HARVEST (append-only) ─────────────
       * Mirrors app/dashboard/coffee/harvest/actions.ts's recordHarvest:
       * coffee_harvests.plot_name is NOT NULL but isn't sent by the client
       * (client only has plot_id) — must resolve it here before insert, same
       * as the online path does. This case existed before any client ever
       * queued a coffee_harvest event; without this fix it would have
       * failed the constraint on the very first real offline harvest sync. */
      case "coffee_harvest": {
        const { data: exists } = await supabase
          .from("coffee_harvests").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          const { data: plot } = await supabase
            .from("coffee_plots").select("plot_name").eq("id", referenceId).maybeSingle()
          if (!plot) return false // plot not found — don't insert with a null plot_name

          await supabase.from("coffee_harvests").insert({
            id: eventId,
            farm_id: farmId,
            plot_name: plot.plot_name,
            harvest_year: new Date(payload.harvest_date).getFullYear(),
            ...payload,
          })
        }
        return true
      }

      /* ───────────── SCOUTING (append-only) ─────────────
       * Mirrors disease/actions.ts's recordScouting — a straight insert,
       * client already sends farm_id and plot_id inside payload. */
      case "coffee_scouting": {
        const { data: exists } = await supabase
          .from("coffee_scouting_records").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("coffee_scouting_records").insert({
            id: eventId, ...payload,
          })
        }
        return true
      }

      /* ───────────── FINANCE TRANSACTION (append-only) ─────────────
       * Mirrors finance/actions.ts's addTransaction — farm_id comes from
       * the verified farm context resolved above, not the client payload. */
      case "coffee_finance_transaction": {
        const { data: exists } = await supabase
          .from("coffee_financials").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("coffee_financials").insert({
            id: eventId, farm_id: farmId, ...payload,
          })
        }
        return true
      }

      /* ───────────── PLOT CREATE (append-only) ─────────────
       * Mirrors plots/actions.ts's addCoffeePlot. The client generates the
       * id offline (eventId) so it can navigate/reference the plot before
       * sync ever runs. */
      case "coffee_plot_create": {
        const { data: exists } = await supabase
          .from("coffee_plots").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("coffee_plots").insert({
            id: eventId, farm_id: farmId, ...payload,
          })
        }
        return true
      }

      /* ───────────── PLOT UPDATE (LWW) ─────────────
       * Mirrors plots/actions.ts's updateCoffeePlot. referenceId is the
       * existing plot id being edited. */
      case "coffee_plot_update": {
        const { data: plot } = await supabase
          .from("coffee_plots").select("updated_at").eq("id", referenceId).maybeSingle()
        if (!plot) return false

        if (ts > new Date(plot.updated_at).getTime()) {
          await supabase.from("coffee_plots")
            .update({ ...payload, updated_at: isoTimestamp })
            .eq("id", referenceId)
        }
        return true
      }

      default:
        console.warn("Unknown coffee event type:", entityType)
        return true
    }
  } catch (err) {
    console.error("Coffee sync error:", err)
    return false
  }
}

/* ─────────────────────────────────────────────── */
/* SMALL RUMINANT SYNC                            */
/* ─────────────────────────────────────────────── */

async function processSmallRuminantEvent(
  supabase: any,
  farmId: string,
  event: SmallRuminantOfflineEvent
): Promise<boolean> {
  const { entityType, referenceId, payload, eventId } = event

  try {
    switch (entityType) {
      case "small_ruminant_health": {
        const { data: exists } = await supabase
          .from("small_ruminant_health").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("small_ruminant_health").insert({
            id: eventId, animal_id: referenceId, ...payload,
          })
        }
        return true
      }

      /* ───────────── WEIGHT (append-only + ADG calc) ─────────────
       * Mirrors weights/actions.ts's recordWeight: average_daily_gain is
       * computed server-side from the animal's most recent prior weigh-in,
       * never sent by the client. Without this the offline path would
       * insert weight_kg/body_condition_score/notes but silently skip ADG
       * on every offline-recorded weight — a quiet accuracy gap the farmer
       * would have no way to notice from the UI. */
      case "small_ruminant_weight": {
        const { data: exists } = await supabase
          .from("weight_records").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          const { data: prevWeight } = await supabase
            .from("weight_records")
            .select("weight_kg, record_date")
            .eq("animal_id", referenceId)
            .order("record_date", { ascending: false })
            .limit(1)
            .maybeSingle()

          let adg: number | null = null
          if (prevWeight) {
            const days = (new Date(payload.record_date).getTime() - new Date(prevWeight.record_date).getTime()) / 86_400_000
            if (days > 0) {
              adg = (payload.weight_kg - prevWeight.weight_kg) / days
            }
          }

          await supabase.from("weight_records").insert({
            id: eventId, animal_id: referenceId, ...payload, average_daily_gain: adg,
          })
        }
        return true
      }

      /* ───────────── SALE (append-only + sold-status side effect) ─────────────
       * Mirrors sales/actions.ts's recordSale: selling a live animal, meat,
       * or breeding stock (anything but a milk sale) also flips the animal's
       * status to "sold". The pre-fix offline path only inserted the sales
       * row, so an offline animal sale left the herd list still showing the
       * animal as active indefinitely (until someone happened to edit it
       * online), risking it being recorded against twice. */
      case "small_ruminant_sale": {
        const { data: exists } = await supabase
          .from("small_ruminant_sales").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("small_ruminant_sales").insert({
            id: eventId, farm_id: farmId, animal_id: referenceId, ...payload,
          })

          if (payload.sale_type !== "milk" && referenceId) {
            await supabase.from("small_ruminants").update({ status: "sold" }).eq("id", referenceId)
          }
        }
        return true
      }

      /* ───────────── BREEDING SERVICE (append-only) ─────────────
       * Mirrors breeding/actions.ts's recordBreedingService — a straight
       * insert, referenceId is the dam being served. */
      case "small_ruminant_breeding": {
        const { data: exists } = await supabase
          .from("small_ruminant_breeding").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("small_ruminant_breeding").insert({
            id: eventId, dam_id: referenceId, ...payload,
          })
        }
        return true
      }

      /* ───────────── MILK (append-only) ─────────────
       * Mirrors milk/add/page.tsx's direct insert into goat_milk_records.
       * total_milk is a GENERATED ALWAYS column on the live table (same bug
       * class as coffee_activities.total_cost) so it must never be sent —
       * the client-side payload already omits it. */
      case "small_ruminant_milk": {
        const { data: exists } = await supabase
          .from("goat_milk_records").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("goat_milk_records").insert({
            id: eventId, animal_id: referenceId, ...payload,
          })
        }
        return true
      }

      /* ───────────── REGISTRATION (append-only) ─────────────
       * Mirrors add/page.tsx's registerAnimal insert into small_ruminants.
       * Like coffee_plot_create, the client generates the id offline
       * (eventId) so the new animal can be referenced (e.g. for a follow-up
       * offline weight/health record in the same session) before sync ever
       * runs. */
      case "small_ruminant_registration": {
        const { data: exists } = await supabase
          .from("small_ruminants").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("small_ruminants").insert({
            id: eventId, farm_id: farmId, ...payload,
          })
        }
        return true
      }

      /* ───────────── KIDDING / LAMBING (append + breeding-record update) ─────────────
       * Mirrors breeding/kidding/actions.ts's recordKidding (as fixed
       * alongside this sync handler — see actions.ts for the
       * breeding_id → breeding_event_id column-name correction).
       * referenceId is the small_ruminant_breeding record id being closed
       * out; payload carries the kidding_lambing_records fields plus
       * number_of_offspring, which belongs on the breeding record, not the
       * kidding record itself. */
      case "small_ruminant_kidding": {
        const { number_of_offspring, ...kiddingFields } = payload

        const { data: exists } = await supabase
          .from("kidding_lambing_records").select("id").eq("id", eventId).maybeSingle()
        if (!exists) {
          await supabase.from("kidding_lambing_records").insert({
            id: eventId,
            dam_id: kiddingFields.dam_id,
            delivery_date: kiddingFields.delivery_date,
            breeding_event_id: referenceId,
            ...kiddingFields,
          })

          await supabase.from("small_ruminant_breeding").update({
            actual_delivery_date: kiddingFields.delivery_date,
            number_of_offspring: number_of_offspring ?? undefined,
          }).eq("id", referenceId)
        }
        return true
      }

      default:
        console.warn("Unknown small ruminant event type:", entityType)
        return true
    }
  } catch (err) {
    console.error("Small ruminant sync error:", err)
    return false
  }
}

/* ─────────────────────────────────────────────── */

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
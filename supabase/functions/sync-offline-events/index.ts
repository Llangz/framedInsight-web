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
    const { user_id, poultryEvents } = body

    if (!user_id || !Array.isArray(poultryEvents)) {
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

    const results: Result[] = []

    // ── Process events in deterministic order ────────
    const sorted = [...poultryEvents].sort(
      (a, b) => new Date(a.isoTimestamp).getTime() - new Date(b.isoTimestamp).getTime()
    )

    for (const event of sorted) {
      const res = await processPoultryEvent(supabase, farmId, event)
      results.push({
        eventId: event.eventId,
        status: res ? "synced" : "failed",
      })
    }

    // ── Log sync audit trail ─────────────────────────
    await supabase.from("farm_events").insert({
      id: crypto.randomUUID(),
      farm_id: farmId,
      event_type: "offline_sync_poultry_v2",
      actor_id: user_id,
      actor_type: "farmer",
      created_at: new Date().toISOString(),
      event_data: {
        total: poultryEvents.length,
        synced: results.filter(r => r.status === "synced").length,
        failed: results.filter(r => r.status === "failed").length,
      },
    })

    return json({ results })
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : "Unknown error",
    }, 500)
  }
})

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

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ============================================================================
// Edge Function: Offline Sync with CRDT Conflict Resolution
//
// Invoked by: OfflineSyncManager.syncPendingChanges()
// Responsibility: Merge offline events into server state using CRDT rules
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

interface OfflineEvent {
  id: string
  device_id: string
  operation_type: "create" | "update" | "delete"
  entity_type: string
  entity_id: string
  payload: Record<string, any>
  timestamp: string
  lamport_clock: number
}

serve(async (req) => {
  // Only POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    })
  }

  try {
    const { device_id, user_id, events } = await req.json()

    if (!user_id || !events || !Array.isArray(events)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user's farm
    const { data: fm } = await supabase
      .from("farm_managers")
      .select("farm_id")
      .eq("user_id", user_id)
      .single()

    if (!fm) {
      return new Response(JSON.stringify({ error: "User not associated with farm" }), {
        status: 403,
      })
    }

    const syncedEventIds: string[] = []
    const conflicts: ConflictResolution[] = []

    // Process each offline event
    for (const event of events as OfflineEvent[]) {
      const result = await processEvent(supabase, fm.farm_id, event)

      if (result.status === "synced") {
        syncedEventIds.push(event.id)
      } else if (result.status === "conflict") {
        conflicts.push(result.conflict!)
      }
    }

    // Log this sync operation
    await supabase.from("farm_events").insert({
      id: crypto.randomUUID(),
      farm_id: fm.farm_id,
      event_type: "offline_data_synced",
      actor_id: user_id,
      actor_type: "farmer",
      created_at: new Date().toISOString(),
      event_data: {
        device_id,
        events_synced: syncedEventIds.length,
        sync_duration_ms: 0,
        conflicts_resolved: conflicts.length,
        sync_method: "crdt",
      },
    })

    return new Response(
      JSON.stringify({
        synced_event_ids: syncedEventIds,
        conflicts: conflicts,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    )
  }
})

/**
 * Process a single offline event, applying CRDT rules
 */
async function processEvent(
  supabase: any,
  farmId: string,
  event: OfflineEvent
): Promise<
  | { status: "synced" }
  | {
      status: "conflict"
      conflict: ConflictResolution
    }
> {
  const { operation_type, entity_type, entity_id, payload, timestamp } = event

  switch (entity_type) {
    // ─── HARVEST RECORDS ──────────────────────────────────────────────────
    case "harvest": {
      // Check if this harvest already exists
      const { data: existing } = await supabase
        .from("coffee_harvests")
        .select("*")
        .eq("id", entity_id)
        .maybeSingle()

      if (operation_type === "create" && !existing) {
        // New harvest, just insert
        await supabase.from("coffee_harvests").insert({
          id: entity_id,
          farm_id: farmId,
          ...payload,
        })
        return { status: "synced" }
      } else if (operation_type === "update" && existing) {
        // Update exists → check for conflicts on numeric fields
        const conflicts = []

        // CRDT Rule: For counters (cherry_kg, parchment_kg), use LWW
        if (payload.cherry_kg !== undefined && payload.cherry_kg !== existing.cherry_kg) {
          const localTimestamp = new Date(timestamp)
          const remoteTimestamp = new Date(existing.updated_at)

          if (localTimestamp > remoteTimestamp) {
            // Local is newer, apply
            await supabase
              .from("coffee_harvests")
              .update({ cherry_kg: payload.cherry_kg })
              .eq("id", entity_id)
          } else {
            // Conflict: both modified
            conflicts.push({
              field: "cherry_kg",
              local_value: payload.cherry_kg,
              remote_value: existing.cherry_kg,
              local_timestamp: timestamp,
              remote_timestamp: existing.updated_at,
            })
          }
        }

        if (conflicts.length > 0) {
          return {
            status: "conflict",
            conflict: conflicts[0],
          }
        }

        return { status: "synced" }
      }
      break
    }

    // ─── MILK RECORDS ─────────────────────────────────────────────────────
    case "milk_record": {
      const { data: existing } = await supabase
        .from("dairy_records")
        .select("*")
        .eq("id", entity_id)
        .maybeSingle()

      if (operation_type === "create" && !existing) {
        await supabase.from("dairy_records").insert({
          id: entity_id,
          farm_id: farmId,
          ...payload,
        })
        return { status: "synced" }
      } else if (operation_type === "update" && existing) {
        // CRDT: LWW for milk_liters
        if (
          payload.milk_liters !== undefined &&
          payload.milk_liters !== existing.milk_liters
        ) {
          const localTs = new Date(timestamp)
          const remoteTs = new Date(existing.updated_at)

          if (localTs > remoteTs) {
            await supabase
              .from("dairy_records")
              .update({ milk_liters: payload.milk_liters })
              .eq("id", entity_id)
            return { status: "synced" }
          } else {
            // Conflict
            return {
              status: "conflict",
              conflict: {
                field: "milk_liters",
                local_value: payload.milk_liters,
                remote_value: existing.milk_liters,
                local_timestamp: timestamp,
                remote_timestamp: existing.updated_at,
                entity_id,
              },
            }
          }
        }
        return { status: "synced" }
      }
      break
    }

    // ─── PHOTOS ───────────────────────────────────────────────────────────
    case "photo_evidence": {
      // CRDT Rule: Photos are append-only
      // Just add new photos, never remove or modify
      if (operation_type === "create") {
        await supabase.from("eudr_evidence_photos").insert({
          id: entity_id,
          farm_id: farmId,
          ...payload,
        })
        return { status: "synced" }
      }
      break
    }

    // ─── DEFAULT ──────────────────────────────────────────────────────────
    default:
      console.warn(`Unknown entity type: ${entity_type}`)
      return { status: "synced" } // Don't block sync
  }

  return { status: "synced" }
}

interface ConflictResolution {
  entity_id: string
  field: string
  local_value: any
  remote_value: any
  local_timestamp: string
  remote_timestamp: string
}

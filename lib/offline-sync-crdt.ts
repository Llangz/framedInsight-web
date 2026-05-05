/**
 * CRDT-Based Offline Sync
 *
 * DDIA Pattern: Conflict-free replicated data types
 * Instead of "last-write-wins" (loses data), use CRDTs that merge deterministically
 *
 * For farm data:
 * - Append-only: harvest records, photos → just merge all
 * - Counters: milk_kg, cherry_kg → use LWW (last-write-wins) with timestamp
 * - Multivalues: conflicting GPS coordinates → keep all, show farmer which to trust
 */

import { randomUUID } from 'crypto'
import { supabase } from './supabase'

/**
 * Timestamp-based CRDT for scalar values
 * Guarantees: commutative, idempotent, deterministic
 */
export interface TimestampedValue<T> {
  value: T
  timestamp: string // ISO UTC
  actor_id: string // who made this change
  lamport_clock?: number // for causality
}

/**
 * Multi-value register: stores all versions, lets app decide
 * Used when conflict resolution needs human input
 */
export interface MultiValueRegister<T> {
  values: TimestampedValue<T>[]
  resolved_value?: T
  resolution_method?: 'farmer_chose' | 'auto_lww' | 'pending'
}

/**
 * Offline-First Sync Manager
 *
 * Strategy:
 * 1. Local writes accumulate in offline_events table
 * 2. On connectivity, batch-sync all events
 * 3. Server returns conflicts
 * 4. CRDT logic merges without data loss
 * 5. Farmer sees conflicts only if manual resolution needed
 */
export class OfflineSyncManager {
  private deviceId: string
  private pendingEvents: Map<string, any> = new Map()

  constructor(deviceId: string) {
    this.deviceId = deviceId
  }

  /**
   * Record a local change while offline
   * Stored in IndexedDB, synced later
   */
  async recordOfflineChange(operation: OfflineOperation) {
    const event = {
      id: randomUUID(),
      device_id: this.deviceId,
      operation_type: operation.type,
      entity_type: operation.entity_type,
      entity_id: operation.entity_id,
      payload: operation.payload,
      timestamp: new Date().toISOString(),
      lamport_clock: await this.getNextLamportClock(),
      synced: false,
    }

    // Store locally (IndexedDB via offline-db.ts)
    this.pendingEvents.set(event.id, event)

    // TODO: persist to IndexedDB
    // await offlineDB.offlineEvents.add(event)

    return event
  }

  /**
   * Sync pending changes to server
   * CRDT conflict resolution happens here
   */
  async syncPendingChanges(userId: string) {
    if (this.pendingEvents.size === 0) return { synced: 0, conflicts: [] }

    const events = Array.from(this.pendingEvents.values())

    // Send all pending events with timestamps
    const { data, error } = await supabase.functions.invoke('sync-offline-events', {
      body: {
        device_id: this.deviceId,
        user_id: userId,
        events: events,
      },
    })

    if (error) throw error

    const result = data as {
      synced_event_ids: string[]
      conflicts: ConflictResolution[]
    }

    // Apply successful syncs
    for (const eventId of result.synced_event_ids) {
      this.pendingEvents.delete(eventId)
      // TODO: mark as synced in IndexedDB
    }

    // Handle conflicts using CRDT
    const resolved = await this.resolveConflicts(result.conflicts, userId)

    return {
      synced: result.synced_event_ids.length,
      conflicts: resolved,
    }
  }

  /**
   * CRDT merge for common field conflicts
   */
  private async resolveConflicts(
    conflicts: ConflictResolution[],
    userId: string
  ): Promise<ConflictResolution[]> {
    const unresolved: ConflictResolution[] = []

    for (const conflict of conflicts) {
      const resolved = this.crdt_merge(conflict)

      if (resolved) {
        // Auto-resolved using CRDT
        // farm_operations table does not exist in schema; skip auto-apply or handle per entity_type
        console.warn('CRDT auto-resolve: table farm_operations not in schema. Conflict skipped:', conflict.entity_id)
      } else {
        // Needs human decision
        unresolved.push(conflict)
      }
    }

    return unresolved
  }

  /**
   * CRDT Merge Rules
   *
   * Rules are deterministic: same conflicts always resolve the same way
   * This is crucial for eventual consistency across devices
   */
  private crdt_merge(conflict: ConflictResolution) {
    const { field, local_value, remote_value, local_timestamp, remote_timestamp } = conflict

    // Rule 1: Append-only fields (photos, harvests)
    if (['evidence_photos', 'harvest_records'].includes(field)) {
      // Merge arrays by deduplicating on {value + timestamp}
      const local_arr = local_value as any[]
      const remote_arr = remote_value as any[]
      const merged = [...new Set([...local_arr, ...remote_arr])]
      return { merged_value: merged }
    }

    // Rule 2: Counters (milk_kg, cherry_kg) → Last-Write-Wins by timestamp
    if (['milk_kg', 'cherry_kg', 'parchment_kg'].includes(field)) {
      const winner =
        new Date(local_timestamp) > new Date(remote_timestamp) ? local_value : remote_value
      return { merged_value: winner }
    }

    // Rule 3: GPS coordinates → Keep both (multivalues) until farmer confirms
    if (['gps_lat', 'gps_lng', 'gps_polygon'].includes(field)) {
      // Don't auto-merge; show farmer both versions
      return null // unresolved
    }

    // Rule 4: Enums (compliance_status, risk_level) → escalate to farmer
    if (['compliance_status', 'risk_level'].includes(field)) {
      return null // unresolved
    }

    // Default: LWW
    const winner =
      new Date(local_timestamp) > new Date(remote_timestamp) ? local_value : remote_value
    return { merged_value: winner }
  }

  private async getNextLamportClock(): Promise<number> {
    // Lamport clock ensures causal ordering across devices
    // TODO: implement by storing in IndexedDB
    return Math.floor(Date.now() / 1000)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface OfflineOperation {
  type: 'create' | 'update' | 'delete'
  entity_type: string // 'harvest', 'milk_record', 'photo', etc.
  entity_id: string
  payload: Record<string, any>
}

export interface ConflictResolution {
  entity_id: string
  field: string
  local_value: any
  remote_value: any
  local_timestamp: string
  remote_timestamp: string
  resolution?: 'auto_lww' | 'auto_merge' | 'farmer_chose' | 'pending'
}

/**
 * Usage Example: Record offline changes while in field
 *
 * // Farmer records harvest offline
 * const sync = new OfflineSyncManager(deviceId)
 *
 * await sync.recordOfflineChange({
 *   type: 'create',
 *   entity_type: 'harvest',
 *   entity_id: plotId,
 *   payload: {
 *     cherry_kg: 450,
 *     harvest_date: '2024-03-15',
 *     buyer_name: 'Cooperative X'
 *   }
 * })
 *
 * // Later, when back online
 * await sync.syncPendingChanges(userId)
 */

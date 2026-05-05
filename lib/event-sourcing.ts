/**
 * Event Sourcing Layer
 *
 * DDIA Pattern: Store immutable events as single source of truth
 * Benefits:
 * - Audit trail (compliance requirement for EUDR)
 * - Ability to replay/debug farmer disputes
 * - Exactly-once processing (idempotent, no double-charges)
 * - Natural fit with offline-first (accumulate events locally, replay on sync)
 */

import { supabase } from './supabase'
import { Database } from './database.types'

export type FarmEvent =
  | PlotBoundaryRecordedEvent
  | EudrAssessmentRunEvent
  | PhotoEvidenceUploadedEvent
  | HarvestRecordedEvent
  | DiseaseReportedEvent
  | PlotCreatedEvent
  | OfflineDataSyncedEvent

export interface BaseEvent {
  id: string
  farm_id: string
  event_type: string
  actor_id: string // who triggered this (farmer, system, auditor)
  actor_type: 'farmer' | 'system' | 'auditor'
  created_at: string // UTC ISO
  created_offline?: boolean // was this created while offline?
  client_timestamp?: string // when farmer's device recorded it
  idempotency_key?: string // for deduplication on sync
}

export interface PlotBoundaryRecordedEvent extends BaseEvent {
  event_type: 'plot_boundary_recorded'
  event_data: {
    plot_id: string
    gps_points: Array<{ lat: number; lng: number; timestamp: string }>
    area_hectares: number
    boundary_method: 'walk' | 'manual_input' | 'imported_geojson'
  }
}

export interface EudrAssessmentRunEvent extends BaseEvent {
  event_type: 'eudr_assessment_run'
  event_data: {
    plot_id: string
    assessment_service: 'afa_api' | 'sentinel' | 'internal_ml' | 'manual'
    risk_level: 'low' | 'medium' | 'high'
    forest_cover_pct: number
    deforestation_detected_since: '2020-12-31' | null
    api_response: Record<string, any>
    assessment_duration_ms: number
  }
}

export interface PhotoEvidenceUploadedEvent extends BaseEvent {
  event_type: 'photo_evidence_uploaded'
  event_data: {
    plot_id: string
    photo_url: string
    gps_lat: number
    gps_lng: number
    captured_at: string // UTC ISO when farmer took photo
    file_size_bytes: number
    photo_hash: string // SHA256 for integrity verification
    farmer_notes?: string
  }
}

export interface HarvestRecordedEvent extends BaseEvent {
  event_type: 'harvest_recorded'
  event_data: {
    plot_id: string
    cherry_kg: number
    harvest_date: string
    buyer_name?: string
    price_per_kg?: number
  }
}

export interface PlotCreatedEvent extends BaseEvent {
  event_type: 'plot_created'
  event_data: {
    plot_id: string
    plot_name: string
    variety: string
    area_hectares: number
    altitude_m?: number
    shade_percentage?: number
    county: string
    constituency: string
    ward: string
  }
}

export interface DiseaseReportedEvent extends BaseEvent {
  event_type: 'disease_reported'
  event_data: {
    plot_id: string
    disease_name: string
    severity_level: 'low' | 'medium' | 'high' | 'critical'
    affected_percentage: number
    treatment_applied?: string
    treatment_date?: string
    resulting_losses_kg?: number
    notes?: string
    photo_url?: string
  }
}

export interface OfflineDataSyncedEvent extends BaseEvent {
  event_type: 'offline_data_synced'
  event_data: {
    device_id: string
    events_synced: number
    sync_duration_ms: number
    conflicts_resolved: number
    sync_method: 'full_overwrite' | 'merge_on_timestamp' | 'crdt'
  }
}

/**
 * Event Store: Append-only log
 * This is the single source of truth
 */
export class EventStore {
  async recordEvent(event: Omit<FarmEvent, 'id'> & { id?: string }) {
    const eventId = event.id || crypto.randomUUID()
    const { data, error } = await supabase
      .from('farm_events')
      .insert({
        id: eventId,
        farm_id: event.farm_id,
        plot_id: (event as any).event_data?.plot_id,
        event_type: event.event_type,
        event_data: event,
        actor_id: event.actor_id,
        actor_type: event.actor_type,
        created_at: event.created_at,
        created_at_unix: new Date(event.created_at).getTime(),
        synced_to_server: !(event.created_offline ?? false),
      })
      .select()

    if (error) throw error
    return data?.[0]
  }

  /**
   * Get audit trail for a plot (compliance requirement)
   */
  async getPlotAuditTrail(plotId: string) {
    const { data, error } = await supabase
      .from('farm_events')
      .select('*')
      .eq('plot_id', plotId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data as unknown as FarmEvent[]
  }

  /**
   * Replay events to rebuild state (for debugging)
   */
  async replayEvents(farmId: string, upTo?: string) {
    let query = supabase
      .from('farm_events')
      .select('*')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: true })

    if (upTo) {
      query = query.lte('created_at', upTo)
    }

    const { data, error } = await query
    if (error) throw error

    const state = {
      plots: new Map(),
      eudr: new Map(),
      harvests: [],
    }

    for (const event of (data as unknown as FarmEvent[])) {
      applyEvent(state, event)
    }

    return state
  }

  /**
   * Idempotent event recording (prevent duplicates on sync retry)
   */
  async recordEventIdempotent(event: FarmEvent & { idempotency_key: string }) {
    // Use idempotency_key as event id for deduplication (farm_events has no separate idempotency_key column)
    const eventId = event.idempotency_key
    const { data: existing } = await supabase
      .from('farm_events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle()

    if (existing) return existing // already recorded, skip

    return this.recordEvent({ ...event, id: eventId } as any)
  }
}

/**
 * Event Projection: Apply events to build current state
 * This is read-optimized (materialized view logic)
 */
function applyEvent(state: any, event: FarmEvent) {
  switch (event.event_type) {
    case 'plot_boundary_recorded': {
      const e = event as PlotBoundaryRecordedEvent
      state.plots.set(e.event_data.plot_id, {
        area_hectares: e.event_data.area_hectares,
        boundary_method: e.event_data.boundary_method,
        updated_at: event.created_at,
      })
      break
    }

    case 'plot_created': {
      const e = event as PlotCreatedEvent
      state.plots.set(e.event_data.plot_id, {
        plot_name: e.event_data.plot_name,
        variety: e.event_data.variety,
        area_hectares: e.event_data.area_hectares,
        created_at: event.created_at,
      })
      break
    }

    case 'eudr_assessment_run': {
      const e = event as EudrAssessmentRunEvent
      state.eudr.set(e.event_data.plot_id, {
        risk_level: e.event_data.risk_level,
        forest_cover_pct: e.event_data.forest_cover_pct,
        assessment_date: event.created_at,
        assessment_service: e.event_data.assessment_service,
      })
      break
    }

    case 'harvest_recorded': {
      const e = event as HarvestRecordedEvent
      state.harvests.push({
        plot_id: e.event_data.plot_id,
        cherry_kg: e.event_data.cherry_kg,
        harvest_date: e.event_data.harvest_date,
        recorded_at: event.created_at,
      })
      break
    }

    case 'disease_reported': {
      const e = event as DiseaseReportedEvent
      if (!state.diseases) state.diseases = []
      state.diseases.push({
        plot_id: e.event_data.plot_id,
        disease_name: e.event_data.disease_name,
        severity_level: e.event_data.severity_level,
        reported_at: event.created_at,
      })
      break
    }
  }
}

/**
 * Aggregate Root: Business logic that enforces rules
 */
export class PlotAggregate {
  constructor(private plotId: string, private farmId: string) {}

  async recordBoundary(gpsPoints: Array<{ lat: number; lng: number; timestamp: string }>) {
    // Business rule: at least 4 points for valid polygon
    if (gpsPoints.length < 4) {
      throw new Error('Need at least 4 GPS points to form valid boundary')
    }

    const area = calculatePolygonArea(gpsPoints)

    const event: PlotBoundaryRecordedEvent = {
      id: crypto.randomUUID(),
      farm_id: this.farmId,
      event_type: 'plot_boundary_recorded',
      actor_id: '', // set by caller
      actor_type: 'farmer',
      created_at: new Date().toISOString(),
      event_data: {
        plot_id: this.plotId,
        gps_points: gpsPoints,
        area_hectares: area,
        boundary_method: 'walk',
      },
    }

    await new EventStore().recordEvent(event)
    return event
  }

  async runEudrAssessment(service: 'afa_api' | 'sentinel' | 'internal_ml' = 'afa_api') {
    // Business rule: can only assess plots with recorded boundaries
    const { data: plot } = await supabase
      .from('coffee_plots')
      .select('gps_polygon')
      .eq('id', this.plotId)
      .maybeSingle()

    if (!plot?.gps_polygon) {
      throw new Error('Plot boundary required before EUDR assessment')
    }

    // Call assessment service
    const assessment = await assessEudrRisk(this.plotId, service)

    const event: EudrAssessmentRunEvent = {
      id: crypto.randomUUID(),
      farm_id: this.farmId,
      event_type: 'eudr_assessment_run',
      actor_id: '', // set by caller
      actor_type: service === 'afa_api' ? 'system' : 'farmer',
      created_at: new Date().toISOString(),
      event_data: {
        plot_id: this.plotId,
        assessment_service: service,
        risk_level: assessment.risk_level,
        forest_cover_pct: assessment.forest_cover_pct,
        deforestation_detected_since: assessment.deforestation_detected_since,
        api_response: assessment.raw_response,
        assessment_duration_ms: assessment.duration_ms,
      },
    }

    await new EventStore().recordEvent(event)

    // Now trigger downstream: update compliance table (projection)
    await updateEudrComplianceProjection(this.plotId, this.farmId, event.event_data)

    return event
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function assessEudrRisk(plotId: string, service: string) {
  // TODO: Implement actual assessment logic
  // For now, return mock
  return {
  risk_level: 'low' as 'low' | 'medium' | 'high',
    forest_cover_pct: 0,
    deforestation_detected_since: null,
    raw_response: {},
    duration_ms: 500,
  }
}

async function updateEudrComplianceProjection(plotId: string, farmId: string, assessment: any) {
  await supabase
    .from('coffee_eudr_compliance')
    .upsert({
      plot_id: plotId,
      farm_id: farmId,                              // required
      assessment_date: new Date().toISOString().split('T')[0], // required
      risk_level: assessment.risk_level,
      forest_cover_pct: assessment.forest_cover_pct,
      updated_at: new Date().toISOString(),
    })
}

function calculatePolygonArea(points: Array<{ lat: number; lng: number }>): number {
  // Haversine formula to calculate polygon area in hectares
  // TODO: implement properly using geospatial lib
  return 1.5 // mock
}

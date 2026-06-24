/**
 * lib/passport/passport.service.ts
 *
 * Core business logic for the Coffee Digital Passport platform.
 * Runs server-side only. Assembles the full chain:
 *   delivery → processing_batch → mill_lot → export_lot → coffee_passport
 *
 * Also writes all traceability_events (the immutable audit ledger).
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublicStory {
  region: string
  county: string
  factory: string
  cooperative: string
  altitude_m?: number
  varieties: string[]
  processing: string
  harvest_season: string
  farm_count: number
  female_farmer_pct?: number
  avg_farm_size_acres?: number
  hero_image_url?: string
  farmer_story?: string
  tasting_notes?: string
}

export interface SustainabilityMetrics {
  eudr_compliant: boolean
  deforestation_free_plots_pct: number
  organic_certified: boolean
  rainforest_alliance: boolean
  fair_trade: boolean
  avg_forest_cover_pct?: number
  total_plot_area_acres?: number
  chemical_inputs?: string[]
}

export interface QualityMetrics {
  sca_score?: number
  cupper_name?: string
  cupping_date?: string
  flavor_notes?: string
  aroma?: number
  acidity?: number
  body?: number
  grade: string
  moisture_pct?: number
  certifications?: string[]
}

export interface GeoSummary {
  centroid_lat?: number
  centroid_lng?: number
  plot_count: number
  factory_lat?: number
  factory_lng?: number
  export_port: string
}

// ── Hash helper ──────────────────────────────────────────────────────────────

function computeHash(
  entityId: string,
  eventType: string,
  eventData: object,
  previousHash: string | null,
  createdAt: string
): string {
  const payload = JSON.stringify({
    entityId,
    eventType,
    eventData,
    previousHash: previousHash ?? 'GENESIS',
    createdAt,
  })
  return createHash('sha256').update(payload).digest('hex')
}

// ── Write a traceability event ───────────────────────────────────────────────

export async function writeTraceabilityEvent({
  entityType,
  entityId,
  cooperativeId,
  actorUserId,
  actorName,
  eventType,
  eventData,
}: {
  entityType: string
  entityId: string
  cooperativeId: string
  actorUserId?: string
  actorName?: string
  eventType: string
  eventData: object
}): Promise<void> {
  const supabase = await createClient()

  // Get the previous hash for this entity chain
  const { data: last } = await supabase
    .from('traceability_events')
    .select('current_hash')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousHash = last?.current_hash ?? null
  const now = new Date().toISOString()
  const currentHash = computeHash(entityId, eventType, eventData, previousHash, now)

  await supabase.from('traceability_events').insert({
    entity_type: entityType,
    entity_id: entityId,
    cooperative_id: cooperativeId,
    actor_user_id: actorUserId ?? null,
    actor_name: actorName ?? 'system',
    event_type: eventType,
    event_data: eventData,
    previous_hash: previousHash,
    current_hash: currentHash,
    created_at: now,
  })
}

// ── Assemble passport story from the chain ───────────────────────────────────
/**
 * Given a processing_batch_id, walks the full chain upward and downward
 * to auto-generate the passport's public_story, sustainability_metrics,
 * quality_metrics, and geo_summary from existing data in the system.
 *
 * Officers can then edit/enrich these JSON blobs in the passport editor.
 */
export async function assemblePassportPayload(
  processingBatchId: string,
  cooperativeId: string
): Promise<{
  publicStory: PublicStory
  sustainabilityMetrics: SustainabilityMetrics
  qualityMetrics: QualityMetrics
  geoSummary: GeoSummary
}> {
  const supabase = await createClient()

  // 1. Processing batch
  const { data: batch } = await supabase
    .from('processing_batches')
    .select(`
      *,
      coop_factories (factory_name, factory_code),
      cooperatives (cooperative_name, county, sub_county, ward)
    `)
    .eq('id', processingBatchId)
    .single()

  if (!batch) throw new Error('Processing batch not found')

  // 2. Farmer deliveries → farms → plots for this batch via intake_lot
  const { data: deliveries } = await supabase
    .from('lot_farmer_deliveries')
    .select(`
      farm_id, farmer_cherry_kg, plot_id,
      farms (id, owner_name, land_size_acres, gps_latitude, gps_longitude),
      coffee_plots (variety, gps_latitude, gps_longitude, gps_polygon, land_size_acres, eudr_risk_level, area_hectares)
    `)
    .eq('lot_id', batch.intake_lot_id)
    .eq('accepted', true)

  const deliveryList = deliveries ?? []
  const farmCount = new Set(deliveryList.map(d => d.farm_id)).size

  // 3. EUDR compliance for plots in this batch
  const plotIds = deliveryList.map(d => d.plot_id).filter(Boolean) as string[]
  let eudrRecords: any[] = []
  if (plotIds.length > 0) {
    const { data } = await supabase
      .from('coffee_eudr_compliance')
      .select('risk_level, deforestation_risk, forest_cover_pct, compliance_status')
      .in('plot_id', plotIds)
    eudrRecords = data ?? []
  }

  // 4. Quality records linked to harvest records in this lot
  const harvestIds = deliveryList.map(d => (d as any).harvest_id).filter(Boolean)
  let qualityRecords: any[] = []
  if (harvestIds.length > 0) {
    const { data } = await supabase
      .from('coffee_quality_records')
      .select('*')
      .in('harvest_id', harvestIds)
      .order('cupping_score', { ascending: false })
    qualityRecords = data ?? []
  }

  // ── Compute sustainability metrics ──────────────────────────────────────────

  const totalPlots = plotIds.length
  const lowRiskPlots = eudrRecords.filter(e => e.risk_level === 'low' && !e.deforestation_risk).length
  const deforestationFreePct = totalPlots > 0
    ? Math.round((lowRiskPlots / totalPlots) * 100)
    : 0
  const avgForestCover = eudrRecords.length > 0
    ? eudrRecords.reduce((s, e) => s + (e.forest_cover_pct ?? 0), 0) / eudrRecords.length
    : undefined

  const totalPlotAcres = deliveryList.reduce((s, d) => {
    const acres = (d.coffee_plots as any)?.land_size_acres
      ?? ((d.coffee_plots as any)?.area_hectares ?? 0) * 2.471
    return s + Number(acres)
  }, 0)

  // ── Compute variety breakdown ────────────────────────────────────────────────

  const varietyMap: Record<string, number> = {}
  deliveryList.forEach(d => {
    const v = (d.coffee_plots as any)?.variety
    if (v) varietyMap[v] = (varietyMap[v] ?? 0) + 1
  })
  const varieties = Object.entries(varietyMap)
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v)

  // ── Compute geo summary ─────────────────────────────────────────────────────

  const lats = deliveryList
    .map(d => (d.coffee_plots as any)?.gps_latitude ?? (d.farms as any)?.gps_latitude)
    .filter(Boolean) as number[]
  const lngs = deliveryList
    .map(d => (d.coffee_plots as any)?.gps_longitude ?? (d.farms as any)?.gps_longitude)
    .filter(Boolean) as number[]

  const centroidLat = lats.length > 0 ? lats.reduce((s, v) => s + v, 0) / lats.length : undefined
  const centroidLng = lngs.length > 0 ? lngs.reduce((s, v) => s + v, 0) / lngs.length : undefined

  const factory = batch.coop_factories as any
  const coop = batch.cooperatives as any

  // ── Best quality record ─────────────────────────────────────────────────────

  const bestQuality = qualityRecords[0]

  // ── Assemble ────────────────────────────────────────────────────────────────

  const publicStory: PublicStory = {
    region: coop?.ward ?? coop?.sub_county ?? coop?.county ?? 'Kenya',
    county: coop?.county ?? 'Kenya',
    factory: factory?.factory_name ?? 'Cooperative Factory',
    cooperative: coop?.cooperative_name ?? '',
    varieties: varieties.length > 0 ? varieties : ['Unknown'],
    processing: batch.washing_date ? 'Fully Washed' : 'Natural',
    harvest_season: `${batch.season === 'main' ? 'Main Crop' : 'Fly Crop'} ${batch.harvest_year ?? new Date().getFullYear()}`,
    farm_count: farmCount,
    avg_farm_size_acres: totalPlotAcres > 0 && farmCount > 0
      ? Math.round((totalPlotAcres / farmCount) * 10) / 10
      : undefined,
    tasting_notes: bestQuality?.flavor_notes ?? undefined,
  }

  const sustainabilityMetrics: SustainabilityMetrics = {
    eudr_compliant: deforestationFreePct === 100,
    deforestation_free_plots_pct: deforestationFreePct,
    organic_certified: bestQuality?.organic_certified ?? false,
    rainforest_alliance: bestQuality?.rainforest_alliance ?? false,
    fair_trade: bestQuality?.fair_trade_certified ?? false,
    avg_forest_cover_pct: avgForestCover ? Math.round(avgForestCover * 10) / 10 : undefined,
    total_plot_area_acres: Math.round(totalPlotAcres * 10) / 10,
  }

  const qualityMetrics: QualityMetrics = {
    sca_score: bestQuality?.cupping_score ?? undefined,
    cupper_name: bestQuality?.cupper_name ?? undefined,
    cupping_date: bestQuality?.cupping_date ?? undefined,
    flavor_notes: bestQuality?.flavor_notes ?? undefined,
    aroma: bestQuality?.aroma_score ?? undefined,
    acidity: bestQuality?.acidity_score ?? undefined,
    body: bestQuality?.body_score ?? undefined,
    grade: 'AB',
    moisture_pct: batch.moisture_content_pct ?? undefined,
    certifications: [
      bestQuality?.organic_certified && 'Organic',
      bestQuality?.utz_certified && 'UTZ',
      bestQuality?.rainforest_alliance && 'Rainforest Alliance',
      bestQuality?.fair_trade_certified && 'Fair Trade',
    ].filter(Boolean) as string[],
  }

  const geoSummary: GeoSummary = {
    centroid_lat: centroidLat,
    centroid_lng: centroidLng,
    plot_count: totalPlots || farmCount,
    export_port: 'Mombasa',
  }

  return { publicStory, sustainabilityMetrics, qualityMetrics, geoSummary }
}

// ── Create a new passport ────────────────────────────────────────────────────

export async function createPassport({
  cooperativeId,
  processingBatchId,
  exportLotId,
  actorUserId,
  overrides,
}: {
  cooperativeId: string
  processingBatchId: string
  exportLotId?: string
  actorUserId: string
  overrides?: {
    publicStory?: Partial<PublicStory>
    sustainabilityMetrics?: Partial<SustainabilityMetrics>
    qualityMetrics?: Partial<QualityMetrics>
  }
}): Promise<{ passportCode: string; passportId: string }> {
  const supabase = await createClient()

  // Generate the code via the DB function
  const { data: codeData } = await supabase
    .rpc('generate_passport_code', { p_cooperative_id: cooperativeId })
  const passportCode = codeData as string

  // Assemble the payload from the chain
  const { publicStory, sustainabilityMetrics, qualityMetrics, geoSummary } =
    await assemblePassportPayload(processingBatchId, cooperativeId)

  const mergedStory = { ...publicStory, ...(overrides?.publicStory ?? {}) }
  const mergedSustain = { ...sustainabilityMetrics, ...(overrides?.sustainabilityMetrics ?? {}) }
  const mergedQuality = { ...qualityMetrics, ...(overrides?.qualityMetrics ?? {}) }

  const traceUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://framed-insight-web.vercel.app'}/trace/${passportCode}`

  const { data: passport, error } = await supabase
    .from('coffee_passports')
    .insert({
      cooperative_id: cooperativeId,
      export_lot_id: exportLotId ?? null,
      passport_code: passportCode,
      qr_url: traceUrl,
      status: 'draft',
      public_story: mergedStory,
      sustainability_metrics: mergedSustain,
      quality_metrics: mergedQuality,
      geo_summary: geoSummary,
    })
    .select('id, passport_code')
    .single()

  if (error || !passport) throw new Error(error?.message ?? 'Failed to create passport')

  // Write genesis event to ledger
  await writeTraceabilityEvent({
    entityType: 'coffee_passport',
    entityId: passport.id,
    cooperativeId,
    actorUserId,
    actorName: 'system',
    eventType: 'passport_created',
    eventData: {
      passport_code: passportCode,
      processing_batch_id: processingBatchId,
      export_lot_id: exportLotId ?? null,
      farm_count: mergedStory.farm_count,
      varieties: mergedStory.varieties,
      eudr_compliant: mergedSustain.eudr_compliant,
    },
  })

  return { passportCode, passportId: passport.id }
}

// ── Publish a passport (makes it publicly readable) ──────────────────────────

export async function publishPassport(
  passportId: string,
  cooperativeId: string,
  actorUserId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('coffee_passports')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', passportId)
    .eq('cooperative_id', cooperativeId)

  if (error) throw new Error(error.message)

  await writeTraceabilityEvent({
    entityType: 'coffee_passport',
    entityId: passportId,
    cooperativeId,
    actorUserId,
    eventType: 'passport_published',
    eventData: { published_at: new Date().toISOString() },
  })
}

// ── Fetch a published passport by code (public — no auth required) ────────────

export async function getPublicPassport(passportCode: string) {
  // Use service role key bypass: this is a public read so RLS
  // 'Published passports are publicly readable' policy covers it via anon key
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_passport_chain')
    .select('*')
    .eq('passport_code', passportCode)
    .eq('passport_status', 'published')
    .single()

  if (error || !data) return null

  // Increment view count
  await supabase
    .from('coffee_passports')
    .update({ view_count: (data.view_count ?? 0) + 1 })
    .eq('passport_code', passportCode)

  return data
}

// ── Fetch all passports for a cooperative (dashboard) ───────────────────────

export async function getCoopPassports(cooperativeId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coffee_passports')
    .select(`
      id, passport_code, status, view_count, published_at, created_at,
      public_story, quality_metrics, sustainability_metrics,
      export_lots (export_lot_number, buyer_name, buyer_country, grade, net_weight_kg)
    `)
    .eq('cooperative_id', cooperativeId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Fetch traceability ledger for a passport (audit view) ────────────────────

export async function getPassportLedger(passportId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('traceability_events')
    .select('*')
    .eq('entity_id', passportId)
    .order('created_at', { ascending: true })

  return data ?? []
}
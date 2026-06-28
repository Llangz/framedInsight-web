// lib/passport/buyer-access.service.ts
import type { Database } from '@/lib/database.types'
import { writeTraceabilityEventWithClient } from '@/lib/passport/passport.service'

const EUDR_AREA_THRESHOLD_HA = 4

function extractGeometry(polygon: any): { type: string; coordinates: any } | null {
  if (!polygon) return null
  if (polygon.type === 'Feature' && polygon.geometry) return polygon.geometry
  if (polygon.type === 'Polygon' || polygon.type === 'MultiPolygon' || polygon.type === 'Point') return polygon
  if (Array.isArray(polygon.coordinates)) return { type: 'Polygon', coordinates: polygon.coordinates }
  return null
}

async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('buyer-access: Missing environment variables for service client')
    return null
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getBuyerDataRoom(token: string) {
  const admin = await createAdminClient()
  if (!admin) return null

  const { data: lot } = await admin
    .from('export_lots')
    .select('*, cooperatives(cooperative_name, registration_number), coffee_passports(*)')
    .eq('buyer_access_token', token)
    .is('buyer_access_revoked_at', null)
    .maybeSingle()

  if (!lot) return null
  if (!lot.cooperative_id) {
    console.error('getBuyerDataRoom: Export lot is missing cooperative_id')
    return null
  }

  await writeTraceabilityEventWithClient(admin, {
    entityType: 'export_lot',
    entityId: lot.id,
    cooperativeId: lot.cooperative_id,
    eventType: 'buyer_data_room_accessed',
    actorName: 'buyer (token access)',
    eventData: { accessed_at: new Date().toISOString() },
  })

  return lot
}

export async function getBuyerLotGeoJson(token: string) {
  const admin = await createAdminClient()
  if (!admin) return null

  const { data: lot } = await admin
    .from('export_lots')
    .select('id, export_lot_number, cooperative_id, eudr_dds_reference, cooperatives(cooperative_name, registration_number)')
    .eq('buyer_access_token', token)
    .is('buyer_access_revoked_at', null)
    .maybeSingle()

  if (!lot || !lot.cooperative_id) return null

  const { data: exportMillLots } = await admin
    .from('export_lot_mill_lots')
    .select('mill_lot_id')
    .eq('export_lot_id', lot.id)

  const millLotIds = (exportMillLots ?? []).map(link => link.mill_lot_id).filter(Boolean)
  if (millLotIds.length === 0) return { lot, geoJson: emptyFeatureCollection(lot) }

  const { data: millLotBatches } = await admin
    .from('mill_lot_batches')
    .select('processing_batch_id')
    .in('mill_lot_id', millLotIds)

  const batchIds = (millLotBatches ?? []).map(link => link.processing_batch_id).filter(Boolean)
  if (batchIds.length === 0) return { lot, geoJson: emptyFeatureCollection(lot) }

  const { data: batches } = await admin
    .from('processing_batches')
    .select('id, batch_number, intake_lot_id')
    .in('id', batchIds)

  const intakeLotIds = Array.from(new Set((batches ?? []).map(batch => batch.intake_lot_id).filter(Boolean)))
  if (intakeLotIds.length === 0) return { lot, geoJson: emptyFeatureCollection(lot) }

  const { data: deliveries } = await admin
    .from('lot_farmer_deliveries')
    .select(`
      id, farm_id, plot_id, farmer_cherry_kg, receipt_number,
      farms ( owner_name, farm_name ),
      coffee_plots ( id, plot_name, variety, area_hectares, land_size_acres, gps_latitude, gps_longitude, gps_polygon, eudr_risk_level )
    `)
    .in('lot_id', intakeLotIds)
    .eq('accepted', true)

  const plotsById = new Map<string, any>()
  for (const delivery of deliveries ?? [] as any[]) {
    const plot = delivery.coffee_plots
    if (!plot?.id) continue
    const existing = plotsById.get(plot.id)
    plotsById.set(plot.id, {
      ...plot,
      owner_name: delivery.farms?.owner_name ?? existing?.owner_name ?? null,
      farm_name: delivery.farms?.farm_name ?? existing?.farm_name ?? null,
      cherry_kg: (existing?.cherry_kg ?? 0) + (delivery.farmer_cherry_kg ?? 0),
    })
  }

  const plots = Array.from(plotsById.values())
  const plotIds = plots.map(plot => plot.id)
  const { data: complianceRecords } = plotIds.length > 0
    ? await admin.from('coffee_eudr_compliance').select('*').in('plot_id', plotIds)
    : { data: [] as any[] }
  const complianceByPlot = new Map((complianceRecords ?? []).map((record: any) => [record.plot_id, record]))

  const features = plots.map(plot => {
    const compliance: any = complianceByPlot.get(plot.id)
    const areaHa = plot.area_hectares ?? (plot.land_size_acres ? plot.land_size_acres * 0.4047 : null)
    const polygonGeometry = extractGeometry(plot.gps_polygon)
    const hasPoint = plot.gps_latitude != null && plot.gps_longitude != null
    const geometry = (areaHa !== null && areaHa >= EUDR_AREA_THRESHOLD_HA && polygonGeometry)
      ? polygonGeometry
      : (hasPoint ? { type: 'Point', coordinates: [plot.gps_longitude, plot.gps_latitude] } : polygonGeometry)

    return {
      type: 'Feature' as const,
      geometry: geometry ?? null,
      properties: {
        plot_id: plot.id,
        plot_name: plot.plot_name ?? null,
        producer: plot.owner_name ?? null,
        farm_name: plot.farm_name ?? null,
        variety: plot.variety ?? null,
        cherry_kg: plot.cherry_kg ?? null,
        area_hectares: areaHa,
        geolocation_format: geometry?.type === 'Point' ? 'point' : (geometry ? 'polygon' : 'unmapped'),
        compliance_status: compliance?.compliance_status ?? 'not_assessed',
        deforestation_risk: compliance?.deforestation_risk ?? null,
        tree_cover_loss_pct: compliance?.forest_cover_pct ?? null,
        risk_level: compliance?.risk_level ?? plot.eudr_risk_level ?? 'not_assessed',
        afa_verified: compliance?.afa_verified ?? false,
        assessment_date: compliance?.assessment_date ?? null,
      },
    }
  })

  const geoJson = {
    ...emptyFeatureCollection(lot),
    features,
  }

  await writeTraceabilityEventWithClient(admin, {
    entityType: 'export_lot',
    entityId: lot.id,
    cooperativeId: lot.cooperative_id,
    eventType: 'buyer_geojson_downloaded',
    actorName: 'buyer (token access)',
    eventData: {
      export_lot_number: lot.export_lot_number,
      plot_count: features.length,
      downloaded_at: new Date().toISOString(),
    },
  })

  return { lot, geoJson }
}

function emptyFeatureCollection(lot: any) {
  const cooperative = Array.isArray(lot.cooperatives) ? lot.cooperatives[0] : lot.cooperatives

  return {
    type: 'FeatureCollection' as const,
    metadata: {
      export_lot_number: lot.export_lot_number,
      dds_reference_number: lot.eudr_dds_reference ?? null,
      cooperative: cooperative?.cooperative_name ?? null,
      cooperative_registration_number: cooperative?.registration_number ?? null,
      generated_at: new Date().toISOString(),
      generated_by: 'framedInsight Coffee Digital Passport platform',
      commodity: 'Coffee (HS 0901)',
      country_of_production: 'Kenya',
    },
    features: [],
  }
}

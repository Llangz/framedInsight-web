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

  const { data: lot, error: lotError } = await admin
    .from('export_lots')
    .select(`
      *,
      cooperatives(cooperative_name, registration_number),
      coffee_passports(*),
      export_lot_documents(id, document_type, document_label, file_name, file_size_bytes, uploaded_at, verified_at)
    `)
    .eq('buyer_access_token', token)
    .is('buyer_access_revoked_at', null)
    .maybeSingle()

  // .maybeSingle() only returns an error for a genuine query failure —
  // "token doesn't match any lot" is a legitimate `data: null, error:
  // null` result, not an error. Previously that distinction was thrown
  // away (`error` wasn't even destructured), so a transient DB/network
  // failure and an invalid/revoked token both fell through to the same
  // `return null` → notFound(). For an EU buyer using a private,
  // high-entropy link to check EUDR due-diligence documents before
  // accepting a shipment, a 404 reads as "this link is broken or the
  // seller revoked it" — an alarming, wrong signal for what's actually a
  // retry-able hiccup. Throw instead, so it surfaces via app/error.tsx
  // with a "try again" path rather than looking like access was denied.
  if (lotError) {
    throw new Error(`Could not load buyer data room: ${lotError.message}`)
  }
  if (!lot) return null
  if (!lot.cooperative_id) {
    console.error('getBuyerDataRoom: Export lot is missing cooperative_id')
    return null
  }

  // Fetch the cooperative's most-recent legality self-declaration.
  // Uses the service-role client (bypasses RLS) — consistent with the rest
  // of this function. The view already orders by declared_at DESC.
  const { data: legalityRows } = await admin
    .from('v_legality_declaration_summary' as any)
    .select(`
      season,
      afa_milling_license_held,
      nssf_compliant,
      sha_compliant,
      child_labour_policy_in_place,
      land_use_rights_confirmed,
      third_party_rights_confirmed,
      tax_compliant,
      items_complete,
      items_total,
      fully_declared,
      declared_at,
      notes
    `)
    .eq('cooperative_id', lot.cooperative_id)
    .order('declared_at' as any, { ascending: false })
    .limit(1)

  const legality_declaration = (legalityRows && legalityRows.length > 0)
    ? (legalityRows[0] as any)
    : null

  await writeTraceabilityEventWithClient(admin, {
    entityType: 'export_lot',
    entityId: lot.id,
    cooperativeId: lot.cooperative_id,
    eventType: 'buyer_data_room_accessed',
    actorName: 'buyer (token access)',
    eventData: { accessed_at: new Date().toISOString() },
  })

  return { ...lot, legality_declaration }
}

export async function getBuyerLotGeoJson(token: string) {
  const admin = await createAdminClient()
  if (!admin) return null

  const { data: lot, error: lotError } = await admin
    .from('export_lots')
    .select('id, export_lot_number, cooperative_id, eudr_dds_reference, cooperatives(cooperative_name, registration_number)')
    .eq('buyer_access_token', token)
    .is('buyer_access_revoked_at', null)
    .maybeSingle()

  // Same distinction as getBuyerDataRoom() above, which this function
  // sits right next to and feeds the same buyer session: a genuine query
  // failure was previously indistinguishable from "invalid/revoked
  // token," so a transient hiccup would read to an EU buyer as their
  // access link being broken or pulled — worse, silently for the one
  // function that actually produces the EUDR geolocation evidence (plot
  // polygons / points, 4-hectare threshold data) they're there to check.
  if (lotError) {
    throw new Error(`Could not load export lot for geolocation: ${lotError.message}`)
  }
  if (!lot || !lot.cooperative_id) return null

  // Each hop below (export_lot → mill_lots → processing_batches →
  // intake_lot → farmer deliveries → plots) previously discarded its
  // error and fell through to `?? []`, so a broken link anywhere in this
  // chain silently produced an EMPTY plot/geometry set — which for an
  // EUDR due-diligence document reads as "this lot has no georeferenced
  // plots," a materially different (and wrong) claim from "we couldn't
  // load them." A genuinely empty result at any hop (a lot legitimately
  // has zero linked mill lots so far) is still a valid `data: []`, not an
  // error, so this only changes behavior on an actual fetch failure.
  const exportMillLotsRes = await admin
    .from('export_lot_mill_lots')
    .select('mill_lot_id')
    .eq('export_lot_id', lot.id)
  if (exportMillLotsRes.error) {
    throw new Error(`Could not load mill lots for export lot ${lot.id}: ${exportMillLotsRes.error.message}`)
  }
  const exportMillLots = exportMillLotsRes.data

  const millLotIds = (exportMillLots ?? []).map(link => link.mill_lot_id).filter(Boolean)
  if (millLotIds.length === 0) return { lot, geoJson: emptyFeatureCollection(lot) }

  const millLotBatchesRes = await admin
    .from('mill_lot_batches')
    .select('processing_batch_id')
    .in('mill_lot_id', millLotIds)
  if (millLotBatchesRes.error) {
    throw new Error(`Could not load processing batches for mill lots: ${millLotBatchesRes.error.message}`)
  }
  const millLotBatches = millLotBatchesRes.data

  const batchIds = (millLotBatches ?? []).map(link => link.processing_batch_id).filter(Boolean)
  if (batchIds.length === 0) return { lot, geoJson: emptyFeatureCollection(lot) }

  const batchesRes = await admin
    .from('processing_batches')
    .select('id, batch_number, intake_lot_id')
    .in('id', batchIds)
  if (batchesRes.error) {
    throw new Error(`Could not load processing batches: ${batchesRes.error.message}`)
  }
  const batches = batchesRes.data

  const intakeLotIds = Array.from(new Set(
    (batches ?? [])
      .map(batch => batch.intake_lot_id)
      .filter((id): id is string => id != null)
  ))
  if (intakeLotIds.length === 0) return { lot, geoJson: emptyFeatureCollection(lot) }

  const deliveriesRes = await admin
    .from('lot_farmer_deliveries')
    .select(`
      id, farm_id, plot_id, farmer_cherry_kg, receipt_number,
      farms ( owner_name, farm_name ),
      coffee_plots ( id, plot_name, variety, area_hectares, land_size_acres, gps_latitude, gps_longitude, gps_polygon, eudr_risk_level )
    `)
    .in('lot_id', intakeLotIds)
    .eq('accepted', true)
  if (deliveriesRes.error) {
    throw new Error(`Could not load farmer deliveries: ${deliveriesRes.error.message}`)
  }
  const deliveries = deliveriesRes.data

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

// ── Buyer document download (signed URL) ──────────────────────────────────────
// Same token-gated pattern as getBuyerDataRoom / getBuyerLotGeoJson: validates
// the buyer_access_token, confirms the document belongs to that exact export
// lot (not just any document in the system), then issues a short-lived
// signed URL into the private 'export-lot-documents' bucket.

export async function getBuyerDocumentDownloadUrl(token: string, documentId: string) {
  const admin = await createAdminClient()
  if (!admin) return null

  const { data: lot, error: lotError } = await admin
    .from('export_lots')
    .select('id, export_lot_number, cooperative_id')
    .eq('buyer_access_token', token)
    .is('buyer_access_revoked_at', null)
    .maybeSingle()

  // Same distinction as getBuyerDataRoom above: a real fetch failure here
  // must not look identical to "invalid token" — a buyer mid-download of
  // a due-diligence document shouldn't see "access denied" for what's
  // actually a transient error.
  if (lotError) {
    throw new Error(`Could not verify buyer access: ${lotError.message}`)
  }
  if (!lot) return null

  const { data: doc } = await admin
    .from('export_lot_documents')
    .select('id, storage_path, file_name, document_type')
    .eq('id', documentId)
    .eq('export_lot_id', lot.id)
    .maybeSingle()

  if (!doc) return null

  const { data: signed, error } = await admin.storage
    .from('export-lot-documents')
    .createSignedUrl(doc.storage_path, 60 * 5)

  if (error || !signed) return null

  await writeTraceabilityEventWithClient(admin, {
    entityType: 'export_lot',
    entityId: lot.id,
    cooperativeId: lot.cooperative_id!,
    eventType: 'buyer_document_downloaded',
    actorName: 'buyer (token access)',
    eventData: {
      export_lot_number: lot.export_lot_number,
      document_type: doc.document_type,
      file_name: doc.file_name,
      downloaded_at: new Date().toISOString(),
    },
  })

  return { url: signed.signedUrl, fileName: doc.file_name }
}
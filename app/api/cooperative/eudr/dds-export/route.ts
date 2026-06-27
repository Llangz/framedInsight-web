/**
 * app/api/cooperative/eudr/dds-export/route.ts
 *
 * Generates a downloadable EUDR Due Diligence Statement support bundle
 * for a factory intake lot: a GeoJSON FeatureCollection of the
 * contributing plots (point or polygon per the 4ha threshold) plus a
 * one-page PDF summary, zipped together. Writes the generated DDS
 * reference number back to factory_intake_lots, and to export_lots too
 * if an exportLotId is supplied.
 *
 * This produces the SUPPORTING EVIDENCE bundle a cooperative or exporter
 * would attach to their own filing — it does not file anything with the
 * EU Information System (TRACES) itself, and framedInsight makes no
 * legal-sufficiency claim about it (see the disclaimer printed on the
 * PDF itself).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { writeTraceabilityEvent } from '@/lib/passport/passport.service'
import JSZip from 'jszip'
import { jsPDF } from 'jspdf'

const EUDR_AREA_THRESHOLD_HA = 4

// gps_polygon may be stored as a bare Polygon/MultiPolygon geometry OR as a
// full GeoJSON Feature wrapping one (the boundary mapper saves Features) —
// same normalization as app/dashboard/coffee/plots/[plotId]/page.tsx.
function extractGeometry(polygon: any): { type: string; coordinates: any } | null {
  if (!polygon) return null
  if (polygon.type === 'Feature' && polygon.geometry) return polygon.geometry
  if (polygon.type === 'Polygon' || polygon.type === 'MultiPolygon' || polygon.type === 'Point') return polygon
  if (Array.isArray(polygon.coordinates)) return { type: 'Polygon', coordinates: polygon.coordinates }
  return null
}

export async function POST(req: NextRequest) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { factoryIntakeLotId?: string; exportLotId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { factoryIntakeLotId, exportLotId } = body
  if (!factoryIntakeLotId) {
    return NextResponse.json({ error: 'factoryIntakeLotId is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Intake lot + factory + cooperative, scoped to this officer's coop
  const { data: lot, error: lotError } = await supabase
    .from('factory_intake_lots')
    .select(`
      *,
      coop_factories ( factory_name, factory_code ),
      cooperatives ( cooperative_name, registration_number, county, registered_office )
    `)
    .eq('id', factoryIntakeLotId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (lotError || !lot) {
    return NextResponse.json({ error: 'Intake lot not found or unauthorized' }, { status: 404 })
  }

  // 2. If an export lot was specified, verify it belongs to this coop too
  //    before writing anything to it.
  let exportLot: { id: string; export_lot_number: string } | null = null
  if (exportLotId) {
    const { data: el } = await supabase
      .from('export_lots')
      .select('id, export_lot_number')
      .eq('id', exportLotId)
      .eq('cooperative_id', access.coopId)
      .single()
    if (!el) {
      return NextResponse.json({ error: 'Export lot not found or unauthorized' }, { status: 404 })
    }
    exportLot = el
  }

  // 3. Accepted deliveries for this lot, with their plots
  const { data: deliveries } = await supabase
    .from('lot_farmer_deliveries')
    .select(`
      id, farm_id, plot_id, farmer_cherry_kg, receipt_number,
      farms ( owner_name, farm_name ),
      coffee_plots ( id, plot_name, variety, area_hectares, land_size_acres, gps_latitude, gps_longitude, gps_polygon, eudr_risk_level )
    `)
    .eq('lot_id', factoryIntakeLotId)
    .eq('accepted', true)

  const deliveryList = deliveries ?? []
  const plotsById = new Map<string, any>()
  for (const d of deliveryList as any[]) {
    const plot = d.coffee_plots
    if (plot?.id) plotsById.set(plot.id, { ...plot, owner_name: d.farms?.owner_name })
  }
  const plots = Array.from(plotsById.values())

  if (plots.length === 0) {
    return NextResponse.json(
      { error: 'No mapped plots found for this intake lot — geolocation data is required for a DDS bundle' },
      { status: 400 }
    )
  }

  // 4. EUDR compliance records for those plots
  const plotIds = plots.map(p => p.id)
  const { data: complianceRecords } = await supabase
    .from('coffee_eudr_compliance')
    .select('*')
    .in('plot_id', plotIds)

  const complianceByPlot = new Map((complianceRecords ?? []).map((c: any) => [c.plot_id, c]))

  // 5. Generate the DDS reference number — sequential per cooperative + year
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('factory_intake_lots')
    .select('id', { count: 'exact', head: true })
    .eq('cooperative_id', access.coopId)
    .not('dds_reference_number', 'is', null)
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)

  const ddsReference = `DDS-KE-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

  // 6. Build the GeoJSON FeatureCollection
  const features = plots.map(plot => {
    const compliance: any = complianceByPlot.get(plot.id)
    const areaHa = plot.area_hectares ?? (plot.land_size_acres ? plot.land_size_acres * 0.4047 : null)
    const polygonGeometry = extractGeometry(plot.gps_polygon)

    // EUDR geolocation rule: a polygon is required above the 4ha threshold;
    // a single point is sufficient below it. If a plot above the threshold
    // was only ever point-mapped, fall back to the point rather than
    // fabricating a boundary — an honest gap is better than a fake one.
    const hasPoint = plot.gps_latitude != null && plot.gps_longitude != null
    const useGeometry = (areaHa !== null && areaHa >= EUDR_AREA_THRESHOLD_HA && polygonGeometry)
      ? polygonGeometry
      : (hasPoint ? { type: 'Point', coordinates: [plot.gps_longitude, plot.gps_latitude] } : polygonGeometry)

    return {
      type: 'Feature' as const,
      geometry: useGeometry ?? null,
      properties: {
        plot_id: plot.id,
        plot_name: plot.plot_name ?? null,
        producer: plot.owner_name ?? null,
        variety: plot.variety ?? null,
        area_hectares: areaHa,
        geolocation_format: useGeometry?.type === 'Point' ? 'point' : (useGeometry ? 'polygon' : 'unmapped'),
        compliance_status: compliance?.compliance_status ?? 'not_assessed',
        deforestation_risk: compliance?.deforestation_risk ?? null,
        forest_cover_pct: compliance?.forest_cover_pct ?? null,
        land_use_before_2020: compliance?.land_use_before_2020 ?? null,
        risk_level: compliance?.risk_level ?? plot.eudr_risk_level ?? 'not_assessed',
        afa_verified: compliance?.afa_verified ?? false,
        assessment_date: compliance?.assessment_date ?? null,
      },
    }
  })

  const cooperative: any = (lot as any).cooperatives
  const factory: any = (lot as any).coop_factories

  const geoJson = {
    type: 'FeatureCollection' as const,
    metadata: {
      dds_reference_number: ddsReference,
      cooperative: cooperative?.cooperative_name ?? null,
      cooperative_registration_number: cooperative?.registration_number ?? null,
      factory: factory?.factory_name ?? null,
      lot_number: lot.lot_number,
      harvest_year: (lot as any).harvest_year ?? null,
      generated_at: new Date().toISOString(),
      generated_by: 'framedInsight Coffee Digital Passport platform',
      commodity: 'Coffee (HS 0901)',
      country_of_production: 'Kenya',
    },
    features,
  }

  // 7. Build the PDF summary
  const doc = new jsPDF()
  const coopName = cooperative?.cooperative_name ?? 'Cooperative'
  const factoryName = factory?.factory_name ?? 'Factory'
  const farmerCount = new Set((deliveryList as any[]).map(d => d.farm_id)).size

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('EU Deforestation Regulation — Due Diligence Summary', 14, 18)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110)
  doc.text('Generated by the framedInsight Coffee Digital Passport platform', 14, 24)

  doc.setTextColor(0)
  doc.setFontSize(11)
  let y = 36

  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 72, y)
    y += 7
  }

  line('DDS Reference:', ddsReference)
  line('Cooperative:', coopName)
  if (cooperative?.registration_number) line('Registration No.:', cooperative.registration_number)
  line('Factory:', factoryName)
  line('Lot Number:', lot.lot_number)
  line('Harvest Year:', String((lot as any).harvest_year ?? '\u2014'))
  line('Intake Date:', String((lot as any).intake_date ?? '\u2014'))
  line('Total Cherry (kg):', String((lot as any).total_cherry_kg ?? '\u2014'))
  line('Farmers in Lot:', String(farmerCount))
  line('Plots Assessed:', String(plots.length))
  line('Commodity:', 'Coffee \u2014 HS Code 0901')
  line('Country of Production:', 'Kenya')
  if (exportLot) line('Export Lot:', exportLot.export_lot_number)

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Plot-level compliance', 14, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  for (const f of features) {
    if (y > 270) { doc.addPage(); y = 18 }
    const p = f.properties
    const status = p.deforestation_risk === true
      ? 'DEFORESTATION RISK FLAGGED'
      : p.compliance_status === 'verified'
        ? 'Compliant'
        : 'Not yet assessed'
    const areaLabel = typeof p.area_hectares === 'number' ? `${p.area_hectares.toFixed(2)} ha` : 'area n/a'
    doc.text(`${p.plot_name ?? p.plot_id}  \u00b7  ${areaLabel}  \u00b7  ${p.geolocation_format}  \u00b7  ${status}`, 14, y)
    y += 6
  }

  y += 6
  if (y > 260) { doc.addPage(); y = 18 }
  doc.setFontSize(8)
  doc.setTextColor(130)
  doc.text('This document summarizes geolocation and deforestation-risk data held by framedInsight on behalf of', 14, y); y += 5
  doc.text('the cooperative named above. It supports \u2014 but does not replace \u2014 the operator\u2019s own EUDR due', 14, y); y += 5
  doc.text('diligence and filing in the EU Information System. framedInsight makes no legal-sufficiency claim.', 14, y)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  // 8. Bundle into a ZIP
  const zip = new JSZip()
  zip.file(`${ddsReference}.json`, JSON.stringify(geoJson, null, 2))
  zip.file(`${ddsReference}.pdf`, pdfBuffer)
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  // 9. Write the reference back — intake lot always, export lot if given
  await supabase
    .from('factory_intake_lots')
    .update({ dds_reference_number: ddsReference })
    .eq('id', factoryIntakeLotId)

  if (exportLot) {
    await supabase
      .from('export_lots')
      .update({ eudr_dds_reference: ddsReference })
      .eq('id', exportLot.id)
  }

  // 10. Ledger entry
  await writeTraceabilityEvent({
    entityType: 'factory_intake_lot',
    entityId: factoryIntakeLotId,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    eventType: 'eudr_dds_bundle_generated',
    eventData: {
      dds_reference_number: ddsReference,
      lot_number: lot.lot_number,
      plot_count: plots.length,
      export_lot_number: exportLot?.export_lot_number ?? null,
    },
  })

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${ddsReference}.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}
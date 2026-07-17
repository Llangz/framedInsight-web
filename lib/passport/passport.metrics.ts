/**
 * lib/passport/passport.metrics.ts
 *
 * Pure computation for the Coffee Digital Passport platform — the
 * EUDR/quality/sustainability derivation logic, with no Supabase/DB/
 * Next.js imports. Split out of passport.service.ts specifically so it
 * can be unit-tested (see passport.metrics.test.ts) without dragging in
 * 'server-only' / 'next/headers' via lib/supabase/server, which made this
 * unimportable from a plain Vitest/node environment.
 *
 * passport.service.ts re-exports everything from here so existing
 * imports of PublicStory / SustainabilityMetrics / etc. from that module
 * keep working unchanged.
 */

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
  avg_tree_cover_loss_pct?: number
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

export interface PassportComputationInput {
  batch: {
    season?: string | null
    harvest_year?: number | null
    washing_date?: string | null
    moisture_content_pct?: number | null
    intake_lot_id?: string | null
    coop_factories?: { factory_name?: string | null; factory_code?: string | null } | null
    cooperatives?: {
      cooperative_name?: string | null
      county?: string | null
      sub_county?: string | null
      ward?: string | null
    } | null
  }
  deliveryList: Array<{
    farm_id: string
    farmer_cherry_kg?: number | null
    plot_id?: string | null
    farms?: { gps_latitude?: number | null; gps_longitude?: number | null } | null
    coffee_plots?: {
      variety?: string | null
      gps_latitude?: number | null
      gps_longitude?: number | null
      land_size_acres?: number | null
      area_hectares?: number | null
    } | null
  }>
  eudrRecords: Array<{
    risk_level?: string | null
    deforestation_risk?: boolean | null
    forest_cover_pct?: number | null
  }>
  qualityRecords: Array<{
    flavor_notes?: string | null
    cupping_score?: number | null
    cupper_name?: string | null
    cupping_date?: string | null
    aroma_score?: number | null
    acidity_score?: number | null
    body_score?: number | null
    organic_certified?: boolean | null
    utz_certified?: boolean | null
    rainforest_alliance?: boolean | null
    fair_trade_certified?: boolean | null
  }>
  exportLot?: {
    grade?: string | null
    processing_method?: string | null
    moisture_content_pct?: number | null
    sca_cupping_score?: number | null
  } | null
  totalPlotsOverride?: number
}

export function computePassportMetrics({
  batch,
  deliveryList,
  eudrRecords,
  qualityRecords,
  exportLot,
  totalPlotsOverride,
}: PassportComputationInput): {
  publicStory: PublicStory
  sustainabilityMetrics: SustainabilityMetrics
  qualityMetrics: QualityMetrics
  geoSummary: GeoSummary
} {
  const plotIds = deliveryList.map(d => d.plot_id).filter(Boolean) as string[]
  const farmCount = new Set(deliveryList.map(d => d.farm_id)).size

  // ── Compute sustainability metrics ──────────────────────────────────────────

  const totalPlots = totalPlotsOverride ?? plotIds.length
  const lowRiskPlots = eudrRecords.filter(e => e.risk_level === 'low' && !e.deforestation_risk).length
  const deforestationFreePct = totalPlots > 0
    ? Math.round((lowRiskPlots / totalPlots) * 100)
    : 0
  const avgForestCover = eudrRecords.length > 0
    ? eudrRecords.reduce((s, e) => s + (e.forest_cover_pct ?? 0), 0) / eudrRecords.length
    : undefined
  const avgTreeCoverLoss = avgForestCover

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
    processing: exportLot?.processing_method
      ? String(exportLot.processing_method)
      : batch.washing_date ? 'Fully Washed' : 'Natural',
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
    avg_tree_cover_loss_pct: avgTreeCoverLoss !== undefined
      ? Math.round(avgTreeCoverLoss * 10) / 10
      : undefined,
    total_plot_area_acres: Math.round(totalPlotAcres * 10) / 10,
  }

  const qualityMetrics: QualityMetrics = {
    sca_score: exportLot?.sca_cupping_score ?? bestQuality?.cupping_score ?? undefined,
    cupper_name: bestQuality?.cupper_name ?? undefined,
    cupping_date: bestQuality?.cupping_date ?? undefined,
    flavor_notes: bestQuality?.flavor_notes ?? undefined,
    aroma: bestQuality?.aroma_score ?? undefined,
    acidity: bestQuality?.acidity_score ?? undefined,
    body: bestQuality?.body_score ?? undefined,
    grade: exportLot?.grade ?? 'Unknown',
    moisture_pct: exportLot?.moisture_content_pct ?? batch.moisture_content_pct ?? undefined,
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


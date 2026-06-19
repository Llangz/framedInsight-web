/**
 * check-eudr-risk — Supabase Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Called fire-and-forget from the add-plot flow immediately after a plot is
 * saved. The farmer never waits for this — it runs in the background and
 * updates compliance state when done.
 *
 * WHAT IT DOES:
 *   1. Receives plot_id + GeoJSON polygon
 *   2. Fetches farm_id and area_hectares from coffee_plots (needed for the
 *      compliance table FK and for point/polygon format branching)
 *   3. Calls the Global Forest Watch (GFW) Data API with the polygon
 *   4. Queries the Hansen/UMD tree cover loss dataset (2020–present, 30m res)
 *   5. Applies a minimum-meaningful-loss guard to reduce GFW false positives
 *      on coffee agroforestry canopy
 *   6. Determines EUDR geolocation format (point < 4 ha, polygon ≥ 4 ha)
 *   7. UPSERTS into coffee_eudr_compliance (authoritative table — one row/plot)
 *   8. Syncs risk_level/details/assessed_at back to coffee_plots for legacy
 *      reads on the plot-detail page
 *
 * DEPLOY:
 *   npx supabase functions deploy check-eudr-risk
 *
 * RISK THRESHOLDS:
 *   absolute loss < 0.03 ha          → 'low'  (noise guard, normal coffee mgmt)
 *   loss / plot area < 2%            → 'low'
 *   loss / plot area 2–12%           → 'medium'
 *   loss / plot area > 12%           → 'high'
 *
 * GFW CAVEAT:
 *   The Hansen/UMD 30m tree-cover-loss layer is the only feasible dataset
 *   for per-plot screening via the GFW Data API. The WRI/Google DeepMind
 *   "dominant driver" dataset operates at 1 km grid cells — far too coarse
 *   for a 0.2–1 ha Kenyan smallholder coffee plot. We keep Hansen but widen
 *   thresholds and add the absolute-loss guard to reduce over-flagging of
 *   normal coffee-husbandry canopy management.
 *   The AFA geo-mapping programme is the authoritative compliance source.
 *
 * KENYA REGULATORY CONTEXT (June 2026):
 *   Kenya = standard risk (EU May 2025 benchmarking).
 *   Micro/small operator deadline: 30 June 2027.
 *   Full plot-level geolocation + deforestation-free proof required regardless
 *   of farm size. No simplified due-diligence relief for standard-risk countries.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  plot_id: string
  polygon: GeoJSONFeature
}

interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONPolygon
  properties?: Record<string, unknown>
}

interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

interface GFWRow {
  loss_area: number
  year: number
}

type RiskLevel = 'low' | 'medium' | 'high' | 'error'
type GeoFormat = 'point' | 'polygon'

// ── Constants (mirrors lib/eudr-constants.ts — duplicated for Deno compat) ────

const EUDR_POLYGON_THRESHOLD_HA  = 4
const EUDR_MIN_MEANINGFUL_LOSS_HA = 0.03
const EUDR_RISK_RATIO_LOW        = 0.02   // < 2%  → low
const EUDR_RISK_RATIO_HIGH       = 0.12   // ≥ 12% → high

// ── Geometry helpers ──────────────────────────────────────────────────────────

function polygonAreaHa(polygon: GeoJSONPolygon): number {
  const coords = polygon.coordinates[0]
  if (!coords || coords.length < 3) return 0
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  let area = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i]
    const [lng2, lat2] = coords[i + 1]
    const xi = toRad(lng1) * Math.cos(toRad(lat1))
    const yi = toRad(lat1)
    const xj = toRad(lng2) * Math.cos(toRad(lat2))
    const yj = toRad(lat2)
    area += xi * yj - xj * yi
  }
  return Math.abs(area / 2) * R * R / 10_000
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

function polygonCentroid(polygon: GeoJSONPolygon): { lat: number; lng: number } {
  const ring = polygon.coordinates[0]
  // Skip closing duplicate point if present
  const pts = ring[ring.length - 1][0] === ring[0][0] && ring[ring.length - 1][1] === ring[0][1]
    ? ring.slice(0, -1)
    : ring
  const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length
  const lng = pts.reduce((s, c) => s + c[0], 0) / pts.length
  return { lat: round6(lat), lng: round6(lng) }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { plot_id, polygon } = body
  if (!plot_id || !polygon?.geometry) {
    return new Response(JSON.stringify({ error: 'plot_id and polygon are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Supabase admin client (bypasses RLS) ──────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Fetch farm_id and stored area from coffee_plots ───────────────────────
  // We need farm_id for the compliance table FK (NOT NULL), and stored
  // area_hectares as a sanity-check against the computed polygon area.
  const { data: plotRow, error: plotFetchErr } = await supabaseAdmin
    .from('coffee_plots')
    .select('farm_id, area_hectares')
    .eq('id', plot_id)
    .single()

  if (plotFetchErr || !plotRow) {
    console.error('Could not fetch plot row:', plotFetchErr)
    return new Response(JSON.stringify({ error: 'Plot not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { farm_id, area_hectares: storedAreaHa } = plotRow

  // Compute area from the submitted polygon; fall back to stored value
  const computedAreaHa = polygonAreaHa(polygon.geometry)
  const plotAreaHa = computedAreaHa > 0.001 ? computedAreaHa : (storedAreaHa ?? 0)

  // EUDR geolocation format: < 4 ha → point, ≥ 4 ha → polygon
  const geolocationFormat: GeoFormat = plotAreaHa >= EUDR_POLYGON_THRESHOLD_HA ? 'polygon' : 'point'
  const centroid = polygonCentroid(polygon.geometry)

  // ── Call GFW Data API ─────────────────────────────────────────────────────
  let riskLevel: RiskLevel = 'error'
  let riskDetails = ''
  let totalLossHa = 0
  let forestCoverPct: number | null = null
  let lastForestChangeYear: number | null = null
  let rawApiResponse: Record<string, unknown> = {}

  try {
    const gfwResponse = await fetch(
      'https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query/json',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `
            SELECT SUM(area__ha) as loss_area, umd_tree_cover_loss__year as year
            FROM umd_tree_cover_loss
            WHERE umd_tree_cover_loss__year >= 2020
              AND umd_tree_cover_density__threshold = 30
            GROUP BY umd_tree_cover_loss__year
            ORDER BY umd_tree_cover_loss__year
          `,
          geometry: polygon.geometry,
        }),
      }
    )

    if (!gfwResponse.ok) {
      throw new Error(`GFW API returned ${gfwResponse.status}: ${await gfwResponse.text()}`)
    }

    const gfwData = await gfwResponse.json()
    rawApiResponse = gfwData
    const rows: GFWRow[] = gfwData?.data || []

    totalLossHa = rows.reduce((sum, r) => sum + (r.loss_area || 0), 0)

    if (rows.length > 0) {
      lastForestChangeYear = Math.max(...rows.map(r => r.year))
    }

    // ── Risk classification ───────────────────────────────────────────────
    // Guard #1: minimum meaningful loss — anything below 0.03 ha absolute is
    // treated as noise (normal agroforestry canopy management, GPS error,
    // or Hansen over-classification of coffee shade trees).
    if (totalLossHa < EUDR_MIN_MEANINGFUL_LOSS_HA) {
      riskLevel = 'low'
    } else if (plotAreaHa < 0.001) {
      // Guard #2: unknown area — use absolute thresholds only
      riskLevel = totalLossHa < 0.1 ? 'low' : totalLossHa < 0.5 ? 'medium' : 'high'
    } else {
      const lossRatio = totalLossHa / plotAreaHa
      riskLevel = lossRatio < EUDR_RISK_RATIO_LOW ? 'low'
               : lossRatio < EUDR_RISK_RATIO_HIGH ? 'medium'
               : 'high'
      // Forest cover pct only meaningful when we have valid area
      forestCoverPct = parseFloat(
        Math.min(100, (totalLossHa / plotAreaHa) * 100).toFixed(2)
      )
    }

    const yearBreakdown = rows.map(r => `${r.year}: ${r.loss_area.toFixed(3)} ha`).join(', ')

    const geolocationNote = geolocationFormat === 'point'
      ? `EUDR geolocation: single point ${centroid.lat}, ${centroid.lng} (plot < 4 ha — point format compliant).`
      : `EUDR geolocation: full polygon required (plot ≥ 4 ha).`

    riskDetails = [
      `Total tree cover loss since 2020: ${totalLossHa.toFixed(3)} ha.`,
      plotAreaHa > 0.001
        ? `Plot area: ${plotAreaHa.toFixed(3)} ha. Loss ratio: ${((totalLossHa / plotAreaHa) * 100).toFixed(1)}%.`
        : '',
      totalLossHa < EUDR_MIN_MEANINGFUL_LOSS_HA
        ? `Loss below minimum meaningful threshold (${EUDR_MIN_MEANINGFUL_LOSS_HA} ha) — classified as normal canopy management, not deforestation.`
        : '',
      yearBreakdown ? `By year: ${yearBreakdown}.` : '',
      geolocationNote,
      `Assessed via Global Forest Watch Hansen/UMD dataset (30 m resolution).`,
      `NOTE: Preliminary screening only. Coffee agroforestry may be over-flagged.`,
      `AFA geo-mapping programme is the authoritative compliance source for Kenyan farmers.`,
    ].filter(Boolean).join(' ')

  } catch (err: unknown) {
    console.error('GFW API error:', err)
    riskLevel = 'error'
    forestCoverPct = null
    riskDetails = `GFW API check failed: ${err instanceof Error ? err.message : String(err)}. Manual review required.`
  }

  // ── Upsert into coffee_eudr_compliance (authoritative) ───────────────────
  const now = new Date().toISOString()
  const complianceStatus = riskLevel === 'low' ? 'pending_verification'
    : riskLevel === 'medium' ? 'requires_review'
    : riskLevel === 'high' ? 'non_compliant'
    : 'error'

  const { error: upsertError } = await supabaseAdmin
    .from('coffee_eudr_compliance')
    .upsert(
      {
        farm_id,
        plot_id,
        risk_level:         riskLevel,
        deforestation_risk: riskLevel === 'high',
        forest_cover_pct:   forestCoverPct,
        assessment_date:    now,
        geolocation_format: geolocationFormat,
        compliance_status:  complianceStatus,
        last_forest_change_year: lastForestChangeYear,
        raw_api_response:   rawApiResponse,
        notes:              riskDetails,
        updated_at:         now,
      },
      { onConflict: 'plot_id' }
    )

  if (upsertError) {
    console.error('Supabase upsert (coffee_eudr_compliance) error:', upsertError)
    return new Response(
      JSON.stringify({ success: false, error: upsertError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Sync legacy coffee_plots columns (best-effort read cache) ────────────
  // PlotDetailClient reads eudr_risk_level directly from coffee_plots for the
  // inline badge; keep in sync so neither source goes stale.
  await supabaseAdmin
    .from('coffee_plots')
    .update({
      eudr_risk_level:       riskLevel,
      eudr_risk_assessed_at: now,
      eudr_risk_details:     riskDetails,
    })
    .eq('id', plot_id)
  // Ignore errors here — the compliance table write already succeeded

  console.log(
    `EUDR check complete — plot ${plot_id}: ${riskLevel} ` +
    `(loss: ${totalLossHa.toFixed(3)} ha, format: ${geolocationFormat})`
  )

  return new Response(
    JSON.stringify({
      success: true,
      plot_id,
      risk_level: riskLevel,
      total_loss_ha: totalLossHa,
      geolocation_format: geolocationFormat,
      centroid,
      compliance_status: complianceStatus,
      details: riskDetails,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
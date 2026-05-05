/**
 * check-eudr-risk — Supabase Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Called fire-and-forget from add-plot-page.tsx immediately after a plot is
 * saved. The farmer never waits for this — it runs in the background and
 * updates the plot's eudr_risk_level when done.
 *
 * WHAT IT DOES:
 *   1. Receives plot_id + GeoJSON polygon
 *   2. Calls the Global Forest Watch (GFW) Data API with the polygon
 *   3. Queries the Hansen/UMD tree cover loss dataset (2020–present, 30m res)
 *   4. Derives a risk level: 'low' | 'medium' | 'high' | 'error'
 *   5. Updates coffee_plots.eudr_risk_level + eudr_risk_assessed_at
 *
 * DEPLOY:
 *   npx supabase functions deploy check-eudr-risk
 *
 * The function uses the Supabase service role key (available automatically
 * in Edge Functions via Deno.env) to bypass RLS for the update.
 *
 * RISK THRESHOLDS (relative to plot area):
 *   low    < 1% tree cover loss since 2020
 *   medium  1–10% tree cover loss since 2020
 *   high   > 10% tree cover loss since 2020
 *
 * IMPORTANT CAVEAT (documented in code):
 *   GFW open data can over-flag coffee plots because coffee trees are
 *   sometimes classified as forest canopy. This is a screening indicator,
 *   not a definitive EUDR compliance determination. The AFA geo-mapping
 *   programme is the authoritative source for Kenyan farmers.
 *   Reference: Satelligence research on GFW false positives (2025)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  plot_id: string
  polygon: GeoJSON.Feature<GeoJSON.Polygon>
}

interface GFWRow {
  loss_area: number
  year: number
}

type RiskLevel = 'low' | 'medium' | 'high' | 'error'

// ── Shoelace area in hectares (for risk ratio calculation) ────────────────────

function polygonAreaHa(polygon: GeoJSON.Polygon): number {
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

  return Math.abs(area / 2) * R * R / 10000
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { plot_id, polygon } = body

  if (!plot_id || !polygon?.geometry) {
    return new Response(JSON.stringify({ error: 'plot_id and polygon are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Supabase admin client (bypasses RLS) ──────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Call GFW Data API ─────────────────────────────────────────────────────
  let riskLevel: RiskLevel = 'error'
  let riskDetails = ''
  let totalLossHa = 0

  try {
    const plotAreaHa = polygonAreaHa(polygon.geometry)

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
      const errText = await gfwResponse.text()
      throw new Error(`GFW API returned ${gfwResponse.status}: ${errText}`)
    }

    const gfwData = await gfwResponse.json()
    const rows: GFWRow[] = gfwData?.data || []

    totalLossHa = rows.reduce((sum, r) => sum + (r.loss_area || 0), 0)

    // Risk ratio = tree cover loss / plot area
    // If plot area is unknown (< 0.001 ha — bad polygon), use absolute threshold
    const useAbsolute = plotAreaHa < 0.001
    const lossRatio = useAbsolute ? totalLossHa : totalLossHa / plotAreaHa

    if (useAbsolute) {
      // Absolute thresholds when we can't compute ratio
      riskLevel = totalLossHa < 0.05 ? 'low' : totalLossHa < 0.5 ? 'medium' : 'high'
    } else {
      riskLevel = lossRatio < 0.01 ? 'low' : lossRatio < 0.10 ? 'medium' : 'high'
    }

    const yearBreakdown = rows.map(r => `${r.year}: ${r.loss_area.toFixed(3)} ha`).join(', ')

    riskDetails = [
      `Total tree cover loss since 2020: ${totalLossHa.toFixed(3)} ha.`,
      plotAreaHa > 0.001
        ? `Plot area: ${plotAreaHa.toFixed(3)} ha. Loss ratio: ${((totalLossHa / plotAreaHa) * 100).toFixed(1)}%.`
        : '',
      yearBreakdown ? `By year — ${yearBreakdown}.` : '',
      `Assessed via Global Forest Watch Hansen/UMD dataset (30m resolution).`,
      `NOTE: This is a preliminary screening indicator, not an official EUDR compliance determination.`,
      `Coffee agroforestry may be misclassified as forest loss in open satellite data.`,
      `Official compliance is verified by the Kenya AFA geo-mapping programme.`,
    ].filter(Boolean).join(' ')

  } catch (err: unknown) {
    console.error('GFW API error:', err)
    riskLevel = 'error'
    riskDetails = `GFW API check failed: ${err instanceof Error ? err.message : String(err)}. Manual review required.`
  }

  // ── Update coffee_plots ───────────────────────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from('coffee_plots')
    .update({
      eudr_risk_level:       riskLevel,
      eudr_risk_assessed_at: new Date().toISOString(),
      eudr_risk_details:     riskDetails,
    })
    .eq('id', plot_id)

  if (updateError) {
    console.error('Supabase update error:', updateError)
    return new Response(
      JSON.stringify({ success: false, error: updateError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.log(`EUDR check complete — plot ${plot_id}: ${riskLevel} (loss: ${totalLossHa.toFixed(3)} ha)`)

  return new Response(
    JSON.stringify({
      success: true,
      plot_id,
      risk_level: riskLevel,
      total_loss_ha: totalLossHa,
      details: riskDetails,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})

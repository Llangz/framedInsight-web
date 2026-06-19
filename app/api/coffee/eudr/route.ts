import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  EUDR_DEADLINE_SMALL,
  daysUntilEudrDeadline,
  KENYA_EUDR_RISK_TIER,
  KENYA_RISK_TIER_EXPLAINER,
} from '@/lib/eudr-constants'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Auth helper ───────────────────────────────────────────────────────────────

async function authedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

// ── GET /api/coffee/eudr ──────────────────────────────────────────────────────
// Returns fleet-level compliance summary for the farm.

export async function GET(req: NextRequest) {
  try {
    const supabase = await authedClient(req)
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: farmManager } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()

    if (!farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 })
    }

    // Pull plots with their compliance state — join from the authoritative table
    const { data: plots, error } = await supabase
      .from('coffee_plots')
      .select(`
        id,
        plot_name,
        area_hectares,
        eudr_risk_level,
        eudr_risk_details,
        eudr_risk_assessed_at,
        afa_geo_mapping_id,
        land_ownership_doc_url,
        coffee_eudr_compliance (
          risk_level,
          compliance_status,
          geolocation_format,
          afa_verified,
          afa_verification_date,
          assessment_date,
          forest_cover_pct,
          deforestation_risk
        )
      `)
      .eq('farm_id', farmManager.farm_id)

    if (error) throw error

    const totalPlots      = plots?.length || 0
    const compliantPlots  = plots?.filter((p: any) => p.eudr_risk_level === 'low').length || 0
    const compliancePct   = totalPlots > 0
      ? ((compliantPlots / totalPlots) * 100).toFixed(1)
      : '0'

    return NextResponse.json({
      eudrStatus: {
        totalPlots,
        compliantPlots,
        compliancePercentage:  compliancePct,
        eudrDeadline:          EUDR_DEADLINE_SMALL,
        daysUntilDeadline:     daysUntilEudrDeadline(),
        kenyaRiskTier:         KENYA_EUDR_RISK_TIER,
        kenyaRiskTierExplainer: KENYA_RISK_TIER_EXPLAINER,
        requiredDocuments:     ['gps_coordinates', 'land_title_deed', 'proof_of_origin'],
      },
      plots: plots || [],
    })
  } catch (err) {
    console.error('GET /api/coffee/eudr error:', err)
    return NextResponse.json({ error: 'Failed to fetch EUDR status' }, { status: 500 })
  }
}

// ── POST /api/coffee/eudr ─────────────────────────────────────────────────────
// Records a document upload or manual compliance update against a plot.
// Writes to coffee_eudr_compliance (authoritative) and syncs coffee_plots.
//
// Body: { plotId, documentType, documentUrl?, deforestationRisk?, afaGeoMappingId? }

export async function POST(req: NextRequest) {
  try {
    const supabase = await authedClient(req)
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await req.json()
    const { plotId, documentType, documentUrl, deforestationRisk, afaGeoMappingId } = body

    if (!plotId) {
      return NextResponse.json({ error: 'plotId is required' }, { status: 400 })
    }

    const { data: farmManager } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()

    if (!farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 })
    }

    // Verify the plot belongs to this farm (RLS also enforces, but fail fast)
    const { data: plotRow, error: plotErr } = await supabase
      .from('coffee_plots')
      .select('id, area_hectares')
      .eq('id', plotId)
      .eq('farm_id', farmManager.farm_id)
      .single()

    if (plotErr || !plotRow) {
      return NextResponse.json({ error: 'Plot not found' }, { status: 404 })
    }

    // Read current compliance record to merge document metadata
    const { data: current } = await supabase
      .from('coffee_eudr_compliance')
      .select('raw_api_response')
      .eq('plot_id', plotId)
      .single()

    // Merge new document into the raw_api_response jsonb doc-map
    const existingDocs: Record<string, string> =
      (current?.raw_api_response as any)?.documents || {}
    const updatedDocs = documentType && documentUrl
      ? { ...existingDocs, [documentType]: documentUrl }
      : existingDocs

    const riskLevel = deforestationRisk === true ? 'high'
      : deforestationRisk === false ? 'low'
      : undefined

    const complianceStatus =
      riskLevel === 'low'  ? 'pending_verification' :
      riskLevel === 'high' ? 'non_compliant' : undefined

    const now = new Date().toISOString()

    // Upsert compliance record
    const { data: upserted, error: upsertErr } = await supabase
      .from('coffee_eudr_compliance')
      .upsert(
        {
          farm_id:    farmManager.farm_id,
          plot_id:    plotId,
          ...(riskLevel        && { risk_level:         riskLevel }),
          ...(complianceStatus && { compliance_status:  complianceStatus }),
          ...(deforestationRisk !== undefined && { deforestation_risk: deforestationRisk }),
          raw_api_response: {
            ...(current?.raw_api_response as object || {}),
            documents: updatedDocs,
          },
          assessment_date: now,
          updated_at:      now,
        },
        { onConflict: 'plot_id' }
      )
      .select()
      .single()

    if (upsertErr) throw upsertErr

    // Sync relevant fields back to coffee_plots
    const plotUpdate: Record<string, unknown> = {
      eudr_risk_assessed_at: now,
    }
    if (riskLevel)           plotUpdate.eudr_risk_level = riskLevel
    if (documentType === 'land_title' && documentUrl)
      plotUpdate.land_ownership_doc_url = documentUrl
    if (afaGeoMappingId)     plotUpdate.afa_geo_mapping_id = afaGeoMappingId

    await supabase
      .from('coffee_plots')
      .update(plotUpdate)
      .eq('id', plotId)

    return NextResponse.json({ success: true, compliance: upserted })
  } catch (err) {
    console.error('POST /api/coffee/eudr error:', err)
    return NextResponse.json({ error: 'Failed to update EUDR compliance' }, { status: 500 })
  }
}
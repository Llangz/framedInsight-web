'use server'

import { createClient } from '@supabase/supabase-js'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'

interface CreatePlotParams {
  plotName: string
  variety?: string
  totalTrees?: number
  establishmentYear?: number
  polygon?: any
  areaHa?: number
  centroidLat?: number
  centroidLng?: number
  eudrGeolocationFormat?: 'point' | 'polygon'
}

interface CreateCoopManagedFarmParams {
  ownerName: string
  phone?: string
  farmName: string
  county: string
  subCounty?: string
  ward?: string
  coopFactoryId?: string
  coopMemberNumber?: string
  plot?: CreatePlotParams
}

export async function createCoopManagedFarm(params: CreateCoopManagedFarmParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return { success: false, error: 'Server misconfiguration.' }
  }

  // Use service role to bypass RLS during setup
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // Generate claim code/token: e.g. KP-8X2-9YT
    const rawCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const claimToken = `KP-${rawCode.slice(0, 3)}-${rawCode.slice(3)}`

    // Get cooperative's enterprise
    const { data: coop } = await supabaseAdmin
      .from('cooperatives')
      .select('primary_enterprise')
      .eq('id', access.coopId)
      .single()

    const enterprise = coop?.primary_enterprise || 'coffee'

    // 1. Insert farm
    const { data: farm, error: farmError } = await supabaseAdmin
      .from('farms')
      .insert({
        farm_name: params.farmName.trim(),
        owner_name: params.ownerName.trim(),
        phone: params.phone?.trim() || null,
        county: params.county,
        sub_county: params.subCounty?.trim() || null,
        ward: params.ward?.trim() || null,
        managed_by_coop_id: access.coopId,
        coop_factory_id: params.coopFactoryId || null,
        is_coop_managed: true,
        claim_token: claimToken,
        farm_types: [enterprise],
        primary_enterprise: enterprise,
      })
      .select('id')
      .single()

    if (farmError || !farm) {
      console.error('Error creating farm:', farmError)
      return { success: false, error: farmError?.message || 'Failed to create farm profile' }
    }

    // 2. Insert plot if provided
    if (params.plot) {
      const p = params.plot
      const { error: plotError } = await supabaseAdmin
        .from('coffee_plots')
        .insert({
          farm_id: farm.id,
          plot_name: p.plotName.trim(),
          variety: p.variety?.trim() || 'SL28',
          total_trees: p.totalTrees || 0,
          establishment_year: p.establishmentYear || null,
          gps_latitude: p.centroidLat || null,
          gps_longitude: p.centroidLng || null,
          gps_polygon: p.polygon || null,
          area_hectares: p.areaHa || null,
          land_size_acres: p.areaHa ? Number((p.areaHa * 2.471).toFixed(2)) : null,
          eudr_risk_level: 'low', // Default newly mapped plots to low risk
          eudr_risk_assessed_at: new Date().toISOString(),
        })

      if (plotError) {
        console.error('Error creating plot:', plotError)
        // Rollback farm creation
        await supabaseAdmin.from('farms').delete().eq('id', farm.id)
        return { success: false, error: plotError.message || 'Failed to save plot coordinates' }
      }

      // Automatically create EUDR compliance status row
      await supabaseAdmin.from('coffee_eudr_compliance').insert({
        farm_id: farm.id,
        assessment_date: new Date().toISOString().split('T')[0],
        risk_level: 'low',
        compliance_status: 'compliant',
        notes: 'Cooperative mapped plot.',
      })
    }

    revalidatePath('/dashboard/cooperative')
    revalidatePath('/dashboard/cooperative/farmers')
    return { success: true, farmId: farm.id, claimToken }
  } catch (error: any) {
    return { success: false, error: error.message || 'Server error' }
  }
}

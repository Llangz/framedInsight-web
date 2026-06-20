import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import EudrClient from './EudrClient'

export default async function CooperativeEudrPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // 1. Fetch cooperative details
  const { data: coop } = await supabase
    .from('cooperatives')
    .select('cooperative_name')
    .eq('id', access.coopId)
    .single()

  if (!coop) {
    redirect('/onboarding')
  }

  // 2. Fetch farms
  const { data: farms = [] } = await supabase
    .from('farms')
    .select('id, farm_name, owner_name')
    .eq('managed_by_coop_id', access.coopId)

  const farmIds = (farms || []).map(f => f.id)

  // 3. Fetch plots with coordinates or polygons
  let plots: any[] = []
  if (farmIds.length > 0) {
    const { data: plotsData } = await supabase
      .from('coffee_plots')
      .select('id, farm_id, plot_name, variety, total_trees, gps_latitude, gps_longitude, gps_polygon, area_hectares, eudr_risk_level, afa_geo_mapping_id, land_size_acres')
      .in('farm_id', farmIds)
      .order('plot_name')
    if (plotsData) plots = plotsData
  }

  // Format plot rows with owner information
  const formattedPlots = plots.map(p => {
    const farm = farms.find(f => f.id === p.farm_id)
    return {
      id: p.id,
      plot_name: p.plot_name,
      variety: p.variety || 'SL28',
      total_trees: p.total_trees,
      gps_latitude: p.gps_latitude,
      gps_longitude: p.gps_longitude,
      gps_polygon: p.gps_polygon,
      area_hectares: p.area_hectares || (p.land_size_acres ? Number(p.land_size_acres / 2.471) : 0),
      eudr_risk_level: p.eudr_risk_level || 'low',
      afa_geo_mapping_id: p.afa_geo_mapping_id || null,
      land_size_acres: p.land_size_acres || (p.area_hectares ? Number(p.area_hectares * 2.471) : 0),
      owner_name: farm?.owner_name || 'Unknown',
      farm_name: farm?.farm_name || 'Member Farm',
    }
  })

  return (
    <EudrClient
      plots={formattedPlots}
      coopName={coop.cooperative_name}
    />
  )
}

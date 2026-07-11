import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import { unwrapOr } from '@/lib/safe-query'
import EudrClient from './EudrClient'

export default async function CooperativeEudrPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // 1. Fetch cooperative details
  //
  // Was `.single()` — throws on zero rows, making the `if (!coop)` redirect
  // below unreachable dead code. See app/dashboard/cooperative/page.tsx for
  // the full explanation; same fix here.
  const { data: coop } = await supabase
    .from('cooperatives')
    .select('cooperative_name')
    .eq('id', access.coopId)
    .maybeSingle()

  if (!coop) {
    redirect('/onboarding')
  }

  // 2. Fetch farms
  //
  // `const { data: farms = [] }` looks like a safe default but never
  // actually fires: Supabase returns `data: null` (not `undefined`) on a
  // query error, and a default parameter only applies to `undefined`. A
  // failed fetch here was falling through as `farms = null`, then every
  // `(farms || []).x` below masked it as "zero member farms" - see
  // lib/safe-query.ts for why that's a trust problem for a cooperative-wide
  // EUDR compliance view specifically.
  const farmsRes = await supabase
    .from('farms')
    .select('id, farm_name, owner_name')
    .eq('managed_by_coop_id', access.coopId)
  const farms = unwrapOr(farmsRes as any, [] as any[], 'farms')

  const farmIds = farms.map((f: any) => f.id)

  // 3. Fetch plots with coordinates or polygons
  let plots: any[] = []
  if (farmIds.length > 0) {
    const plotsRes = await supabase
      .from('coffee_plots')
      .select('id, farm_id, plot_name, variety, total_trees, gps_latitude, gps_longitude, gps_polygon, area_hectares, eudr_risk_level, afa_geo_mapping_id, land_size_acres')
      .in('farm_id', farmIds)
      .order('plot_name')
    plots = unwrapOr(plotsRes as any, [] as any[], 'coffee_plots')
  }

  // Format plot rows with owner information
  const formattedPlots = plots.map(p => {
    const farm = farms.find((f: any) => f.id === p.farm_id)
    return {
      id: p.id,
      farm_id: p.farm_id,
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
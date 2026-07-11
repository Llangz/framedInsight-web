import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import FactoriesClient from './FactoriesClient'

export default async function CooperativeFactoriesPage() {
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
    .select('primary_enterprise')
    .eq('id', access.coopId)
    .maybeSingle()
  if (!coop) {
    redirect('/onboarding')
  }

  // 2. Fetch factories
  const { data: factories = [] } = await supabase
    .from('coop_factories')
    .select('*')
    .eq('cooperative_id', access.coopId)
    .order('factory_name')

  // 3. Fetch farms to aggregate stats
  const { data: farmsData } = await supabase
    .from('farms')
    .select('id, coop_factory_id')
    .eq('managed_by_coop_id', access.coopId)

  const farms = farmsData || []
  const farmIds = farms.map(f => f.id)

  // 4. Fetch plots for tree counts
  let plots: any[] = []
  if (farmIds.length > 0) {
    const { data: plotsData } = await supabase
      .from('coffee_plots')
      .select('farm_id, total_trees, land_size_acres, area_hectares')
      .in('farm_id', farmIds)
    if (plotsData) plots = plotsData
  }

  // Compute aggregated statistics per factory in JS
  const factoryStats = (factories || []).map(factory => {
    const factoryFarms = farms.filter(f => f.coop_factory_id === factory.id)
    const factoryFarmIds = factoryFarms.map(f => f.id)
    const factoryPlots = plots.filter(p => factoryFarmIds.includes(p.farm_id))

    const farmCount = factoryFarms.length
    const totalTrees = factoryPlots.reduce((sum, p) => sum + (p.total_trees || 0), 0)
    const totalAcreage = factoryPlots.reduce(
      (sum, p) => sum + Number(p.land_size_acres || p.area_hectares * 2.471 || 0),
      0
    )

    return {
      ...factory,
      farmCount,
      totalTrees,
      totalAcreage,
    }
  })

  // Get stats for unassigned farmers
  const unassignedFarms = farms.filter(f => !f.coop_factory_id)
  const unassignedFarmIds = unassignedFarms.map(f => f.id)
  const unassignedPlots = plots.filter(p => unassignedFarmIds.includes(p.farm_id))

  const unassignedStats = {
    farmCount: unassignedFarms.length,
    totalTrees: unassignedPlots.reduce((sum, p) => sum + (p.total_trees || 0), 0),
    totalAcreage: unassignedPlots.reduce(
      (sum, p) => sum + Number(p.land_size_acres || p.area_hectares * 2.471 || 0),
      0
    ),
  }

  return (
    <FactoriesClient
      factories={factoryStats}
      unassignedStats={unassignedStats}
      primaryEnterprise={coop.primary_enterprise || 'coffee'}
    />
  )
}
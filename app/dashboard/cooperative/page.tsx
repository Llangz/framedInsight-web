import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import { Users, Trees, Landmark, Map, FileCheck2, Milestone } from 'lucide-react'

// Dynamically import the map component to avoid SSR errors with Leaflet
const CoopFleetMap = dynamic(
  () => import('@/components/cooperative/CoopFleetMap'),
  { ssr: false }
)

export default async function CooperativeDashboardOverview() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // 1. Fetch Cooperative details
  const { data: coop } = await supabase
    .from('cooperatives')
    .select('*')
    .eq('id', access.coopId)
    .single()

  if (!coop) {
    redirect('/onboarding')
  }

  // 2. Fetch all farms managed by this cooperative
  const { data: farms = [] } = await supabase
    .from('farms')
    .select('id, farm_name, owner_name, county, sub_county, ward, land_size_acres, is_coop_managed, claim_token')
    .eq('managed_by_coop_id', access.coopId)

  const farmIds = (farms || []).map(f => f.id)

  // 3. Fetch all plots for these farms
  let plots: any[] = []
  if (farmIds.length > 0) {
    const { data: plotsData } = await supabase
      .from('coffee_plots')
      .select('id, farm_id, plot_name, variety, total_trees, gps_latitude, gps_longitude, gps_polygon, area_hectares, eudr_risk_level, land_size_acres')
      .in('farm_id', farmIds)
    if (plotsData) plots = plotsData
  }

  // Calculate Cumulative Metrics
  const totalFarmers = farms?.length || 0
  const coopManagedCount = farms?.filter(f => f.is_coop_managed).length || 0
  const claimedCount = totalFarmers - coopManagedCount

  const totalTrees = plots.reduce((sum, p) => sum + (p.total_trees || 0), 0)
  
  // Total acreage: prefer plot acreage if available, fallback to farm acreage
  const totalPlotAcreage = plots.reduce((sum, p) => sum + Number(p.land_size_acres || p.area_hectares * 2.471 || 0), 0)
  const totalAcreage = totalPlotAcreage > 0 ? totalPlotAcreage : farms.reduce((sum, f) => sum + Number(f.land_size_acres || 0), 0)

  // EUDR compliance counts
  const mappedPlots = plots.filter(p => p.gps_latitude && p.gps_longitude)
  const polygonPlots = plots.filter(p => p.gps_polygon)
  const lowRiskPlots = plots.filter(p => p.eudr_risk_level === 'low')
  const eudrRate = plots.length > 0 ? Math.round((lowRiskPlots.length / plots.length) * 100) : 0

  // Varieties breakdown
  const varietiesMap: Record<string, number> = {}
  plots.forEach(p => {
    const v = p.variety?.trim() || 'Unknown'
    varietiesMap[v] = (varietiesMap[v] || 0) + (p.total_trees || 0)
  })
  const varietiesList = Object.entries(varietiesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // Top 5

  // Map markers & polygons data
  const mapPlots = plots
    .filter(p => p.gps_latitude && p.gps_longitude)
    .map(p => {
      const farm = farms.find(f => f.id === p.farm_id)
      return {
        id: p.id,
        plot_name: p.plot_name,
        gps_latitude: p.gps_latitude,
        gps_longitude: p.gps_longitude,
        gps_polygon: p.gps_polygon,
        total_trees: p.total_trees,
        land_size_acres: p.land_size_acres,
        eudr_risk_level: p.eudr_risk_level,
        owner_name: farm?.owner_name || 'Unknown',
        farm_name: farm?.farm_name || 'Member Farm',
      }
    })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A2D35] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{coop.cooperative_name}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Overview for {coop.county} County · {coop.sub_county || ''} · {coop.ward || ''}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-[#0D0F14] border border-[#2A2D35] rounded-xl text-center">
            <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Enterprise</span>
            <span className="text-sm font-semibold text-emerald-400 capitalize">{coop.primary_enterprise}</span>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Farmers */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Users size={22} />
          </div>
          <div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Total Members</span>
            <span className="text-2xl font-bold block mt-0.5 text-white">{totalFarmers}</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              {claimedCount} claimed · {coopManagedCount} coop-mapped
            </span>
          </div>
        </div>

        {/* Total Acreage */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Milestone size={22} />
          </div>
          <div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Total Acreage</span>
            <span className="text-2xl font-bold block mt-0.5 text-white">{totalAcreage.toFixed(1)} ac</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              Across {plots.length} active plots
            </span>
          </div>
        </div>

        {/* Total Trees */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Trees size={22} />
          </div>
          <div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Total Trees</span>
            <span className="text-2xl font-bold block mt-0.5 text-white">{totalTrees.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              Avg {totalFarmers > 0 ? Math.round(totalTrees / totalFarmers) : 0} trees/farmer
            </span>
          </div>
        </div>

        {/* EUDR Readiness */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <FileCheck2 size={22} />
          </div>
          <div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">EUDR Mapped</span>
            <span className="text-2xl font-bold block mt-0.5 text-white">{eudrRate}%</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              {polygonPlots.length} polygons · {mappedPlots.length - polygonPlots.length} points
            </span>
          </div>
        </div>

      </div>

      {/* ── Fleet Map & Varieties Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Fleet map (left 2 cols) */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Map size={16} className="text-emerald-500" />
              Member Geolocation Fleet Map
            </h3>
            <span className="text-xs text-zinc-500">{mapPlots.length} of {plots.length} plots visible</span>
          </div>
          <CoopFleetMap plots={mapPlots} className="h-[420px]" />
        </div>

        {/* Varieties and Claim overview (right 1 col) */}
        <div className="space-y-6">
          
          {/* Top Varieties */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Top Coffee Varieties</h3>
            <div className="space-y-3.5">
              {varietiesList.length > 0 ? (
                varietiesList.map((v, index) => {
                  const percent = totalTrees > 0 ? Math.round((v.count / totalTrees) * 100) : 0
                  return (
                    <div key={v.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>{v.name}</span>
                        <span className="text-zinc-400">{v.count.toLocaleString()} trees ({percent}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-xs text-zinc-500">No plots mapped with variety data yet.</p>
              )}
            </div>
          </div>

          {/* EUDR Grouping compliance status */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-3.5">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">EUDR Grouping Status</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Under EUDR rules, cooperatives can file a single Due Diligence Statement for all member plots. Plots with land size &ge; 4 hectares require polygons, others can be centroids.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-[#0A0C10] border border-[#2A2D35] p-3 rounded-xl text-center">
                <span className="block text-lg font-bold text-emerald-400">{polygonPlots.length}</span>
                <span className="text-[10px] text-zinc-500 font-medium">Polygons Mapped</span>
              </div>
              <div className="bg-[#0A0C10] border border-[#2A2D35] p-3 rounded-xl text-center">
                <span className="block text-lg font-bold text-blue-400">{mappedPlots.length - polygonPlots.length}</span>
                <span className="text-[10px] text-zinc-500 font-medium">Centroids Mapped</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import { formatPhoneForDisplay } from '@/lib/validation'
import { Plus, User, MapPin, Copy, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react'

export default async function CooperativeFarmersPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // 1. Fetch member farms
  const { data: farms = [] } = await supabase
    .from('farms')
    .select('id, farm_name, owner_name, phone, county, sub_county, ward, is_coop_managed, claim_token, coop_factory_id')
    .eq('managed_by_coop_id', access.coopId)
    .order('owner_name')

  // 2. Fetch washing stations/factories for label mapping
  const { data: factories = [] } = await supabase
    .from('coop_factories')
    .select('id, factory_name')
    .eq('cooperative_id', access.coopId)

  const factoryMap = new Map(factories?.map(f => [f.id, f.factory_name]))

  // 3. Fetch plot summary stats (trees & mapping) grouped by farm
  const farmIds = (farms || []).map(f => f.id)
  let plotStatsMap = new Map<string, { count: number; totalTrees: number; hasPolygon: boolean }>()

  if (farmIds.length > 0) {
    const { data: plots = [] } = await supabase
      .from('coffee_plots')
      .select('farm_id, id, total_trees, gps_polygon')
      .in('farm_id', farmIds)

    plots?.forEach(p => {
      const stats = plotStatsMap.get(p.farm_id) || { count: 0, totalTrees: 0, hasPolygon: false }
      stats.count += 1
      stats.totalTrees += p.total_trees || 0
      if (p.gps_polygon) stats.hasPolygon = true
      plotStatsMap.set(p.farm_id, stats)
    })
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">
      
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2D35] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Member Farmers</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage your cooperative members, view their mapping statuses, and distribute claim codes.
          </p>
        </div>
        <Link
          href="/dashboard/cooperative/farmers/new"
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm text-sm"
        >
          <Plus size={16} />
          Map a Farmer
        </Link>
      </div>

      {/* ── Table/List Grid ── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
        {farms.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2D35] bg-[#0A0C10]/40 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Farmer / Farm</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Station</th>
                  <th className="px-6 py-4 text-center">Coffee Trees</th>
                  <th className="px-6 py-4 text-center">EUDR Mapping</th>
                  <th className="px-6 py-4">Claim Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35] text-sm">
                {farms.map(f => {
                  const stats = plotStatsMap.get(f.id) || { count: 0, totalTrees: 0, hasPolygon: false }
                  const factoryLabel = f.coop_factory_id ? factoryMap.get(f.coop_factory_id) || 'Unknown' : 'Unassigned'
                  
                  return (
                    <tr key={f.id} className="hover:bg-zinc-900/30 transition-colors">
                      {/* Farmer & Farm */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{f.owner_name}</div>
                        <div className="text-zinc-500 text-xs mt-0.5">{f.farm_name}</div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4 text-zinc-300">
                        {f.phone ? formatPhoneForDisplay(f.phone) : 'No phone'}
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4">
                        <div className="text-zinc-300">{f.ward || 'N/A'}</div>
                        <div className="text-zinc-500 text-xs">{f.sub_county || f.county}</div>
                      </td>

                      {/* Wet Mill / Factory */}
                      <td className="px-6 py-4 text-zinc-300">
                        {factoryLabel}
                      </td>

                      {/* Coffee Trees count */}
                      <td className="px-6 py-4 text-center font-medium text-zinc-200">
                        {stats.totalTrees.toLocaleString()}
                        <span className="block text-[10px] text-zinc-500">{stats.count} plot(s)</span>
                      </td>

                      {/* EUDR Mapping status */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          {stats.count === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-950/20 px-2 py-0.5 rounded-full border border-red-900/40">
                              <AlertTriangle size={11} /> Unmapped
                            </span>
                          ) : stats.hasPolygon ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-900/40">
                              <CheckCircle2 size={11} /> Polygon Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-950/20 px-2 py-0.5 rounded-full border border-blue-900/40">
                              Centroid Only
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Claim token */}
                      <td className="px-6 py-4">
                        {f.is_coop_managed ? (
                          <div className="flex items-center gap-2">
                            <code className="text-emerald-400 bg-[#0A0C10] border border-[#2A2D35] px-2 py-1 rounded font-mono text-xs select-all">
                              {f.claim_token}
                            </code>
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Unclaimed</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800/40 px-2 py-0.5 rounded-full border border-zinc-700/40">
                            <Smartphone size={11} /> Claimed & Active
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-zinc-900 border border-[#2A2D35] flex items-center justify-center mx-auto text-zinc-500">
              <User size={20} />
            </div>
            <h3 className="text-base font-bold text-white">No farmers mapped yet</h3>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">
              Start mapping your members so you can track coffee varieties, crop counts, and generate compliant EUDR polygon maps.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/cooperative/farmers/new"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
              >
                Map Your First Farmer
              </Link>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

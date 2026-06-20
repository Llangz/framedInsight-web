'use client'

import { useState } from 'react'
import { createFactory, deleteFactory } from './actions'
import { Warehouse, Plus, Trash2, Milestone, Trees, Users, AlertCircle } from 'lucide-react'

interface FactoryStats {
  id: string
  factory_name: string
  factory_code: string | null
  branch_type: string | null
  farmCount: number
  totalTrees: number
  totalAcreage: number
}

interface UnassignedStats {
  farmCount: number
  totalTrees: number
  totalAcreage: number
}

interface Props {
  factories: FactoryStats[]
  unassignedStats: UnassignedStats
  primaryEnterprise: string
}

export default function FactoriesClient({ factories, unassignedStats, primaryEnterprise }: Props) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCoffee = primaryEnterprise === 'coffee'
  const isDairy = primaryEnterprise === 'dairy'

  const branchTypeName = isCoffee ? 'Washing Station (Factory)' :
                         isDairy ? 'Milk Cooling Plant' :
                         primaryEnterprise === 'poultry' ? 'Poultry Depot' :
                         'Branch'

  const defaultBranchType = isCoffee ? 'washing_station' :
                            isDairy ? 'milk_cooling_plant' :
                            primaryEnterprise === 'poultry' ? 'poultry_collection_point' :
                            'other'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)

    const res = await createFactory({
      factoryName: name,
      factoryCode: code || undefined,
      branchType: defaultBranchType as any,
    })

    if (!res.success) {
      setError(res.error || 'Failed to add branch')
    } else {
      setName('')
      setCode('')
    }
    setLoading(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? Farmers assigned to this factory will be unassigned.`)) {
      return
    }

    const res = await deleteFactory(id)
    if (!res.success) {
      alert(`Error deleting: ${res.error}`)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">
      
      {/* ── Header ── */}
      <div className="border-b border-[#2A2D35] pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">{branchTypeName}s</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Add and manage your cooperative washing stations, wet mills, or collection centers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ── Left Column: Add New Form ── */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus size={18} className="text-emerald-500" />
            Add New {branchTypeName}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                {branchTypeName} Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={isCoffee ? "e.g. Karogoto Factory" : "e.g. Kiambaa Cooling Plant"}
                className="w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Traceability Code / Abbreviation
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. KRG"
                maxLength={10}
                className="w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                Used to generate lot codes and trace shipments back to this specific station.
              </p>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-xl flex items-start gap-2 text-xs text-red-300">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition shadow-sm cursor-pointer"
            >
              {loading ? 'Adding…' : 'Add Station'}
            </button>
          </form>
        </div>

        {/* ── Right Column: List of Stations ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Unassigned catchment summary card */}
            {unassignedStats.farmCount > 0 && (
              <div className="bg-zinc-950 border border-[#2A2D35] rounded-2xl p-5 flex flex-col justify-between h-[160px] border-dashed">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Unassigned Mappings</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">Default Group</span>
                  </div>
                  <h4 className="text-base font-bold text-white mt-1.5">Pending Catchment</h4>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div>
                      <span className="block text-sm font-bold text-zinc-300">{unassignedStats.farmCount}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-medium">Farms</span>
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-zinc-300">{unassignedStats.totalTrees.toLocaleString()}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-medium">Trees</span>
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-zinc-300">{unassignedStats.totalAcreage.toFixed(1)}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-medium">Acres</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* List of active factories */}
            {factories.length > 0 ? (
              factories.map(f => (
                <div key={f.id} className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex flex-col justify-between h-[180px] hover:border-zinc-700 transition">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono tracking-wider uppercase">
                          {f.factory_code || 'CODE'}
                        </span>
                        <h4 className="text-base font-bold text-white mt-1.5 truncate pr-8">{f.factory_name}</h4>
                      </div>
                      <button
                        onClick={() => handleDelete(f.id, f.factory_name)}
                        className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition"
                        title="Delete branch"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Aggregated statistics */}
                  <div className="border-t border-[#2A2D35] pt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="block text-sm font-bold text-white">{f.farmCount}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold flex items-center justify-center gap-1">
                        <Users size={8} /> Members
                      </span>
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-white">{f.totalTrees.toLocaleString()}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold flex items-center justify-center gap-1">
                        <Trees size={8} /> Trees
                      </span>
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-white">{f.totalAcreage.toFixed(1)}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold flex items-center justify-center gap-1">
                        <Milestone size={8} /> Acres
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-1 md:col-span-2 bg-[#0D0F14]/40 border border-[#2A2D35] border-dashed rounded-2xl p-8 text-center space-y-2">
                <Warehouse size={32} className="text-zinc-600 mx-auto" />
                <h4 className="text-sm font-bold text-zinc-300">No active {branchTypeName}s</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Add wet mills, cooling plants, or depots to assign mapped farms for traceability reports.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}

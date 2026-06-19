'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Database } from '@/lib/database.types'
import { updateCoffeePlot } from '../../actions'
import type { BoundaryResult } from '@/components/coffee/PlotBoundaryMapper'

const PlotBoundaryMapper = dynamic(
  () => import('@/components/coffee/PlotBoundaryMapper'),
  { ssr: false, loading: () => (
    <div className="h-64 bg-[#0A0C10] rounded-lg flex items-center justify-center">
      <p className="text-[#6B7280] text-sm">Loading map…</p>
    </div>
  )}
)

type CoffeePlot = Database['public']['Tables']['coffee_plots']['Row']

interface EditPlotClientProps {
  plot: CoffeePlot
}

const FIELD = "w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-white placeholder-[#4B5563]"
const LABEL = "block text-sm font-semibold text-[#9CA3AF] mb-1.5"

export default function EditPlotClient({ plot }: EditPlotClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showMapper, setShowMapper] = useState(false)
  const [boundary, setBoundary] = useState<BoundaryResult | null>(null)
  const hasExistingGps = !!(plot.gps_polygon || (plot.gps_latitude && plot.gps_longitude))

  const [formData, setFormData] = useState({
    plot_name: plot.plot_name || '',
    variety: plot.variety || '',
    total_trees: plot.total_trees?.toString() || '',
    productive_trees: plot.productive_trees?.toString() || '',
    land_size_acres: plot.land_size_acres?.toString() || '',
    establishment_year: plot.establishment_year?.toString() || '',
    afa_geo_mapping_id: plot.afa_geo_mapping_id || '',
  })

  function set(field: string, value: string) {
    setFormData(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const updates: any = {
        plot_name: formData.plot_name,
        variety: formData.variety || null,
        total_trees: formData.total_trees ? Number(formData.total_trees) : 0,
        productive_trees: formData.productive_trees ? Number(formData.productive_trees) : null,
        land_size_acres: formData.land_size_acres ? Number(formData.land_size_acres) : null,
        establishment_year: formData.establishment_year ? Number(formData.establishment_year) : null,
        afa_geo_mapping_id: formData.afa_geo_mapping_id.trim() || null,
      }

      // Include boundary data if mapper was used
      if (boundary) {
        updates.gps_polygon = boundary.polygon
        updates.gps_latitude = boundary.centroid.lat
        updates.gps_longitude = boundary.centroid.lng
        updates.area_hectares = boundary.areaHa
      }

      await updateCoffeePlot(plot.id, updates)
      setSuccess('Plot updated successfully!')
      setTimeout(() => router.push(`/dashboard/coffee/plots/${plot.id}`), 1200)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/dashboard/coffee/plots/${plot.id}`}
            className="w-10 h-10 flex items-center justify-center bg-[#0D0F14] border border-[#2A2D35] rounded-lg hover:bg-[#161921] text-[#9CA3AF] transition"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Plot</h1>
            <p className="text-[#6B7280] text-sm mt-0.5">{plot.plot_name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Incomplete profile banner ── */}
          {(!plot.variety || !plot.total_trees || !plot.establishment_year) && !success && (
            <div className="bg-amber-950 border border-amber-700 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div>
                <p className="text-amber-300 text-sm font-bold">Plot profile is incomplete</p>
                <p className="text-amber-400/80 text-xs mt-0.5">
                  {[
                    !plot.variety && 'variety',
                    !plot.total_trees && 'tree count',
                    !plot.establishment_year && 'establishment year',
                  ].filter(Boolean).join(', ')} {' '}
                  {(!plot.variety && !plot.total_trees && !plot.establishment_year) ? 'are' : 'is'} missing.
                  Fill these in for better tracking and yield forecasts.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-900/40 text-red-300 rounded-xl border border-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-900/40 text-green-300 rounded-xl border border-green-700 text-sm">
              {success}
            </div>
          )}

          {/* ── Plot details ── */}
          <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-6 space-y-5">
            <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">Plot Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className={LABEL}>Plot Name</label>
                <input type="text" className={FIELD} value={formData.plot_name} onChange={e => set('plot_name', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Variety</label>
                <select className={FIELD} value={formData.variety} onChange={e => set('variety', e.target.value)}>
                  <option value="">Select variety…</option>
                  <option value="SL28">SL28</option>
                  <option value="SL34">SL34</option>
                  <option value="Ruiru 11">Ruiru 11</option>
                  <option value="Batian">Batian</option>
                  <option value="K7">K7</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Establishment Year</label>
                <input type="number" className={FIELD} placeholder="e.g. 2015" value={formData.establishment_year} onChange={e => set('establishment_year', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Total Trees</label>
                <input type="number" className={FIELD} value={formData.total_trees} onChange={e => set('total_trees', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Productive Trees</label>
                <input type="number" className={FIELD} value={formData.productive_trees} onChange={e => set('productive_trees', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Land Size (acres)</label>
                <input type="number" step="0.01" className={FIELD} value={formData.land_size_acres} onChange={e => set('land_size_acres', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── GPS Boundary section ── */}
          <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">GPS Boundary</h2>
              {hasExistingGps && !boundary && (
                <span className="text-xs text-green-400 font-semibold">✓ Recorded</span>
              )}
              {boundary && (
                <span className="text-xs text-green-400 font-semibold">✓ New boundary ready</span>
              )}
            </div>

            {!hasExistingGps && !boundary && !showMapper && (
              <div className="mt-3 rounded-lg border border-dashed border-slate-600 bg-slate-800/50 px-4 py-6 flex flex-col items-center text-center gap-3">
                <p className="text-sm text-slate-300 font-medium">No GPS boundary recorded yet</p>
                <p className="text-xs text-slate-500 max-w-xs">Required for EUDR compliance and satellite monitoring. Walk the perimeter or draw on the map.</p>
                <button
                  type="button"
                  onClick={() => setShowMapper(true)}
                  className="bg-green-700 hover:bg-green-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition"
                >
                  🗺️ Map this plot
                </button>
              </div>
            )}

            {hasExistingGps && !boundary && !showMapper && (
              <div className="mt-3 flex items-center justify-between bg-green-950 border border-green-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-green-400 text-sm font-semibold">
                    {plot.gps_polygon ? 'Polygon boundary recorded' : 'Point coordinate recorded'}
                  </p>
                  {plot.area_hectares && (
                    <p className="text-green-500 text-xs mt-0.5">{plot.area_hectares.toFixed(3)} ha</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMapper(true)}
                  className="text-xs text-slate-400 hover:text-white border border-slate-600 rounded-lg px-3 py-1.5 transition"
                >
                  Re-map
                </button>
              </div>
            )}

            {boundary && !showMapper && (
              <div className="mt-3 flex items-center justify-between bg-green-950 border border-green-700 rounded-lg px-4 py-3">
                <div>
                  <p className="text-green-400 text-sm font-semibold">New boundary captured</p>
                  <p className="text-green-500 text-xs mt-0.5">
                    {boundary.areaHa.toFixed(3)} ha · {boundary.pointCount} GPS points · perimeter {boundary.perimeterM >= 1000
                      ? `${(boundary.perimeterM / 1000).toFixed(2)} km`
                      : `${Math.round(boundary.perimeterM)} m`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setBoundary(null); setShowMapper(true) }}
                  className="text-xs text-slate-400 hover:text-white border border-slate-600 rounded-lg px-3 py-1.5 transition"
                >
                  Re-map
                </button>
              </div>
            )}

            {showMapper && (
              <div className="mt-4 rounded-xl overflow-hidden border border-amber-600">
                <div className="px-4 py-2.5 bg-amber-900/40 border-b border-amber-700 flex items-center justify-between">
                  <p className="text-amber-300 text-sm font-semibold">Walk the perimeter or tap corners, then tap Save</p>
                  <button type="button" onClick={() => setShowMapper(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-600">Cancel</button>
                </div>
                <div className="p-3">
                  <PlotBoundaryMapper
                    onComplete={(result) => { setBoundary(result); setShowMapper(false) }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── AFA / EUDR Compliance ── */}
          <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">EUDR Compliance</h2>
                <p className="text-xs text-[#4B5563] mt-1 leading-relaxed">
                  AFA (Agriculture and Food Authority) is the government body co-ordinating Kenya's EUDR
                  geo-mapping programme. Once your plot has been mapped by AFA or your cooperative, enter
                  the ID they assign here — exporters and cooperatives need this to submit due-diligence
                  statements to EU buyers.
                </p>
              </div>
              {formData.afa_geo_mapping_id && (
                <span className="flex-shrink-0 text-xs font-bold text-green-400 bg-green-950 border border-green-800 rounded-lg px-2.5 py-1">
                  ✓ AFA Registered
                </span>
              )}
            </div>

            <div>
              <label className={LABEL}>
                AFA Geo-Mapping ID
                <span className="ml-2 text-xs font-normal text-[#4B5563]">(optional — from AFA or your cooperative)</span>
              </label>
              <input
                type="text"
                className={FIELD}
                placeholder="e.g. AFA-KE-2025-00123456"
                value={formData.afa_geo_mapping_id}
                onChange={e => set('afa_geo_mapping_id', e.target.value)}
              />
              {formData.afa_geo_mapping_id && (
                <p className="mt-1.5 text-xs text-green-500">
                  This plot will be shown as AFA-registered on your EUDR compliance dashboard.
                </p>
              )}
              {!formData.afa_geo_mapping_id && (
                <p className="mt-1.5 text-xs text-[#4B5563]">
                  Don't have this yet? Contact your cooperative society or the nearest AFA county office.
                  Kenya's geo-mapping programme is free for smallholder farmers.
                </p>
              )}
            </div>
          </div>

          {/* ── Save / Cancel ── */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-xl font-bold text-sm transition"
            >
              {loading ? 'Saving…' : 'Save changes'}
            </button>
            <Link
              href={`/dashboard/coffee/plots/${plot.id}`}
              className="flex-1 py-3 bg-[#0D0F14] hover:bg-[#161921] border border-[#2A2D35] text-[#9CA3AF] rounded-xl font-bold text-sm text-center transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
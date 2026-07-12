'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { addCoffeePlot } from '../actions'
import { queueCoffeeEvent } from '@/lib/offline-db'
import type { BoundaryResult } from '@/components/coffee/PlotBoundaryMapper'

// Leaflet uses `window` — must be loaded client-side only
const PlotBoundaryMapper = dynamic(
  () => import('@/components/coffee/PlotBoundaryMapper'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[380px] rounded-xl bg-slate-900 border border-white/10">
        <div className="text-center text-slate-400">
          <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-emerald-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm">Loading satellite map…</p>
        </div>
      </div>
    ),
  }
)

// ── Steps ──────────────────────────────────────────────────────────────────────
type Step = 'details' | 'map' | 'review'

export default function AddPlotClient({ farmId }: { farmId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedOffline, setSavedOffline] = useState(false)
  const [skipMap, setSkipMap] = useState(false)

  // Plot details
  const [formData, setFormData] = useState({
    plot_name: '',
    variety: 'SL28',
    total_trees: '',
    productive_trees: '',
    land_size_acres: '',
    establishment_year: new Date().getFullYear().toString(),
  })

  // Boundary data from mapper
  const [boundary, setBoundary] = useState<BoundaryResult | null>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleBoundaryComplete(result: BoundaryResult) {
    setBoundary(result)
    // Auto-fill acreage from mapped area if user hasn't entered a value
    if (!formData.land_size_acres || formData.land_size_acres === '0') {
      setFormData(f => ({
        ...f,
        land_size_acres: (result.areaHa * 2.47105).toFixed(2),
      }))
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    const payload = {
      plot_name: formData.plot_name,
      variety: formData.variety,
      total_trees: parseInt(formData.total_trees) || 0,
      productive_trees: parseInt(formData.productive_trees) || 0,
      land_size_acres: parseFloat(formData.land_size_acres) || 0,
      establishment_year: parseInt(formData.establishment_year) || new Date().getFullYear(),
      // Map data — stored as GeoJSON in gps_polygon, centroid in gps_latitude/gps_longitude.
      // Note: boundary will only be set if the satellite mapper actually loaded (it needs
      // tile imagery from the network) — a plot added fully offline will have no GPS data
      // yet and can be mapped later from the plot's own edit page.
      ...(boundary && {
        gps_polygon: boundary.polygon,
        gps_latitude: boundary.centroid.lat,
        gps_longitude: boundary.centroid.lng,
        area_hectares: boundary.areaHa,
      }),
    }

    if (!navigator.onLine) {
      try {
        await queueCoffeeEvent({
          eventId: crypto.randomUUID(),
          entityType: 'coffee_plot_create',
          farmId,
          payload,
        })
        setSavedOffline(true)
        setTimeout(() => router.push('/dashboard/coffee/plots'), 1200)
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
        setStep('review')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const result = await addCoffeePlot(payload)
      if (!result.success) {
        setError(result.error || 'Failed to add plot')
        setStep('review') // stay on review to show error
        return
      }
      router.push('/dashboard/coffee/plots')
    } catch (err: any) {
      setError(err.message || 'Failed to add plot')
      setStep('review') // stay on review to show error
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: Plot Details ───────────────────────────────────────────────────

  function renderDetails() {
    const valid =
      formData.plot_name.trim() !== '' &&
      formData.total_trees !== '' &&
      formData.land_size_acres !== ''

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-400 mb-2">Plot Name *</label>
          <input
            type="text"
            value={formData.plot_name}
            onChange={e => setFormData({ ...formData, plot_name: e.target.value })}
            required
            placeholder="e.g. Lower Slope, Block A"
            className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/60 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">Variety</label>
            <select
              value={formData.variety}
              onChange={e => setFormData({ ...formData, variety: e.target.value })}
              className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/60"
            >
              <option value="SL28">SL28</option>
              <option value="SL34">SL34</option>
              <option value="Ruiru 11">Ruiru 11</option>
              <option value="Batian">Batian</option>
              <option value="K7">K7</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">
              Acres *
              {boundary && (
                <span className="ml-2 text-xs text-emerald-400 font-normal">← from map</span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.land_size_acres}
              onChange={e => setFormData({ ...formData, land_size_acres: e.target.value })}
              required
              className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/60"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">Total Trees *</label>
            <input
              type="number"
              min="0"
              value={formData.total_trees}
              onChange={e => setFormData({ ...formData, total_trees: e.target.value })}
              required
              className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/60"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">Productive Trees</label>
            <input
              type="number"
              min="0"
              value={formData.productive_trees}
              onChange={e => setFormData({ ...formData, productive_trees: e.target.value })}
              className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/60"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-400 mb-2">Establishment Year</label>
          <input
            type="number"
            min="1950"
            max={new Date().getFullYear()}
            value={formData.establishment_year}
            onChange={e => setFormData({ ...formData, establishment_year: e.target.value })}
            className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/60"
          />
        </div>

        <button
          type="button"
          disabled={!valid}
          onClick={() => setStep('map')}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg transition-all shadow-lg"
        >
          Next: Map Your Plot →
        </button>
      </div>
    )
  }

  // ── Step 2: Map Boundary ───────────────────────────────────────────────────

  function renderMap() {
    return (
      <div className="space-y-4">
        {/* Intro */}
        <div className="p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-xl">
          <p className="text-sm text-emerald-300 font-semibold mb-1"> Map your plot boundary</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Use <strong className="text-white">Walk Boundary</strong> to physically walk your plot edge and let GPS record
            the outline, or use <strong className="text-white">Tap Corners</strong> to click points directly
            on the satellite image. Both methods calculate area automatically.
          </p>
        </div>

        {/* The actual mapper */}
        <PlotBoundaryMapper
          onComplete={handleBoundaryComplete}
          onClear={() => setBoundary(null)}
          className="w-full"
        />

        {/* Nav */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep('details')}
            className="flex-1 py-3 border border-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-medium transition-colors"
          >
            ← Back
          </button>

          {boundary ? (
            <button
              type="button"
              onClick={() => setStep('review')}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg"
            >
              Review & Register →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setSkipMap(true); setStep('review') }}
              className="flex-1 py-3 border border-white/10 text-slate-500 hover:text-slate-300 rounded-xl text-sm transition-colors"
            >
              Skip mapping →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Step 3: Review & Submit ────────────────────────────────────────────────

  function renderReview() {
    const areaHa = boundary?.areaHa
    const acres = areaHa ? (areaHa * 2.47105).toFixed(2) : formData.land_size_acres

    return (
      <div className="space-y-6">
        {savedOffline && (
          <div className="p-4 bg-amber-900/20 text-amber-300 border border-amber-500/20 rounded-xl text-sm">
            Saved offline — will sync when you're back online.
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-900/20 text-red-400 border border-red-500/20 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Plot details summary */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Plot Details</h3>
          <div className="bg-slate-900/60 border border-white/10 rounded-xl divide-y divide-white/5">
            {[
              ['Plot Name', formData.plot_name],
              ['Variety', formData.variety],
              ['Estimated Acres', acres],
              ['Total Trees', formData.total_trees || '—'],
              ['Productive Trees', formData.productive_trees || '—'],
              ['Established', formData.establishment_year],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-400">{label}</span>
                <span className="text-sm text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Boundary summary */}
        {boundary ? (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Mapped Boundary</h3>
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl divide-y divide-white/5">
              {[
                ['Area', `${boundary.areaHa.toFixed(3)} ha (${acres} acres)`],
                ['Perimeter', boundary.perimeterM >= 1000
                  ? `${(boundary.perimeterM / 1000).toFixed(2)} km`
                  : `${Math.round(boundary.perimeterM)} m`],
                ['GPS Points', `${boundary.pointCount} corners`],
                ['Centroid', `${boundary.centroid.lat.toFixed(5)}, ${boundary.centroid.lng.toFixed(5)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className="text-sm text-emerald-300 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-900/20 border border-amber-500/20 rounded-xl">
            <p className="text-sm text-amber-400">
               No boundary mapped. You can always add it later from the plot detail page.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep('map')}
            disabled={loading}
            className="flex-1 py-3 border border-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white font-bold rounded-lg transition-all shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Registering…
              </span>
            ) : '✓ Register Plot'}
          </button>
        </div>
      </div>
    )
  }

  // ── Progress indicator ─────────────────────────────────────────────────────

  const steps: { key: Step; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'map', label: 'Map Plot' },
    { key: 'review', label: 'Review' },
  ]
  const currentIndex = steps.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-obsidian p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/coffee/plots"
            className="w-10 h-10 glass-card rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Add Coffee <span className="text-emerald-400">Plot</span>
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Register and map your farm plot</p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className={`
                flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all
                ${i < currentIndex
                  ? 'bg-emerald-600 text-white'
                  : i === currentIndex
                  ? 'bg-emerald-500 text-white ring-2 border-[#4B5563]/30'
                  : 'bg-slate-800 text-slate-500'}
              `}>
                {i < currentIndex ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === currentIndex ? 'text-white' : 'text-slate-500'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${i < currentIndex ? 'bg-emerald-600' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="glass-card p-8 rounded-xl">
          {step === 'details' && renderDetails()}
          {step === 'map' && renderMap()}
          {step === 'review' && renderReview()}
        </div>

      </div>
    </div>
  )
}
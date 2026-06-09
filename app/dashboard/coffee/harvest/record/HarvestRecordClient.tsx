'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { recordHarvest } from '../actions'
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface HarvestRecord {
  id: string; harvest_date: string; plot_name: string; harvest_year: number | null;
  harvest_season: string | null; cherry_kg: number; total_value: number | null;
  quality_grade: string | null; amount_paid: number | null; payment_status: string | null;
}

interface Plot {
  id: string
  plot_name: string
}

const GRADES = ['AA', 'AB', 'C', 'PB', 'TT', 'T', 'MH/ML', 'UG'] as const
type Grade = typeof GRADES[number]

const SEASONS = ['Main Crop (Oct-Jan)', 'Fly Crop (Apr-Jun)', 'Other']

export default function HarvestRecordClient({ 
  initialRecords, 
  farmId,
  plots 
}: { 
  initialRecords: HarvestRecord[], 
  farmId: string,
  plots: Plot[]
}) {
  const router = useRouter()
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))

  const totals = {
    totalCherry: initialRecords.reduce((s, r) => s + Number(r.cherry_kg || 0), 0),
    totalValue: initialRecords.reduce((s, r) => s + Number(r.total_value || 0), 0),
    count: initialRecords.length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/coffee" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Harvest Tracker</h1>
              <p className="text-xs text-gray-500">Track your coffee cherry pickups</p>
            </div>
          </div>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
          >
            + Record Harvest
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
            <p className="text-2xl font-bold text-red-700">{totals.totalCherry.toLocaleString()} kg</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Cherry Picked</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
            <p className="text-2xl font-bold text-emerald-700">KES {(totals.totalValue/1000).toFixed(1)}K</p>
            <p className="text-xs text-gray-500 mt-0.5">Gross Value</p>
          </div>
        </div>

        {/* Harvest list */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Recent Harvests</p>
          </div>
          {initialRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No harvest records yet. Click "Record Harvest" to add your first pickup.
            </div>
          ) : (
            initialRecords.map(r => (
              <div key={r.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{r.plot_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(r.harvest_date).toLocaleDateString()} 
                    {r.quality_grade && <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{r.quality_grade}</span>}
                  </p>
                </div>
                <p className="text-red-600 font-bold">{r.cherry_kg} kg</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Harvest Modal */}
      {showAddModal && (
        <HarvestModal 
          plots={plots} 
          farmId={farmId} 
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            router.refresh()
          }} 
        />
      )}
    </div>
  )
}

function HarvestModal({ 
  plots, 
  farmId, 
  onClose, 
  onSuccess 
}: { 
  plots: Plot[], 
  farmId: string, 
  onClose: () => void,
  onSuccess: () => void 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [form, setForm] = useState({
    plot_name: plots[0]?.plot_name || '',
    harvest_date: new Date().toISOString().split('T')[0],
    cherry_kg: '',
    quality_grade: 'AB' as Grade,
    price_per_kg: '12',
    total_value: '',
    notes: '',
  })

  useEffect(() => {
    if (form.cherry_kg && form.price_per_kg) {
      const total = parseFloat(form.cherry_kg) * parseFloat(form.price_per_kg)
      setForm(f => ({ ...f, total_value: total.toFixed(2) }))
    }
  }, [form.cherry_kg, form.price_per_kg])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.plot_name) { setError('Select a plot'); return }
    if (!form.cherry_kg || parseFloat(form.cherry_kg) <= 0) { setError('Enter a valid weight'); return }
    
    setLoading(true)
    setError('')
    
    try {
      await recordHarvest({
        farm_id: farmId,
        plot_name: form.plot_name,
        harvest_date: form.harvest_date,
        cherry_kg: parseFloat(form.cherry_kg),
        produce_kg: parseFloat(form.cherry_kg),
        quality_grade: form.quality_grade,
        price_per_kg: parseFloat(form.price_per_kg),
        total_value: parseFloat(form.total_value || '0'),
        notes: form.notes || null,
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to record harvest')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Record Harvest</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg border border-red-200 bg-red-50">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Select Plot *</label>
            <select 
              value={form.plot_name} 
              onChange={e => setForm({ ...form, plot_name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Choose plot...</option>
              {plots.map(p => (
                <option key={p.id} value={p.plot_name}>{p.plot_name}</option>
              ))}
            </select>
            {plots.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No plots found. <Link href="/dashboard/coffee/plots/add" className="underline">Add a plot first</Link>.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Harvest Date *</label>
              <input 
                type="date" 
                value={form.harvest_date} 
                onChange={e => setForm({ ...form, harvest_date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Quality Grade</label>
              <select 
                value={form.quality_grade} 
                onChange={e => setForm({ ...form, quality_grade: e.target.value as Grade })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Cherry Weight (kg) *</label>
            <input 
              type="number" 
              step="0.1"
              min="0"
              value={form.cherry_kg} 
              onChange={e => setForm({ ...form, cherry_kg: e.target.value })}
              placeholder="e.g. 50.5"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Weight of fresh coffee cherries picked</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Price per kg (KES)</label>
              <input 
                type="number" 
                step="0.5"
                min="0"
                value={form.price_per_kg} 
                onChange={e => setForm({ ...form, price_per_kg: e.target.value })}
                placeholder="e.g. 12"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Total Value (KES)</label>
              <input 
                type="text" 
                value={form.total_value} 
                readOnly
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 font-semibold text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
            <textarea 
              value={form.notes} 
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Weather conditions, picker name, etc."
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold text-sm transition-colors"
            >
              {loading ? 'Saving...' : 'Record Harvest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

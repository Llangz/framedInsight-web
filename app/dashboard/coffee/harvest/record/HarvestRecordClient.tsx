// 📁 FILE PATH: app/dashboard/coffee/harvest/record/HarvestRecordClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { recordHarvest } from '../actions'
import { queueCoffeeEvent } from '@/lib/offline-db'
import { CheckCircle2, AlertCircle, Plus, X } from 'lucide-react'
import Link from 'next/link'

interface HarvestRecord {
  id: string; harvest_date: string; plot_name: string; harvest_year: number | null
  harvest_season: string | null; cherry_kg: number; total_value: number | null
  quality_grade: string | null; amount_paid: number | null; payment_status: string | null
}
interface Plot { id: string; plot_name: string }

const GRADES = ['AA', 'AB', 'C', 'PB', 'TT', 'T', 'MH/ML', 'UG'] as const
type Grade = typeof GRADES[number]

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#D1D5DB] mb-1'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const GRADE_COLORS: Record<string, string> = {
  AA: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/40',
  AB: 'text-sky-400 bg-sky-950/40 border-sky-900/40',
  PB: 'text-purple-400 bg-purple-950/40 border-purple-900/40',
  C:  'text-amber-400 bg-amber-950/40 border-amber-900/40',
}

export default function HarvestRecordClient({
  initialRecords, farmId, plots,
}: {
  initialRecords: HarvestRecord[]; farmId: string; plots: Plot[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  const totals = {
    cherry:  initialRecords.reduce((s, r) => s + Number(r.cherry_kg || 0), 0),
    value:   initialRecords.reduce((s, r) => s + Number(r.total_value || 0), 0),
    count:   initialRecords.length,
  }

  return (
    <div className="min-h-screen bg-obsidian">

      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Harvest records</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Track cherry pickups and cooperative deliveries</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors flex-shrink-0"
          >
            <Plus size={12} /> Record harvest
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total cherry', value: `${totals.cherry.toLocaleString()} kg` },
            { label: 'Gross value',  value: `KES ${(totals.value / 1000).toFixed(1)}K` },
            { label: 'Pickups',      value: totals.count },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4">
              <p className="text-xl font-semibold text-white">{value}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Records list */}
        <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2A2D35]">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Recent pickups</h2>
          </div>
          {initialRecords.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#6B7280] mb-3">No harvest records yet</p>
              <button onClick={() => setShowModal(true)} className="text-sm text-emerald-500 hover:text-emerald-400">
                Record first pickup →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#1F2128]">
              {initialRecords.map(r => {
                const gradeClass = GRADE_COLORS[r.quality_grade ?? ''] ?? 'text-[#6B7280] bg-[#1F2128] border-[#2A2D35]'
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{r.plot_name}</p>
                      <p className="text-xs text-[#6B7280]">{fmt(r.harvest_date)}</p>
                    </div>
                    {r.quality_grade && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${gradeClass}`}>
                        {r.quality_grade}
                      </span>
                    )}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-white">{Number(r.cherry_kg).toLocaleString()} kg</p>
                      {r.total_value ? (
                        <p className="text-xs text-[#6B7280]">KES {Number(r.total_value).toLocaleString()}</p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <HarvestModal
          plots={plots}
          farmId={farmId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function HarvestModal({ plots, farmId, onClose, onSuccess }: {
  plots: Plot[]; farmId: string; onClose: () => void; onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedOffline, setSavedOffline] = useState(false)
  const [form, setForm] = useState({
    plot_id: plots[0]?.id || '',
    harvest_date: new Date().toISOString().split('T')[0],
    cherry_kg: '',
    quality_grade: 'AB' as Grade,
    price_per_kg: '12',
    total_value: '',
    notes: '',
  })

  useEffect(() => {
    if (form.cherry_kg && form.price_per_kg) {
      setForm(f => ({ ...f, total_value: (parseFloat(f.cherry_kg) * parseFloat(f.price_per_kg)).toFixed(2) }))
    }
  }, [form.cherry_kg, form.price_per_kg])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const FIELD_M = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#4B5563] transition-colors'
  const LABEL_M = 'block text-xs font-medium text-[#D1D5DB] mb-1'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.plot_id) { setError('Select a plot'); return }
    if (!form.cherry_kg || parseFloat(form.cherry_kg) <= 0) { setError('Enter a valid weight'); return }
    setLoading(true); setError('')

    const payload = {
      farm_id: farmId, plot_id: form.plot_id, harvest_date: form.harvest_date,
      cherry_kg: parseFloat(form.cherry_kg), produce_kg: parseFloat(form.cherry_kg),
      quality_grade: form.quality_grade, price_per_kg: parseFloat(form.price_per_kg),
      total_value: parseFloat(form.total_value || '0'), notes: form.notes || null,
    }

    if (!navigator.onLine) {
      try {
        // plot_id also becomes referenceId — the sync function needs it to
        // resolve plot_name server-side, the same lookup recordHarvest does
        // online (coffee_harvests.plot_name is NOT NULL and isn't in this payload).
        await queueCoffeeEvent({
          eventId: crypto.randomUUID(),
          entityType: 'coffee_harvest',
          farmId,
          referenceId: form.plot_id,
          payload,
        })
        setSavedOffline(true)
        setTimeout(onSuccess, 1200)
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const result = await recordHarvest(payload)
      if (!result.success) {
        setError(result.error || 'Failed to record harvest')
        return
      }
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to record harvest')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-xl sm:rounded-xl border border-[#2A2D35] bg-[#0D0F14] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D35]">
          <h2 className="text-sm font-semibold text-white">Record harvest</h2>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {savedOffline && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-900/40 bg-amber-950/30">
              <CheckCircle2 size={13} className="text-amber-400 flex-shrink-0" />
              <span className="text-sm text-amber-300">Saved offline — will sync when you're back online.</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-900/40 bg-red-950/30">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label className={LABEL_M}>Plot *</label>
            <select className={FIELD_M} value={form.plot_id} onChange={e => set('plot_id', e.target.value)} required>
              <option value="">Select plot…</option>
              {plots.map(p => <option key={p.id} value={p.id}>{p.plot_name}</option>)}
            </select>
            {plots.length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1">
                No plots found. <Link href="/dashboard/coffee/plots/add" className="underline">Add a plot first →</Link>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_M}>Harvest date *</label>
              <input type="date" className={FIELD_M} value={form.harvest_date} max={new Date().toISOString().split('T')[0]}
                onChange={e => set('harvest_date', e.target.value)} required />
            </div>
            <div>
              <label className={LABEL_M}>Quality grade</label>
              <select className={FIELD_M} value={form.quality_grade} onChange={e => set('quality_grade', e.target.value)}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL_M}>Cherry weight (kg) *</label>
            <input type="number" step="0.1" min="0" className={FIELD_M} placeholder="e.g. 50.5"
              value={form.cherry_kg} onChange={e => set('cherry_kg', e.target.value)} required />
            <p className="text-[11px] text-[#4B5563] mt-1">Weight of fresh cherry delivered to factory</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_M}>Price / kg (KES)</label>
              <input type="number" step="0.5" min="0" className={FIELD_M} placeholder="e.g. 12"
                value={form.price_per_kg} onChange={e => set('price_per_kg', e.target.value)} />
            </div>
            <div>
              <label className={LABEL_M}>Total value (KES)</label>
              <input type="text" className={`${FIELD_M} text-emerald-400 font-semibold`} value={form.total_value} readOnly />
            </div>
          </div>

          <div>
            <label className={LABEL_M}>Notes (optional)</label>
            <textarea className={`${FIELD_M} resize-none`} rows={2}
              placeholder="Weather, picker details, remarks…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-md border border-[#2A2D35] text-sm text-[#9CA3AF] hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
              {loading ? 'Saving…' : 'Save harvest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
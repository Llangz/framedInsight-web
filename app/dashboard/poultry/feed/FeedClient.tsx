// 📁 FILE PATH: app/dashboard/poultry/feed/FeedClient.tsx
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Wheat, ArrowLeft, AlertCircle, CheckCircle2, Info } from 'lucide-react'

interface Batch { id: string; batch_name: string; bird_type: string; current_count: number }
interface FeedRecord {
  id: string; batch_id: string; record_date: string; feed_type: string
  quantity_kg: number; cost_per_kg: number; total_cost: number
  days_remaining?: number; notes?: string
  poultry_batches?: { batch_name: string }
}
interface Props { farmId: string; initialBatches: Batch[]; initialRecords: FeedRecord[] }

// Feed types with Kenyan market context
const FEED_TYPES = [
  { value: 'chick_mash',       label: 'Chick Mash (0–8 wks)',      rate: '0.015',  desc: '~15g/bird/day for chicks'   },
  { value: 'growers_mash',     label: 'Growers Mash (8–18 wks)',   rate: '0.08',   desc: '~80g/bird/day'              },
  { value: 'layers_mash',      label: 'Layers Mash (18+ wks)',     rate: '0.12',   desc: '~120g/bird/day (standard)'  },
  { value: 'layers_pellet',    label: 'Layers Pellet',             rate: '0.12',   desc: '120g/bird/day – less waste'  },
  { value: 'broiler_starter',  label: 'Broiler Starter (0–3 wks)', rate: '0.04',   desc: '~40g/bird/day'              },
  { value: 'broiler_finisher', label: 'Broiler Finisher (3–8 wks)','rate': '0.10', desc: '~100–150g/bird/day'         },
  { value: 'kienyeji_mash',    label: 'Kienyeji Mash',             rate: '0.08',   desc: '~80g/day + free range foraging'},
  { value: 'omena_supplement', label: 'Omena (Fish meal)',         rate: '0.01',   desc: 'Protein supplement – ~10g/bird'},
  { value: 'maize_bran',       label: 'Maize Bran',               rate: '0.05',   desc: 'Filler supplement'          },
  { value: 'custom',           label: 'Custom / Home mix',        rate: '0.1',    desc: 'User-defined feed'          },
]

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#9CA3AF] mb-1'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

export default function FeedClient({ farmId, initialBatches, initialRecords }: Props) {
  const supabase = createClient()
  const [records, setRecords] = useState(initialRecords)
  const [tab, setTab]         = useState<'record' | 'history' | 'guide'>('record')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    batch_id:      initialBatches[0]?.id || '',
    record_date:   new Date().toISOString().split('T')[0],
    feed_type:     'layers_mash',
    quantity_kg:   '',
    cost_per_kg:   '',
    days_remaining:'',
    notes:         '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const selectedBatch   = initialBatches.find(b => b.id === form.batch_id)
  const selectedFeedMeta = FEED_TYPES.find(f => f.value === form.feed_type)
  const totalCost = form.quantity_kg && form.cost_per_kg
    ? (parseFloat(form.quantity_kg) * parseFloat(form.cost_per_kg)).toFixed(0)
    : ''

  // Suggested qty based on flock size
  const suggestedKg = selectedBatch && selectedFeedMeta
    ? (selectedBatch.current_count * parseFloat(selectedFeedMeta.rate) * 7).toFixed(1) // 7-day supply
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.batch_id || !form.quantity_kg) { setError('Select batch and enter quantity'); return }
    setLoading(true)

    const qty  = parseFloat(form.quantity_kg)
    const cpu  = form.cost_per_kg ? parseFloat(form.cost_per_kg) : 0
    const { data, error: err } = await supabase
      .from('poultry_feed_records' as any)
      .insert({
        farm_id:       farmId,
        batch_id:      form.batch_id,
        record_date:   form.record_date,
        feed_type:     form.feed_type,
        quantity_kg:   qty,
        days_remaining: form.days_remaining ? parseInt(form.days_remaining) : null,
        notes:         form.notes || null,
      } as any)
      .select('*, poultry_batches(batch_name)')

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess('Feed record saved!')
    if (data) setRecords(prev => [...(data as any[]), ...prev].sort((a: any, b: any) => b.record_date.localeCompare(a.record_date)))
    setForm(f => ({ ...f, quantity_kg: '', cost_per_kg: '', days_remaining: '', notes: '' }))
    setTimeout(() => setSuccess(''), 3000)
  }

  // 30-day totals
  const totalFeedKg    = useMemo(() => records.reduce((s, r) => s + r.quantity_kg, 0).toFixed(0), [records])
  const totalFeedCost  = useMemo(() => records.reduce((s, r) => s + (r.total_cost || 0), 0).toLocaleString(), [records])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Feed Management</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Track intake, stock and feed costs</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Feed (30d)',  value: `${totalFeedKg} kg`,         sub: 'total consumed' },
          { label: 'Cost (30d)', value: `KES ${totalFeedCost}`,        sub: 'total feed cost' },
          { label: 'Active flocks', value: initialBatches.length,     sub: 'needing feed' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-3">
            <p className="text-lg font-semibold text-white">{value}</p>
            <p className="text-[11px] text-[#6B7280]">{label}</p>
            <p className="text-[10px] text-[#4B5563]">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2A2D35] mb-6">
        {([['record', 'Record Feed'], ['history', 'History'], ['guide', 'Feed Guide']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === k ? 'border-emerald-500 text-white' : 'border-transparent text-[#6B7280] hover:text-white'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'record' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error   && <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30"><AlertCircle size={14} className="text-red-400" /><p className="text-sm text-red-300">{error}</p></div>}
          {success && <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30"><CheckCircle2 size={14} className="text-emerald-400" /><p className="text-sm text-emerald-300">{success}</p></div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Batch *</label>
              <select className={FIELD} value={form.batch_id} onChange={e => set('batch_id', e.target.value)}>
                {initialBatches.map(b => <option key={b.id} value={b.id}>{b.batch_name} ({b.current_count} birds)</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <input type="date" className={FIELD} value={form.record_date} onChange={e => set('record_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Feed type *</label>
            <select className={FIELD} value={form.feed_type} onChange={e => set('feed_type', e.target.value)}>
              {FEED_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            {selectedFeedMeta && (
              <p className="text-[11px] text-[#4B5563] mt-1">{selectedFeedMeta.desc}</p>
            )}
          </div>

          {suggestedKg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#2A2D35] bg-[#0A0C10]">
              <Info size={12} className="text-[#6B7280]" />
              <p className="text-xs text-[#9CA3AF]">
                Suggested 7-day supply for {selectedBatch?.current_count} birds: <span className="text-white font-medium">{suggestedKg} kg</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className={LABEL}>Quantity (kg) *</label>
              <input type="number" className={FIELD} placeholder="e.g. 100"
                value={form.quantity_kg} onChange={e => set('quantity_kg', e.target.value)} min="0" step="0.5" />
            </div>
            <div className="col-span-1">
              <label className={LABEL}>Cost per kg (KES)</label>
              <input type="number" className={FIELD} placeholder="e.g. 75"
                value={form.cost_per_kg} onChange={e => set('cost_per_kg', e.target.value)} min="0" step="0.5" />
            </div>
            <div className="col-span-1">
              <label className={LABEL}>Total cost (KES)</label>
              <div className="px-3 py-2 rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white">
                {totalCost ? `KES ${parseInt(totalCost).toLocaleString()}` : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Days of stock remaining</label>
              <input type="number" className={FIELD} placeholder="e.g. 14"
                value={form.days_remaining} onChange={e => set('days_remaining', e.target.value)} min="0" />
            </div>
            <div>
              <label className={LABEL}>Notes</label>
              <input className={FIELD} placeholder="Supplier, brand, quality notes…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
            {loading ? 'Saving…' : 'Save feed record'}
          </button>
        </form>
      )}

      {tab === 'history' && (
        <div className="space-y-1">
          {records.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-8">No feed records in the last 30 days</p>
          ) : records.map(r => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
              <Wheat size={14} className="text-[#4B5563] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{r.poultry_batches?.batch_name || '—'}</p>
                <p className="text-xs text-[#6B7280]">
                  {FEED_TYPES.find(f => f.value === r.feed_type)?.label || r.feed_type} · {fmt(r.record_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{r.quantity_kg} kg</p>
                {r.total_cost > 0 && <p className="text-[11px] text-[#6B7280]">KES {r.total_cost.toLocaleString()}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'guide' && (
        <div className="space-y-3">
          <p className="text-xs text-[#6B7280] mb-4">
            Kenya standard feed rates. Actual consumption varies with climate, health and breed.
            Kienyeji on free range may consume 30–40% less mash.
          </p>
          {FEED_TYPES.map(f => (
            <div key={f.value} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-white">{f.label}</p>
                <span className="text-xs px-2 py-0.5 rounded border border-[#2A2D35] text-[#6B7280]">
                  ~{(parseFloat(f.rate) * 1000).toFixed(0)}g/bird/day
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">{f.desc}</p>
            </div>
          ))}
          <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4 mt-4">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Cost Reference (2025 Kenya)</p>
            <div className="space-y-1 text-xs text-[#6B7280]">
              <p>Layers mash (50kg): KES 3,200–3,800 (Pembe, Unga, Sigma)</p>
              <p>Broiler starter (50kg): KES 3,500–4,200</p>
              <p>Kienyeji mash (50kg): KES 2,800–3,200</p>
              <p>Omena (per kg): KES 120–180</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
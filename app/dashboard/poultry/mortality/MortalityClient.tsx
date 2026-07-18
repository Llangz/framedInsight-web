'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { queuePoultryEvent } from '@/lib/offline-db'
import { Skull, ArrowLeft, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Batch { id: string; batch_name: string; bird_type: string; current_count: number }
interface MortalityRecord {
  id: string; batch_id: string; record_date: string; count_dead: number
  cause?: string; symptoms?: string; culling_reason?: string; notes?: string
  poultry_batches?: { batch_name: string }
}
interface Props { farmId: string; initialBatches: Batch[]; initialRecords: MortalityRecord[] }

const CAUSES = [
  'Newcastle Disease',
  'Gumboro (IBD)',
  'Coccidiosis',
  'Marek\'s Disease',
  'Fowl Pox',
  'Respiratory disease (CRD/IB)',
  'Salmonellosis / Fowl Typhoid',
  'Heat stress',
  'Cold stress',
  'Sudden death syndrome (broilers)',
  'Water deprivation',
  'Trampling / piling',
  'Predator attack',
  'Unknown – autopsy needed',
  'Old age',
  'Other',
]

const CULLING_REASONS = [
  'Poor performance / low production',
  'Chronic disease – not responding to treatment',
  'Injury',
  'Aggressive behavior',
  'End of production cycle',
  'Market sale / slaughter',
]

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-bold text-[#D1D5DB] mb-1'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

export default function MortalityClient({ farmId, initialBatches, initialRecords }: Props) {
  const supabase = createClient()
  const [records, setRecords] = useState(initialRecords)
  const [tab, setTab]         = useState<'record' | 'history'>('record')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [type, setType]       = useState<'mortality' | 'culling'>('mortality')

  const [form, setForm] = useState({
    batch_id:       initialBatches[0]?.id || '',
    record_date:    new Date().toISOString().split('T')[0],
    count_dead:     '1',
    cause:          '',
    symptoms:       '',
    culling_reason: '',
    notes:          '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const totalDeaths30d = useMemo(() => records.reduce((s, r) => s + r.count_dead, 0), [records])

  // Mortality rate calculation
  const mortalityRate = useMemo(() => {
    const totalBirds = initialBatches.reduce((s, b) => s + b.current_count, 0)
    return totalBirds > 0 ? ((totalDeaths30d / (totalBirds + totalDeaths30d)) * 100).toFixed(1) : '0'
  }, [totalDeaths30d, initialBatches])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.batch_id || !form.count_dead) { setError('Select batch and enter count'); return }
    const count = parseInt(form.count_dead)
    // count_dead_check requires > 0 — '!form.count_dead' above lets a
    // literal "0" string through since it's non-empty/truthy.
    if (!count || count <= 0) { setError('Count must be at least 1'); return }
    setLoading(true)

    const batch = initialBatches.find(b => b.id === form.batch_id)

    // Insert mortality record
    const mortalityPayload = {
  id: crypto.randomUUID(),
  farm_id: farmId,
  batch_id: form.batch_id,
  record_date: form.record_date,
  // BUG FIX: poultry_mortality_record_type_check requires record_type to be
  // 'mortality' or 'culling'. This column has a DB default of 'mortality'
  // (confirmed), so omitting it didn't block saves — but it meant every
  // "Culled birds" entry was silently being recorded as a mortality/death
  // instead, corrupting mortality-rate stats. It's also missing from
  // lib/database.types.ts (stale for this table, same dashboard-schema-
  // drift as coffee_activities). `type` already tracks exactly this
  // distinction in the UI.
  record_type: type,
  count_dead: count,
  cause: type === 'mortality' ? (form.cause || null) : null,
  symptoms: type === 'mortality' ? (form.symptoms || null) : null,
  culling_reason: type === 'culling' ? (form.culling_reason || null) : null,
  notes: form.notes || null,
}

// Offline path
if (!navigator.onLine) {
  await queuePoultryEvent({
    eventId: crypto.randomUUID(),
    entityType: 'poultry_mortality',
    farmId,
    batchId: form.batch_id,
    payload: mortalityPayload,
  })

  setSuccess('Saved offline — will sync when connected.')
  setForm(f => ({
    ...f,
    count_dead: '1',
    cause: '',
    symptoms: '',
    culling_reason: '',
    notes: '',
  }))
  setLoading(false)
  setTimeout(() => setSuccess(''), 4000)
  return
}

// Insert mortality record
const { data, error: err } = await (supabase as any)
  .from('poultry_mortality')
  .insert(mortalityPayload)
  .select('*, poultry_batches(batch_name)')

if (!err && batch) {
  await (supabase as any)
    .from('poultry_batches')
    .update({
      current_count: Math.max(0, batch.current_count - count),
    })
    .eq('id', form.batch_id)
}

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess('Record saved and bird count updated.')
    if (data) setRecords(prev => [...(data as any[] || []).map((d: any) => ({ ...d, notes: d.notes ?? undefined })), ...prev])
    setForm(f => ({ ...f, count_dead: '1', cause: '', symptoms: '', culling_reason: '', notes: '' }))
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Mortality & Culling</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Track losses to manage biosecurity</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Deaths (30d)',    value: totalDeaths30d, sub: 'total birds lost'  },
          { label: 'Mortality rate',  value: `${mortalityRate}%`, sub: '30-day average'  },
          { label: 'Target',         value: '< 2%',         sub: 'acceptable rate'   },
        ].map(({ label, value, sub }) => (
          <div key={label} className={`rounded-lg border p-3 ${
            label === 'Mortality rate' && parseFloat(mortalityRate) > 5
              ? 'border-red-900/40 bg-red-950/20'
              : 'border-[#2A2D35] bg-[#0D0F14]'
          }`}>
            <p className={`text-lg font-semibold ${
              label === 'Mortality rate' && parseFloat(mortalityRate) > 5 ? 'text-red-400' : 'text-white'
            }`}>{value}</p>
            <p className="text-[11px] text-[#6B7280]">{label}</p>
            <p className="text-[10px] text-[#4B5563]">{sub}</p>
          </div>
        ))}
      </div>

      {parseFloat(mortalityRate) > 5 && (
        <div className="flex items-start gap-3 px-4 py-3 mb-6 rounded-lg border border-red-900/40 bg-red-950/20">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">High mortality rate detected</p>
            <p className="text-xs text-red-400/80 mt-0.5">
              {mortalityRate}% exceeds the acceptable 2–5% threshold. Conduct a post-mortem, check biosecurity,
              review vaccination records and consult a vet immediately.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#2A2D35] mb-6">
        {(['record', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-emerald-500 text-white' : 'border-transparent text-[#6B7280] hover:text-white'
            }`}>
            {t === 'record' ? 'Record loss' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'record' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error   && <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30"><AlertCircle size={14} className="text-red-400" /><p className="text-sm text-red-300">{error}</p></div>}
          {success && <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30"><CheckCircle2 size={14} className="text-emerald-400" /><p className="text-sm text-emerald-300">{success}</p></div>}

          {/* Type toggle */}
          <div className="flex gap-2">
            {([['mortality', 'Deaths'], ['culling', 'Culled birds']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setType(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  type === k
                    ? k === 'mortality' ? 'bg-red-900/40 border border-red-900/60 text-red-300' : 'bg-amber-900/40 border border-amber-900/60 text-amber-300'
                    : 'bg-[#0A0C10] border border-[#2A2D35] text-[#9CA3AF] hover:text-white'
                }`}>
                {l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Batch *</label>
              <select className={FIELD} value={form.batch_id} onChange={e => set('batch_id', e.target.value)}>
                {initialBatches.map(b => <option key={b.id} value={b.id}>{b.batch_name} ({b.current_count})</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <input type="date" className={FIELD} value={form.record_date} onChange={e => set('record_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Number of birds *</label>
            <input type="number" className={FIELD} min="1"
              value={form.count_dead} onChange={e => set('count_dead', e.target.value)} />
            <p className="text-[11px] text-[#4B5563] mt-1">
              This will automatically deduct from the batch count.
            </p>
          </div>

          {type === 'mortality' ? (
            <>
              <div>
                <label className={LABEL}>Likely cause</label>
                <select className={FIELD} value={form.cause} onChange={e => set('cause', e.target.value)}>
                  <option value="">Select cause…</option>
                  {CAUSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Symptoms observed</label>
                <textarea className={`${FIELD} resize-none`} rows={2}
                  placeholder="e.g. twisted neck, laboured breathing, green diarrhoea, blood in droppings…"
                  value={form.symptoms} onChange={e => set('symptoms', e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <label className={LABEL}>Reason for culling</label>
              <select className={FIELD} value={form.culling_reason} onChange={e => set('culling_reason', e.target.value)}>
                <option value="">Select reason…</option>
                {CULLING_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={LABEL}>Notes</label>
            <textarea className={`${FIELD} resize-none`} rows={2}
              placeholder="Post-mortem findings, vet contacted, action taken…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
            {loading ? 'Saving…' : 'Save record'}
          </button>
        </form>
      )}

      {tab === 'history' && (
        <div className="space-y-1">
          {records.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-8">No mortality records in the last 30 days</p>
          ) : records.map(r => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
              <Skull size={14} className="text-red-500/60 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{r.poultry_batches?.batch_name || '—'}</p>
                <p className="text-xs text-[#6B7280]">{r.cause || 'Unknown cause'} · {fmt(r.record_date)}</p>
              </div>
              <p className="text-sm font-semibold text-red-400 flex-shrink-0">-{r.count_dead}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
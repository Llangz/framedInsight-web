'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { queuePoultryEvent } from '@/lib/offline-db'
import { Egg, ArrowLeft, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Batch { id: string; batch_name: string; bird_type: string; current_count: number }
interface EggRecord {
  id: string; batch_id: string; record_date: string
  total_eggs: number; broken_eggs: number; collected_eggs: number
  poultry_batches?: { batch_name: string; bird_type: string }
}
interface Props { farmId: string; initialBatches: Batch[]; initialRecords: EggRecord[] }

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#9CA3AF] mb-1'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EggsClient({ farmId, initialBatches, initialRecords }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [records, setRecords] = useState(initialRecords)
  const [tab, setTab]         = useState<'record' | 'history'>('record')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    batch_id:       initialBatches[0]?.id || '',
    record_date:    new Date().toISOString().split('T')[0],
    total_eggs:     '',
    broken_eggs:    '0',
    notes:          '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const selectedBatch = initialBatches.find(b => b.id === form.batch_id)
  const collectedEggs = Math.max(0, parseInt(form.total_eggs || '0') - parseInt(form.broken_eggs || '0'))
  const henDay = selectedBatch && parseInt(form.total_eggs)
    ? Math.round((parseInt(form.total_eggs) / selectedBatch.current_count) * 100)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.batch_id || !form.total_eggs) { setError('Select batch and enter egg count'); return }
    setLoading(true)

    const payload = {
  farm_id: farmId,
  batch_id: form.batch_id,
  record_date: form.record_date,
  eggs_collected: parseInt(form.total_eggs),
  total_eggs: parseInt(form.total_eggs),
  notes: form.notes || null,
}

// Offline-first support
if (!navigator.onLine) {
  await queuePoultryEvent({
    eventId: crypto.randomUUID(),
    entityType: 'poultry_egg_record',
    farmId,
    batchId: form.batch_id,
    payload,
  })

  setSuccess('Saved offline — will sync when connected.')
  setForm(f => ({
    ...f,
    total_eggs: '',
    broken_eggs: '0',
    notes: '',
  }))
  setLoading(false)
  setTimeout(() => setSuccess(''), 4000)
  return
}

const { data, error: err } = await supabase
  .from('poultry_egg_records' as any)
  .upsert(payload as any, {
    onConflict: 'batch_id,record_date',
  })
  .select('*, poultry_batches(batch_name, bird_type)')

    setLoading(false)
    if (err) { setError(err.message); return }

    setSuccess('Egg record saved!')
    if (data) setRecords(prev => {
      const without = prev.filter(r => !(r.batch_id === form.batch_id && r.record_date === form.record_date))
      return [...(data as any[]), ...without].sort((a: any, b: any) => b.record_date.localeCompare(a.record_date))
    })
    setForm(f => ({ ...f, total_eggs: '', broken_eggs: '0', notes: '' }))
    setTimeout(() => setSuccess(''), 3000)
  }

  // 7-day summary
  const last7 = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6)
    return records
      .filter(r => new Date(r.record_date) >= cutoff)
      .reduce((s, r) => s + r.total_eggs, 0)
  }, [records])

  const avgLast7 = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6)
    const days = records.filter(r => new Date(r.record_date) >= cutoff)
    const total = days.reduce((s, r) => s + r.total_eggs, 0)
    const uniqueDays = new Set(days.map(r => r.record_date)).size || 1
    return Math.round(total / uniqueDays)
  }, [records])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">Egg Production</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Daily collection records</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Last 7 days', value: last7.toLocaleString(), sub: 'total eggs' },
          { label: 'Daily average', value: avgLast7.toLocaleString(), sub: 'eggs / day' },
          { label: 'Laying batches', value: initialBatches.length, sub: 'active flocks' },
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
        {(['record', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-emerald-500 text-white' : 'border-transparent text-[#6B7280] hover:text-white'
            }`}>
            {t === 'record' ? 'Record eggs' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'record' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <p className="text-sm text-emerald-300">{success}</p>
            </div>
          )}

          {initialBatches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#2A2D35] p-8 text-center">
              <p className="text-sm text-[#6B7280] mb-2">No laying batches registered</p>
              <Link href="/dashboard/poultry/add-batch" className="text-sm text-emerald-500">Add a layer batch →</Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Batch *</label>
                  <select className={FIELD} value={form.batch_id} onChange={e => set('batch_id', e.target.value)}>
                    {initialBatches.map(b => (
                      <option key={b.id} value={b.id}>{b.batch_name} ({b.current_count} birds)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Date *</label>
                  <input type="date" className={FIELD} value={form.record_date} onChange={e => set('record_date', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Total eggs collected *</label>
                  <input type="number" className={FIELD} placeholder="e.g. 420"
                    value={form.total_eggs} onChange={e => set('total_eggs', e.target.value)} min="0" />
                </div>
                <div>
                  <label className={LABEL}>Broken / cracked eggs</label>
                  <input type="number" className={FIELD} placeholder="0"
                    value={form.broken_eggs} onChange={e => set('broken_eggs', e.target.value)} min="0" />
                </div>
              </div>

              {/* Live hen-day calculation */}
              {henDay !== null && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                  henDay >= 75 ? 'border-emerald-900/40 bg-emerald-950/20' :
                  henDay >= 60 ? 'border-amber-900/40 bg-amber-950/20' :
                  'border-red-900/40 bg-red-950/20'
                }`}>
                  <TrendingUp size={14} className={henDay >= 75 ? 'text-emerald-400' : henDay >= 60 ? 'text-amber-400' : 'text-red-400'} />
                  <div>
                    <p className="text-sm font-medium text-white">Hen-Day Production: {henDay}%</p>
                    <p className="text-xs text-[#6B7280]">
                      {henDay >= 80 ? 'Excellent – keep it up!' :
                       henDay >= 70 ? 'Good – above industry average' :
                       henDay >= 60 ? 'Average – check feed & lighting' :
                       'Below target – investigate health or nutrition'}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className={LABEL}>Notes (optional)</label>
                <input className={FIELD} placeholder="e.g. Power outage, stress, new feeders…"
                  value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
                {loading ? 'Saving…' : 'Save egg record'}
              </button>
            </>
          )}
        </form>
      ) : (
        /* History */
        <div className="space-y-1">
          {records.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-8">No egg records in the last 30 days</p>
          ) : records.map(r => {
            const batch = initialBatches.find(b => b.id === r.batch_id)
            const batchCount = batch?.current_count || 0
            const hdp = batchCount > 0 ? Math.round((r.total_eggs / batchCount) * 100) : 0
            return (
              <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{r.poultry_batches?.batch_name || '—'}</p>
                  <p className="text-xs text-[#6B7280]">{fmt(r.record_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{r.total_eggs} eggs</p>
                  <p className="text-[11px] text-[#6B7280]">
                    {r.broken_eggs > 0 ? `${r.broken_eggs} broken · ` : ''}{hdp}% HDP
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
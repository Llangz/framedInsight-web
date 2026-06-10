'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { queuePoultryEvent } from '@/lib/offline-db'
import { Syringe, ArrowLeft, AlertCircle, CheckCircle2, Shield } from 'lucide-react'

interface Batch { id: string; batch_name: string; bird_type: string; current_count: number }
interface HealthEvent {
  id: string; batch_id: string; event_date: string; event_type: string
  vaccine_name?: string; disease?: string; drug_name?: string; dosage?: string
  vet_name?: string; cost?: number; next_due_date?: string; notes?: string
  poultry_batches?: { batch_name: string }
}
interface Props { farmId: string; initialBatches: Batch[]; initialEvents: HealthEvent[] }

// Kenya-specific poultry vaccination schedule
const VAX_SCHEDULE = [
  { name: 'Newcastle Disease (NDV)',       alias: 'ND',       route: 'Eye drop / Water',     days: [7, 21, 35, 90] },
  { name: 'Infectious Bursal Disease (Gumboro)', alias: 'IBD', route: 'Water / Eye drop',   days: [14, 28] },
  { name: 'Marek\'s Disease',             alias: "Marek's",  route: 'Injection (Day 1)',     days: [1] },
  { name: 'Infectious Bronchitis (IB)',   alias: 'IB',        route: 'Eye drop / Spray',     days: [7, 21] },
  { name: 'Fowl Pox',                     alias: 'FP',        route: 'Wing web stab',         days: [70, 120] },
  { name: 'Fowl Typhoid',                 alias: 'FT',        route: 'Injection',             days: [56, 112] },
  { name: 'Avian Influenza (H5N1)',       alias: 'AI',        route: 'Injection',             days: [28, 60, 120] },
]

const COMMON_DISEASES = [
  'Newcastle Disease', 'Gumboro (IBD)', 'Coccidiosis', 'Marek\'s Disease',
  'Fowl Pox', 'Fowl Typhoid', 'Salmonellosis', 'Aspergillosis',
  'Infectious Bronchitis', 'CRD (Mycoplasma)', 'Egg Drop Syndrome', 'Other',
]

const COMMON_DRUGS = [
  'Amprolium (coccidiostat)', 'Sulphonamides', 'Tetracycline', 'Tylosin',
  'Enrofloxacin', 'Amoxicillin', 'Multivitamins', 'Electrolytes', 'Other',
]

const EVENT_TYPES = ['vaccination', 'treatment', 'deworming', 'vitamin_supplement', 'biosecurity_check', 'other']

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-bold text-[#D1D5DB] mb-1'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const URGENCY = (d: string) => {
  const days = Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
  return days <= 0   ? 'text-red-400 border-red-900/40 bg-red-950/30' :
         days <= 7   ? 'text-amber-400 border-amber-900/40 bg-amber-950/30' :
                       'text-[#9CA3AF] border-[#2A2D35] bg-[#0D0F14]'
}

export default function HealthClient({ farmId, initialBatches, initialEvents }: Props) {
  const supabase = createClient()
  const [events, setEvents] = useState(initialEvents)
  const [tab, setTab]       = useState<'record' | 'schedule' | 'history'>('record')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    batch_id:       initialBatches[0]?.id || '',
    event_date:     new Date().toISOString().split('T')[0],
    event_type:     'vaccination',
    vaccine_name:   '',
    disease:        '',
    drug_name:      '',
    dosage:         '',
    vet_name:       '',
    cost:           '',
    next_due_date:  '',
    notes:          '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Upcoming vaccinations
  const upcoming = events
    .filter(e => e.next_due_date && new Date(e.next_due_date) >= new Date())
    .sort((a, b) => a.next_due_date!.localeCompare(b.next_due_date!))
    .slice(0, 10)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.batch_id) { setError('Select a batch'); return }
    setLoading(true)

    const healthPayload = {
  id:            crypto.randomUUID(),
  farm_id:       farmId,
  batch_id:      form.batch_id,
  record_date:   form.event_date,
  event_type:    form.event_type,
  notes:         form.notes || null,
  next_due_date: form.next_due_date || null,
}

if (!navigator.onLine) {
  await queuePoultryEvent({
    eventId:    crypto.randomUUID(),
    entityType: 'poultry_health_record',
    farmId,
    batchId:    form.batch_id,
    payload:    healthPayload,
  })

  setSuccess('Saved offline — will sync when connected.')

  setForm(f => ({
    ...f,
    vaccine_name: '',
    disease: '',
    drug_name: '',
    dosage: '',
    vet_name: '',
    cost: '',
    next_due_date: '',
    notes: '',
  }))

  setLoading(false)
  setTimeout(() => setSuccess(''), 4000)
  return
}

const { data, error: err } = await (supabase.from('poultry_health_records' as any) as any)
  .insert(healthPayload as any)
  .select('*, poultry_batches(batch_name)')

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess('Health record saved!')
    if (data) setEvents(prev => [...(data as any[]).map((d: any) => ({ ...d, event_date: d.record_date })), ...prev])
    setForm(f => ({ ...f, vaccine_name: '', disease: '', drug_name: '', dosage: '', vet_name: '', cost: '', next_due_date: '', notes: '' }))
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Health & Biosecurity</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Vaccinations, treatments, disease records</p>
        </div>
      </div>

      {/* Upcoming banner */}
      {upcoming.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">Due / Upcoming</p>
          <div className="space-y-1.5">
            {upcoming.slice(0, 4).map(e => (
              <div key={e.id} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded border ${URGENCY(e.next_due_date!)}`}>
                  {Math.ceil((new Date(e.next_due_date!).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) <= 0
                    ? 'Overdue'
                    : `${Math.ceil((new Date(e.next_due_date!).getTime() - new Date().getTime()) / (1000 * 3600 * 24))}d`}
                </span>
                <p className="text-xs text-white">{e.poultry_batches?.batch_name} – {e.vaccine_name || e.event_type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#2A2D35] mb-6">
        {([['record', 'Record'], ['schedule', 'Vax Schedule'], ['history', 'History']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === key ? 'border-emerald-500 text-white' : 'border-transparent text-[#6B7280] hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'record' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
              <AlertCircle size={14} className="text-red-400" /><p className="text-sm text-red-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
              <CheckCircle2 size={14} className="text-emerald-400" /><p className="text-sm text-emerald-300">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Batch *</label>
              <select className={FIELD} value={form.batch_id} onChange={e => set('batch_id', e.target.value)}>
                {initialBatches.map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <input type="date" className={FIELD} value={form.event_date} onChange={e => set('event_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Event type *</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(t => (
                <button key={t} type="button" onClick={() => set('event_type', t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    form.event_type === t
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#0A0C10] border border-[#2A2D35] text-[#9CA3AF] hover:text-white'
                  }`}>
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {form.event_type === 'vaccination' && (
            <>
              <div>
                <label className={LABEL}>Vaccine *</label>
                <select className={FIELD} value={form.vaccine_name} onChange={e => set('vaccine_name', e.target.value)}>
                  <option value="">Select vaccine…</option>
                  {VAX_SCHEDULE.map(v => <option key={v.name}>{v.name}</option>)}
                  <option>Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Dosage / Route</label>
                  <input className={FIELD} placeholder="e.g. 1 drop per bird – eye"
                    value={form.dosage} onChange={e => set('dosage', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Next due date</label>
                  <input type="date" className={FIELD} value={form.next_due_date} onChange={e => set('next_due_date', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {(form.event_type === 'treatment' || form.event_type === 'deworming') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Disease / condition</label>
                  <select className={FIELD} value={form.disease} onChange={e => set('disease', e.target.value)}>
                    <option value="">Select…</option>
                    {COMMON_DISEASES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Drug / product</label>
                  <select className={FIELD} value={form.drug_name} onChange={e => set('drug_name', e.target.value)}>
                    <option value="">Select…</option>
                    {COMMON_DRUGS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>Dosage</label>
                <input className={FIELD} placeholder="e.g. 1g per litre for 5 days"
                  value={form.dosage} onChange={e => set('dosage', e.target.value)} />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Vet / Agrovet</label>
              <input className={FIELD} placeholder="Name or contact"
                value={form.vet_name} onChange={e => set('vet_name', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Cost (KES)</label>
              <input type="number" className={FIELD} placeholder="0"
                value={form.cost} onChange={e => set('cost', e.target.value)} min="0" step="0.5" />
            </div>
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea className={`${FIELD} resize-none`} rows={2}
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
            {loading ? 'Saving…' : 'Save health record'}
          </button>
        </form>
      )}

      {tab === 'schedule' && (
        <div className="space-y-3">
          <p className="text-xs text-[#6B7280] mb-4">
            Standard Kenya poultry vaccination schedule. Adjust based on your vet's advice and local disease pressure.
          </p>
          {VAX_SCHEDULE.map(v => (
            <div key={v.name} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{v.name}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">Route: {v.route}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded border border-emerald-900/40 bg-emerald-950/30 text-emerald-400 whitespace-nowrap">
                  {v.alias}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {v.days.map(d => (
                  <span key={d} className="text-[11px] px-2 py-0.5 rounded border border-[#2A2D35] bg-[#0A0C10] text-[#9CA3AF]">
                    Day {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-[#4B5563] mt-4">
            * NDV (Newcastle) is the #1 killer of poultry in Kenya. Never skip this vaccine. Gumboro is critical weeks 2–4.
            Always source vaccines from a licensed agrovet with cold chain compliance.
          </p>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-1">
          {events.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-8">No health records yet</p>
          ) : events.map(e => (
            <div key={e.id} className="flex items-start gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
              <Syringe size={14} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{e.poultry_batches?.batch_name || '—'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#2A2D35] text-[#6B7280] capitalize">
                    {e.event_type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {e.vaccine_name || e.disease || e.drug_name || 'No details'} · {fmt(e.event_date)}
                </p>
                {e.next_due_date && (
                  <p className="text-[11px] text-amber-400 mt-0.5">Next due: {fmt(e.next_due_date)}</p>
                )}
              </div>
              {e.cost && (
                <p className="text-xs text-[#6B7280] flex-shrink-0">KES {e.cost.toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
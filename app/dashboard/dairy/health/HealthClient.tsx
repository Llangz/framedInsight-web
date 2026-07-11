// 📁 FILE PATH: app/dashboard/dairy/health/HealthClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { recordHealthEvent } from './actions'

interface HealthClientProps {
  initialCows: any[]
  initialHistory: any[]
}

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#D1D5DB] mb-1'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const COMMON_ISSUES = [
  'Mastitis', 'Foot and Mouth Disease', 'Brucellosis', 'Lameness',
  'Bloat', 'Diarrhea', 'Anemia', 'Pregnancy complications',
  'Tick infestation', 'Worm infestation', 'Pneumonia', 'Other',
]

const VACCINATION_TYPES = [
  'Foot and Mouth Disease (FMD)', 'Brucellosis', 'Anthrax',
  'Lumpy Skin Disease (LSD)', 'East Coast Fever (ECF)',
  'Blackleg', 'Rift Valley Fever', 'Rabies', 'Other',
]

const RECORD_TYPE_CLASSES: Record<string, string> = {
  vaccination: 'text-sky-400 border-sky-900/40 bg-sky-950/30',
  treatment:   'text-amber-400 border-amber-900/40 bg-amber-950/30',
  diagnosis:   'text-purple-400 border-purple-900/40 bg-purple-950/30',
  checkup:     'text-emerald-400 border-emerald-900/40 bg-emerald-950/30',
}

export default function HealthClient({ initialCows, initialHistory }: HealthClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<'record' | 'history'>('record')

  const [form, setForm] = useState({
    animal_id:               '',
    record_type:             'treatment' as 'treatment' | 'vaccination' | 'diagnosis' | 'checkup',
    health_issue:            '',
    medication:              '',
    dosage:                  '',
    dosage_unit:             'ml',
    treatment_date:          new Date().toISOString().split('T')[0],
    withdrawal_period_days:  '0',
    veterinarian:            '',
    cost:                    '',
    notes:                   '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.animal_id) { setError('Select a cow'); return }
    if (!form.health_issue) { setError('Select the health issue or vaccine type'); return }
    setLoading(true)
    setError('')
    try {
      const result = await recordHealthEvent(form)
      if (!result.success) {
        setError(result.error || 'Failed to record health event')
        return
      }
      setSuccess(`${form.record_type === 'vaccination' ? 'Vaccination' : 'Health'} record saved!`)
      setForm({
        animal_id: '', record_type: 'treatment', health_issue: '',
        medication: '', dosage: '', dosage_unit: 'ml',
        treatment_date: new Date().toISOString().split('T')[0],
        withdrawal_period_days: '0', veterinarian: '', cost: '', notes: '',
      })
      setTimeout(() => { router.refresh(); setTab('history') }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to record health event')
    } finally {
      setLoading(false)
    }
  }

  const issueOptions = form.record_type === 'vaccination' ? VACCINATION_TYPES : COMMON_ISSUES

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dairy" className="text-[#6B7280] hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">Health &amp; Veterinary</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">Treatments, vaccinations and health checks</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-lg border border-[#2A2D35] bg-[#0D0F14] w-fit">
          {(['record', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                tab === t ? 'text-white bg-white/10' : 'text-[#6B7280] hover:text-white'
              }`}
            >
              {t === 'record' ? 'Record event' : 'History'}
            </button>
          ))}
        </div>

        {tab === 'record' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-300">{success}</p>
              </div>
            )}

            {initialCows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#2A2D35] p-8 text-center">
                <p className="text-sm text-[#6B7280] mb-2">No active cows registered</p>
                <Link href="/dashboard/dairy/add-cow" className="text-sm text-emerald-500">Add a cow →</Link>
              </div>
            ) : (
              <>
                {/* Cow + Record type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Cow *</label>
                    <select className={FIELD} value={form.animal_id} onChange={e => set('animal_id', e.target.value)} required>
                      <option value="">Select cow</option>
                      {initialCows.map(c => (
                        <option key={c.id} value={c.id}>{c.cow_tag || c.animal_id}{c.name ? ` — ${c.name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Event type *</label>
                    <select className={FIELD} value={form.record_type} onChange={e => set('record_type', e.target.value)}>
                      <option value="treatment">Treatment</option>
                      <option value="vaccination">Vaccination</option>
                      <option value="diagnosis">Diagnosis</option>
                      <option value="checkup">Health checkup</option>
                    </select>
                  </div>
                </div>

                {/* Issue / vaccine */}
                <div>
                  <label className={LABEL}>{form.record_type === 'vaccination' ? 'Vaccine type *' : 'Health issue *'}</label>
                  <select className={FIELD} value={form.health_issue} onChange={e => set('health_issue', e.target.value)} required>
                    <option value="">Select…</option>
                    {issueOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                {/* Treatment details */}
                {form.record_type === 'treatment' && (
                  <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                    <div className="px-4 py-3 border-b border-[#2A2D35]">
                      <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Treatment details</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className={LABEL}>Medication name</label>
                        <input className={FIELD} placeholder="e.g. Amoxicillin, Terramycin, Penstrep"
                          value={form.medication} onChange={e => set('medication', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={LABEL}>Dosage</label>
                          <input type="number" step="0.1" className={FIELD} placeholder="e.g. 100"
                            value={form.dosage} onChange={e => set('dosage', e.target.value)} />
                        </div>
                        <div>
                          <label className={LABEL}>Unit</label>
                          <select className={FIELD} value={form.dosage_unit} onChange={e => set('dosage_unit', e.target.value)}>
                            <option value="ml">ml</option>
                            <option value="L">L</option>
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="tablet">tablet(s)</option>
                            <option value="sachet">sachet(s)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={LABEL}>Withdrawal period (days)</label>
                        <input type="number" min="0" className={FIELD} placeholder="e.g. 7"
                          value={form.withdrawal_period_days} onChange={e => set('withdrawal_period_days', e.target.value)} />
                        <p className="text-[11px] text-[#4B5563] mt-1">Days before milk / meat can be sold</p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Date + vet + cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>{form.record_type === 'vaccination' ? 'Vaccination date *' : 'Treatment date *'}</label>
                    <input type="date" className={FIELD} value={form.treatment_date} onChange={e => set('treatment_date', e.target.value)} required />
                  </div>
                  <div>
                    <label className={LABEL}>Cost (KES)</label>
                    <input type="number" step="0.01" min="0" className={FIELD} placeholder="e.g. 1500"
                      value={form.cost} onChange={e => set('cost', e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className={LABEL}>Veterinarian name (optional)</label>
                  <input className={FIELD} placeholder="e.g. Dr. Kamau, DVS office"
                    value={form.veterinarian} onChange={e => set('veterinarian', e.target.value)} />
                </div>

                <div>
                  <label className={LABEL}>Notes (optional)</label>
                  <textarea className={`${FIELD} resize-none`} rows={3}
                    placeholder="Additional observations, follow-up actions, or recommendations…"
                    value={form.notes} onChange={e => set('notes', e.target.value)} />
                </div>

                {/* Protocol reminder */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                  <Info size={13} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-[#6B7280]">
                    Always record withdrawal periods for medication · Keep vaccinations per DVS schedule · Quarantine sick animals to prevent disease spread
                  </p>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
                  {loading ? 'Saving…' : 'Save health record'}
                </button>
              </>
            )}
          </form>
        )}

        {tab === 'history' && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
            {initialHistory.length === 0 ? (
              <p className="text-sm text-[#6B7280] px-4 py-8 text-center">No health records yet</p>
            ) : (
              <div className="divide-y divide-[#1F2128]">
                {initialHistory.map(record => {
                  const rtype = record.record_type || 'treatment'
                  return (
                    <div key={`${rtype[0]}-${record.id}`} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {record.cows?.cow_tag || record.cows?.animal_id || '—'}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {record.disease || '—'}
                          {record.drug_name ? ` · ${record.drug_name}` : ''}
                          {record.vet_name ? ` · ${record.vet_name}` : ''}
                        </p>
                        <p className="text-[11px] text-[#4B5563] mt-0.5">
                          {new Date(record.treatment_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {record.cost ? ` · KES ${Number(record.cost).toLocaleString()}` : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded border capitalize flex-shrink-0 ${RECORD_TYPE_CLASSES[rtype] ?? RECORD_TYPE_CLASSES.treatment}`}>
                        {rtype}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  )
}
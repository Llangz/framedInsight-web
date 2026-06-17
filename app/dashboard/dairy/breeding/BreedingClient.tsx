// 📁 FILE PATH: app/dashboard/dairy/breeding/BreedingClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, CheckCircle2, Heart, Info } from 'lucide-react'
import { recordBreeding } from './actions'

interface BreedingClientProps {
  initialCows: any[]
  initialHistory: any[]
}

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#D1D5DB] mb-1'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const RESULT_CLASSES: Record<string, string> = {
  positive: 'text-emerald-400 border-emerald-900/40 bg-emerald-950/30',
  negative:  'text-red-400 border-red-900/40 bg-red-950/30',
  pending:   'text-amber-400 border-amber-900/40 bg-amber-950/30',
}

export default function BreedingClient({ initialCows, initialHistory }: BreedingClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<'record' | 'history'>('record')

  const [form, setForm] = useState({
    dam_id: '',
    service_date: new Date().toISOString().split('T')[0],
    service_type: 'AI',
    sire_id: '',
    sire_name: '',
    notes: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const dueDate = form.service_date
    ? new Date(new Date(form.service_date).getTime() + 283 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await recordBreeding(form)
      setSuccess('Breeding record saved!')
      setForm({
        dam_id: '',
        service_date: new Date().toISOString().split('T')[0],
        service_type: 'AI',
        sire_id: '',
        sire_name: '',
        notes: '',
      })
      setTimeout(() => { router.refresh(); setTab('history') }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to record breeding event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dairy" className="text-[#6B7280] hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">Breeding</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">Service records and calving dates</p>
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
              {t === 'record' ? 'Record service' : 'History'}
            </button>
          ))}
        </div>

        {tab === 'record' && (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Dam (cow) *</label>
                    <select className={FIELD} value={form.dam_id} onChange={e => set('dam_id', e.target.value)} required>
                      <option value="">Select cow</option>
                      {initialCows.map(c => (
                        <option key={c.id} value={c.id}>{c.cow_tag || c.animal_id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Service date *</label>
                    <input type="date" className={FIELD} value={form.service_date} onChange={e => set('service_date', e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label className={LABEL}>Service type *</label>
                  <select className={FIELD} value={form.service_type} onChange={e => set('service_type', e.target.value)}>
                    <option value="AI">Artificial Insemination (AI)</option>
                    <option value="natural">Natural service</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>{form.service_type === 'AI' ? 'Semen batch / code' : 'Sire (bull) ID'}</label>
                    <input type="text" className={FIELD}
                      placeholder={form.service_type === 'AI' ? 'e.g. HF-2024-001' : 'e.g. BULL-001'}
                      value={form.sire_id} onChange={e => set('sire_id', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Sire breed / name</label>
                    <input type="text" className={FIELD} placeholder="e.g. Holstein Friesian"
                      value={form.sire_name} onChange={e => set('sire_name', e.target.value)} />
                  </div>
                </div>

                {/* Expected calving */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                  <Heart size={14} className="text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-[#9CA3AF]">
                    Expected calving: <span className="font-semibold text-white">{dueDate}</span>
                    <span className="text-[11px] text-[#4B5563] ml-2">(283 days post-service)</span>
                  </p>
                </div>

                <div>
                  <label className={LABEL}>Notes (optional)</label>
                  <input className={FIELD} placeholder="e.g. AI technician name, heat signs observed…"
                    value={form.notes} onChange={e => set('notes', e.target.value)} />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
                  {loading ? 'Saving…' : 'Record service'}
                </button>
              </>
            )}
          </form>
        )}

        {tab === 'history' && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
            {initialHistory.length === 0 ? (
              <p className="text-sm text-[#6B7280] px-4 py-8 text-center">No breeding history yet</p>
            ) : (
              <div className="divide-y divide-[#1F2128]">
                {initialHistory.map(e => {
                  const res = e.pregnancy_result || 'pending'
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {e.cows?.cow_tag || e.cows?.animal_id || '—'}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {e.service_type === 'AI' ? 'AI' : 'Natural'} · {fmt(e.service_date)}
                          {e.expected_calving_date && ` · Due ${fmt(e.expected_calving_date)}`}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${RESULT_CLASSES[res] ?? RESULT_CLASSES.pending} capitalize`}>
                        {res}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Quick ref */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
          <Info size={13} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-[#6B7280]">
            Gestation: 283 days · Heat cycle: 21 days · AI success rate: 60–70%
          </p>
        </div>

      </div>
    </div>
  )
}
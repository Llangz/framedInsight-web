'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baby, CalendarDays, Scale, Info, ChevronLeft } from 'lucide-react'
import { recordCalfBirth } from './actions'

interface Dam {
  id: string
  cow_tag: string
  name: string | null
  sex: string | null
  breed: string | null
}

const inputCls = () =>
  'w-full px-3 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#0D0F14] text-white placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-emerald-700'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}</span>
      {children}
    </label>
  )
}

export default function AddCalfClient({ dams, farmId }: { dams: Dam[]; farmId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    dam_id: dams[0]?.id || '',
    sex: 'female',
    birth_date: new Date().toISOString().split('T')[0],
    birth_weight: '',
    sire_code: '',
    notes: '',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.dam_id) {
      setError('Select the dam')
      return
    }
    setLoading(true)
    setError(null)

    const result = await recordCalfBirth(form)

    if (!result.success) {
      setError(result.error || 'Could not save calf record')
      setLoading(false)
      return
    }

    router.push('/dashboard/dairy/calves')
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <Link
          href="/dashboard/dairy/calves"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-white transition-colors"
        >
          <ChevronLeft size={14} /> Calves
        </Link>

        <div className="flex items-center gap-2">
          <Baby size={18} className="text-emerald-500" />
          <h1 className="text-xl font-semibold text-white tracking-tight">Record calf birth</h1>
        </div>

        {dams.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#2A2D35] p-8 text-center">
            <p className="text-sm text-[#6B7280]">No cows registered yet — add a cow first before recording a calving.</p>
            <Link href="/dashboard/dairy/add-cow" className="inline-block mt-3 text-sm text-emerald-500 hover:text-emerald-400">
              Add a cow →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-4">
              <Field label="Dam (mother)">
                <select value={form.dam_id} onChange={set('dam_id')} className={inputCls()} style={{ WebkitTextFillColor: 'white', color: 'white' }}>
                  {dams.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.cow_tag} {d.breed ? `· ${d.breed}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Sex">
                  <select value={form.sex} onChange={set('sex')} className={inputCls()} style={{ WebkitTextFillColor: 'white', color: 'white' }}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </Field>

                <Field label="Birth date">
                  <div className="relative">
                    <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                    <input
                      type="date"
                      value={form.birth_date}
                      onChange={set('birth_date')}
                      max={new Date().toISOString().split('T')[0]}
                      className={`${inputCls()} pl-8`}
                      style={{ WebkitTextFillColor: 'white', color: 'white' }}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Birth weight (kg)">
                  <div className="relative">
                    <Scale size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                    <input
                      type="number"
                      value={form.birth_weight}
                      onChange={set('birth_weight')}
                      placeholder="e.g. 28"
                      min="0"
                      step="0.5"
                      className={`${inputCls()} pl-8`}
                      style={{ WebkitTextFillColor: 'white', color: 'white' }}
                    />
                  </div>
                </Field>

                <Field label="Sire (bull code, optional)">
                  <input
                    value={form.sire_code}
                    onChange={set('sire_code')}
                    placeholder="e.g. AI code"
                    className={inputCls()}
                    style={{ WebkitTextFillColor: 'white', color: 'white' }}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={set('notes')}
                  rows={3}
                  placeholder="Colostrum given, calving difficulty, vigor, anything worth remembering…"
                  className={inputCls()}
                  style={{ WebkitTextFillColor: 'white', color: 'white' }}
                />
              </Field>
            </section>

            <div className="flex items-start gap-2.5 rounded-lg border border-sky-900/40 bg-sky-950/20 p-3.5">
              <Info size={14} className="text-sky-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-sky-200/80 leading-relaxed">
                Get colostrum into the calf within 6 hours of birth, and make sure it totals roughly
                10&ndash;12% of the calf&rsquo;s body weight over the first 24 hours — the calf&rsquo;s gut
                can only absorb those antibodies during this window. In Kenyan smallholder herds,
                gastrointestinal disease (scours) in the first weeks is the leading cause of calf loss,
                and colostrum timing is the single biggest factor in whether a calf can fight it off.
                Note it above if you can.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-md px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-md transition-colors"
            >
              {loading ? 'Saving…' : 'Record birth'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Batch {
  id: string
  batch_name: string
  bird_type: string
  breed: string | null
  date_of_placement: string
  initial_count: number
  current_count: number
  status: string
  source: string | null
  purchase_price_per_bird: number | null
  house_number: string | null
  housing_system: string | null
  expected_laying_date: string | null
  target_weight_kg: number | null
  notes: string | null
}

interface Props { batch: Batch }

const BREEDS: Record<string, string[]> = {
  layer:        ['Isa Brown', 'Lohmann Brown', 'KALRO Improved', 'Hyline Brown', 'Nick Chick', 'Other'],
  broiler:      ['Ross 308', 'Cobb 500', 'Arbor Acres', 'Hubbard', 'Other'],
  kienyeji:     ['KARI Improved Kienyeji', 'KALRO Improved', 'Rainbow Rooster', 'Kuroiler', 'Village Kienyeji', 'Other'],
  dual_purpose: ['Kenbro', 'Rainbow Rooster', 'Kuroiler', 'Sasso', 'Other'],
}
const SOURCES  = ['Hatchery', 'Cooperative', 'Private breeder', 'Own hatching', 'KALRO', 'Other']
const HOUSING  = ['Deep litter', 'Battery cage', 'Free range', 'Semi-intensive', 'Pasture', 'Open shed']
const STATUSES = ['active', 'sold', 'culled', 'closed']

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-bold text-[#D1D5DB] mb-1'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-xl p-5 space-y-4">
      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
}

export default function EditBatchClient({ batch }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const isLayerType = batch.bird_type === 'layer' || batch.bird_type === 'dual_purpose'
  const missingFields = [
    !batch.source && 'source',
    !batch.housing_system && 'housing system',
    !batch.house_number && 'house/pen number',
    !batch.breed && 'breed',
    !batch.purchase_price_per_bird && 'purchase price',
    (isLayerType ? !batch.expected_laying_date : !batch.target_weight_kg) &&
      (isLayerType ? 'expected laying date' : 'target weight'),
  ].filter(Boolean) as string[]

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    batch_name:              batch.batch_name,
    breed:                   batch.breed ?? '',
    status:                  batch.status,
    source:                  batch.source ?? '',
    purchase_price_per_bird: batch.purchase_price_per_bird?.toString() ?? '',
    house_number:            batch.house_number ?? '',
    housing_system:          batch.housing_system ?? '',
    expected_laying_date:    batch.expected_laying_date ?? '',
    target_weight_kg:        batch.target_weight_kg?.toString() ?? '',
    notes:                   batch.notes ?? '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.batch_name.trim()) { setError('Batch name is required'); return }
    setLoading(true)

    const updates: any = {
      batch_name:              form.batch_name.trim(),
      breed:                   form.breed || null,
      status:                  form.status,
      source:                  form.source || null,
      purchase_price_per_bird: form.purchase_price_per_bird ? parseFloat(form.purchase_price_per_bird) : null,
      house_number:            form.house_number || null,
      housing_system:          form.housing_system || null,
      expected_laying_date:    form.expected_laying_date || null,
      target_weight_kg:        form.target_weight_kg ? parseFloat(form.target_weight_kg) : null,
      notes:                   form.notes || null,
      updated_at:              new Date().toISOString(),
    }

    const { error: err } = await (supabase as any)
      .from('poultry_batches')
      .update(updates)
      .eq('id', batch.id)

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => router.push(`/dashboard/poultry/flock/${batch.id}`), 1200)
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
        <h2 className="text-white font-semibold text-lg mb-1">Batch updated!</h2>
        <p className="text-[#6B7280] text-sm">Redirecting…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Nav */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/poultry/flock/${batch.id}`} className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Edit Batch</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">{batch.batch_name}</p>
        </div>
      </div>

      {/* Incomplete fields banner */}
      {missingFields.length > 0 && (
        <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-400 text-base flex-shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-amber-300 text-sm font-bold">Fill in missing details</p>
            <p className="text-amber-400/80 text-xs mt-0.5">
              {missingFields.join(', ')} {missingFields.length === 1 ? 'is' : 'are'} missing — these help with performance tracking and financial reports.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        <Section title="Batch identity">
          <Row>
            <div>
              <label className={LABEL}>Batch name *</label>
              <input className={FIELD} value={form.batch_name} onChange={e => set('batch_name', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Breed</label>
              <select className={FIELD} value={form.breed} onChange={e => set('breed', e.target.value)}>
                <option value="">Select breed…</option>
                {(BREEDS[batch.bird_type] ?? BREEDS.layer).map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </Row>
          <Row>
            <div>
              <label className={LABEL}>Status</label>
              <select className={FIELD} value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Source</label>
              <select className={FIELD} value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">Select source…</option>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </Row>
        </Section>

        <Section title="Housing">
          <Row>
            <div>
              <label className={LABEL}>House / pen number</label>
              <input className={FIELD} placeholder="e.g. House 1, Pen A" value={form.house_number} onChange={e => set('house_number', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Housing system</label>
              <select className={FIELD} value={form.housing_system} onChange={e => set('housing_system', e.target.value)}>
                <option value="">Select system…</option>
                {HOUSING.map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
          </Row>
        </Section>

        <Section title="Economics">
          <div>
            <label className={LABEL}>Purchase price per bird (KES)</label>
            <input type="number" className={FIELD} placeholder="e.g. 120" min="0" step="0.5"
              value={form.purchase_price_per_bird} onChange={e => set('purchase_price_per_bird', e.target.value)} />
            {form.purchase_price_per_bird && (
              <p className="text-[11px] text-[#4B5563] mt-1">
                Total flock cost: KES {(parseFloat(form.purchase_price_per_bird) * batch.initial_count).toLocaleString()}
              </p>
            )}
          </div>
        </Section>

        <Section title={isLayerType ? 'Production target' : 'Growth target'}>
          {isLayerType ? (
            <div>
              <label className={LABEL}>Expected start of laying</label>
              <input type="date" className={FIELD} value={form.expected_laying_date} onChange={e => set('expected_laying_date', e.target.value)} />
              <p className="text-[11px] text-[#4B5563] mt-1">Layers typically start at 18–22 weeks. Kienyeji at 22–24 weeks.</p>
            </div>
          ) : (
            <div>
              <label className={LABEL}>Target slaughter weight (kg)</label>
              <input type="number" className={FIELD} placeholder="e.g. 2.0" min="0" step="0.1"
                value={form.target_weight_kg} onChange={e => set('target_weight_kg', e.target.value)} />
              <p className="text-[11px] text-[#4B5563] mt-1">Ross 308 typically reaches 2.0–2.5 kg at 35–42 days in Kenya.</p>
            </div>
          )}
        </Section>

        <Section title="Notes">
          <div>
            <label className={LABEL}>Notes</label>
            <textarea className={`${FIELD} resize-none`} rows={3}
              placeholder="Vaccination schedule, feed program, any observations…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </Section>

        <div className="flex gap-3">
          <Link
            href={`/dashboard/poultry/flock/${batch.id}`}
            className="flex-1 text-center px-4 py-2.5 rounded-xl border border-[#2A2D35] text-sm text-[#9CA3AF] hover:text-white hover:border-[#4B5563] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>

      </form>
    </div>
  )
}
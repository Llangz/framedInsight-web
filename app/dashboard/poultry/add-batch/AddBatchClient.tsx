'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bird, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Props { farmId: string }

const BIRD_TYPES = [
  { value: 'layer',        label: 'Layers',          desc: 'Eggs only – KALRO Improved, Isa Brown, Lohmann, etc.' },
  { value: 'broiler',      label: 'Broilers',        desc: 'Meat – Ross 308, Cobb 500, Arbor Acres'             },
  { value: 'kienyeji',     label: 'Kienyeji',        desc: 'Indigenous / improved local – KARI improved, KALRO'  },
  { value: 'dual_purpose', label: 'Dual Purpose',    desc: 'Eggs + meat – Kenbro, Rainbow Rooster, Kuroiler'    },
]

const BREEDS: Record<string, string[]> = {
  layer:        ['Isa Brown', 'Lohmann Brown', 'KALRO Improved', 'Hyline Brown', 'Nick Chick', 'Other'],
  broiler:      ['Ross 308', 'Cobb 500', 'Arbor Acres', 'Hubbard', 'Other'],
  kienyeji:     ['KARI Improved Kienyeji', 'KALRO Improved', 'Rainbow Rooster', 'Kuroiler', 'Village Kienyeji', 'Other'],
  dual_purpose: ['Kenbro', 'Rainbow Rooster', 'Kuroiler', 'Sasso', 'Other'],
}

const SOURCES = ['Hatchery', 'Cooperative', 'Private breeder', 'Own hatching', 'KALRO', 'Other']
const HOUSING = ['Deep litter', 'Battery cage', 'Free range', 'Semi-intensive', 'Pasture', 'Open shed']

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-bold text-[#D1D5DB] mb-1'

export default function AddBatchClient({ farmId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    batch_name:         '',
    bird_type:          'layer' as 'layer' | 'broiler' | 'kienyeji' | 'dual_purpose',
    breed:              '',
    date_of_placement:  new Date().toISOString().split('T')[0],
    initial_count:      '',
    current_count:      '',
    source:             '',
    purchase_price_per_bird: '',
    house_number:       '',
    housing_system:     '',
    target_weight_kg:   '',
    expected_laying_date: '',
    notes:              '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!form.batch_name.trim()) { setError('Batch name is required'); setLoading(false); return }
    if (!form.initial_count || parseInt(form.initial_count) < 1) { setError('Bird count is required'); setLoading(false); return }

    const count = parseInt(form.initial_count)

    const { error: err } = await (supabase as any).from('poultry_batches').insert({
      farm_id:                farmId,
      batch_name:             form.batch_name.trim(),
      bird_type:              form.bird_type,
      date_of_placement:      form.date_of_placement,
      current_count:          count,
      source:                 form.source || null,
      status:                 'active',
      notes:                  form.notes || null,
    })

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => router.push('/dashboard/poultry'), 1500)
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
        <h2 className="text-white font-semibold text-lg mb-1">Batch registered!</h2>
        <p className="text-[#6B7280] text-sm">Redirecting to poultry dashboard…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Register Batch</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Add a new flock to your poultry enterprise</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-6 rounded-lg border border-red-900/40 bg-red-950/30">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Bird type selection */}
        <div>
          <label className={LABEL}>Bird type *</label>
          <div className="grid grid-cols-2 gap-2">
            {BIRD_TYPES.map(t => (
              <button key={t.value} type="button"
                onClick={() => { set('bird_type', t.value); set('breed', '') }}
                className={`text-left px-3 py-3 rounded-lg border text-sm transition-colors ${
                  form.bird_type === t.value
                    ? 'border-emerald-600/60 bg-emerald-950/30 text-white'
                    : 'border-[#2A2D35] bg-[#0A0C10] text-[#9CA3AF] hover:border-[#3A3D45]'
                }`}>
                <p className="font-medium">{t.label}</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5 leading-tight">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Batch name *</label>
            <input className={FIELD} placeholder="e.g. Batch 12, Jan 2025 Layers"
              value={form.batch_name} onChange={e => set('batch_name', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Breed</label>
            <select className={FIELD} value={form.breed} onChange={e => set('breed', e.target.value)}>
              <option value="">Select breed…</option>
              {BREEDS[form.bird_type].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Date of placement *</label>
            <input type="date" className={FIELD}
              value={form.date_of_placement} onChange={e => set('date_of_placement', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Number of birds *</label>
            <input type="number" className={FIELD} placeholder="e.g. 500"
              value={form.initial_count} onChange={e => set('initial_count', e.target.value)} min="1" />
          </div>
        </div>

        {/* Source & cost */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Source</label>
            <select className={FIELD} value={form.source} onChange={e => set('source', e.target.value)}>
              <option value="">Select source…</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Purchase price / bird (KES)</label>
            <input type="number" className={FIELD} placeholder="e.g. 120"
              value={form.purchase_price_per_bird} onChange={e => set('purchase_price_per_bird', e.target.value)} min="0" step="0.5" />
          </div>
        </div>

        {/* Housing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>House / unit number</label>
            <input className={FIELD} placeholder="e.g. House 1, Pen A"
              value={form.house_number} onChange={e => set('house_number', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Housing system</label>
            <select className={FIELD} value={form.housing_system} onChange={e => set('housing_system', e.target.value)}>
              <option value="">Select system…</option>
              {HOUSING.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
        </div>

        {/* Type-specific fields */}
        {(form.bird_type === 'layer' || form.bird_type === 'dual_purpose') && (
          <div>
            <label className={LABEL}>Expected start of laying (date)</label>
            <input type="date" className={FIELD}
              value={form.expected_laying_date} onChange={e => set('expected_laying_date', e.target.value)} />
            <p className="text-[11px] text-[#4B5563] mt-1">Layers typically start at 18–22 weeks. Kienyeji at 22–24 weeks.</p>
          </div>
        )}

        {form.bird_type === 'broiler' && (
          <div>
            <label className={LABEL}>Target slaughter weight (kg)</label>
            <input type="number" className={FIELD} placeholder="e.g. 2.0"
              value={form.target_weight_kg} onChange={e => set('target_weight_kg', e.target.value)} min="0" step="0.1" />
            <p className="text-[11px] text-[#4B5563] mt-1">Ross 308 typically reaches 2.0–2.5kg at 35–42 days in Kenya.</p>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className={LABEL}>Notes</label>
          <textarea className={`${FIELD} resize-none`} rows={3}
            placeholder="Vaccination schedule, feed program, any observations…"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/poultry"
            className="flex-1 text-center px-4 py-2.5 rounded-md border border-[#2A2D35] text-sm text-[#9CA3AF] hover:text-white hover:border-[#4B5563] transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
            {loading ? 'Saving…' : 'Register batch'}
          </button>
        </div>

      </form>
    </div>
  )
}
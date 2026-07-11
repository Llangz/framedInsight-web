// 📁 FILE PATH: app/dashboard/dairy/cows/[id]/edit/EditCowClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { updateCow } from '../../action'
import { Database } from '@/lib/database.types'

type Cow = Database['public']['Tables']['cows']['Row']

interface FarmCow {
  id: string
  cow_tag: string
  name: string | null
  sex: string | null
}

interface Props {
  cow: Cow
  farmCows: FarmCow[]
}

const DAIRY_BREEDS = [
  'Friesian', 'Ayrshire', 'Guernsey', 'Jersey',
  'Sahiwal', 'Zebu (Boran)', 'Friesian × Sahiwal', 'Friesian × Zebu',
  'Ayrshire × Zebu', 'Crossbred', 'Other',
]

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#D1D5DB] mb-1'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2A2D35]">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  )
}

export default function EditCowClient({ cow, farmCows }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    cow_tag:        cow.cow_tag,
    name:           cow.name ?? '',
    breed:          cow.breed ?? '',
    sex:            cow.sex ?? 'female',
    birth_date:     cow.birth_date ?? '',
    purpose:        cow.purpose ?? 'dairy',
    status:         cow.status ?? 'active',
    source:         cow.source ?? '',
    purchase_price: cow.purchase_price?.toString() ?? '',
    purchase_date:  cow.purchase_date ?? '',
    sire_id:        cow.sire_id ?? '',
    dam_id:         cow.dam_id ?? '',
    exit_date:      cow.exit_date ?? '',
    exit_reason:    cow.exit_reason ?? '',
    exit_value:     cow.exit_value?.toString() ?? '',
    qr_code:        cow.qr_code ?? '',
    notes:          cow.notes ?? '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const bulls  = farmCows.filter(c => c.sex === 'male')
  const dams   = farmCows.filter(c => c.sex === 'female' || !c.sex)
  const isExited = ['sold', 'deceased', 'culled'].includes(form.status)

  async function handleSubmit() {
    setError(null)
    if (!form.cow_tag.trim()) { setError('Tag/ID is required'); return }
    setSaving(true)
    try {
      const result = await updateCow(cow.id, {
        cow_tag:        form.cow_tag.trim().toUpperCase(),
        name:           form.name.trim() || null,
        breed:          form.breed || null,
        sex:            form.sex || null,
        birth_date:     form.birth_date || null,
        purpose:        form.purpose || null,
        status:         form.status || null,
        source:         form.source || null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        purchase_date:  form.purchase_date || null,
        sire_id:        form.sire_id || null,
        dam_id:         form.dam_id || null,
        exit_date:      form.exit_date || null,
        exit_reason:    form.exit_reason || null,
        exit_value:     form.exit_value ? parseFloat(form.exit_value) : null,
        qr_code:        form.qr_code.trim() || null,
        notes:          form.notes.trim() || null,
      })
      if (!result.success) {
        setError(result.error || 'Failed to save changes')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push(`/dashboard/dairy/cows/${cow.id}`), 700)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/dairy/cows/${cow.id}`} className="text-[#6B7280] hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">Edit — {cow.name ?? cow.cow_tag}</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">Tag: {cow.cow_tag}</p>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <p className="text-sm text-emerald-300">Saved — redirecting…</p>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
            <AlertCircle size={14} className="text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Identification */}
        <Section title="Identification">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Tag / ID *</label>
              <input className={FIELD} value={form.cow_tag} onChange={e => set('cow_tag', e.target.value)} placeholder="e.g. COW001" />
            </div>
            <div>
              <label className={LABEL}>Name</label>
              <input className={FIELD} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Daisy" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Breed</label>
              <select className={FIELD} value={form.breed} onChange={e => set('breed', e.target.value)}>
                <option value="">Select breed</option>
                {DAIRY_BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Sex</label>
              <select className={FIELD} value={form.sex} onChange={e => set('sex', e.target.value)}>
                <option value="female">Female</option>
                <option value="male">Male (Bull)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>Date of birth</label>
            <input type="date" className={FIELD} value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
          </div>
        </Section>

        {/* Management */}
        <Section title="Management">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Purpose</label>
              <select className={FIELD} value={form.purpose} onChange={e => set('purpose', e.target.value)}>
                <option value="dairy">Dairy</option>
                <option value="beef">Beef</option>
                <option value="dual">Dual purpose</option>
                <option value="breeding">Breeding</option>
                <option value="calf">Calf</option>
                <option value="heifer">Heifer</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Status</label>
              <select className={FIELD} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="dry">Dry</option>
                <option value="pregnant">Pregnant</option>
                <option value="sold">Sold</option>
                <option value="deceased">Deceased</option>
                <option value="culled">Culled</option>
              </select>
            </div>
          </div>

          {isExited && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Exit date</label>
                <input type="date" className={FIELD} value={form.exit_date} onChange={e => set('exit_date', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Exit value (KES)</label>
                <input type="number" className={FIELD} value={form.exit_value} onChange={e => set('exit_value', e.target.value)} placeholder="e.g. 80000" />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Exit reason</label>
                <input className={FIELD} value={form.exit_reason} onChange={e => set('exit_reason', e.target.value)} placeholder="e.g. Low production, old age" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Source</label>
              <select className={FIELD} value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">Select…</option>
                <option value="born on farm">Born on farm</option>
                <option value="purchased">Purchased</option>
                <option value="donated">Donated</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>QR code</label>
              <input className={FIELD} value={form.qr_code} onChange={e => set('qr_code', e.target.value)} placeholder="Scan or type" />
            </div>
          </div>

          {(form.source === 'purchased' || cow.purchase_price || cow.purchase_date) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Purchase price (KES)</label>
                <input type="number" className={FIELD} value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="e.g. 80000" />
              </div>
              <div>
                <label className={LABEL}>Purchase date</label>
                <input type="date" className={FIELD} value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
              </div>
            </div>
          )}
        </Section>

        {/* Parentage */}
        <Section title="Parentage">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Sire (bull / father)</label>
              <select className={FIELD} value={form.sire_id} onChange={e => set('sire_id', e.target.value)}>
                <option value="">Unknown / External</option>
                {bulls.map(b => <option key={b.id} value={b.id}>{b.cow_tag}{b.name ? ` — ${b.name}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Dam (mother)</label>
              <select className={FIELD} value={form.dam_id} onChange={e => set('dam_id', e.target.value)}>
                <option value="">Unknown</option>
                {dams.map(c => <option key={c.id} value={c.id}>{c.cow_tag}{c.name ? ` — ${c.name}` : ''}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <textarea className={`${FIELD} resize-none`} rows={3}
            value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Any additional notes about this animal…" />
        </Section>

        <div className="flex gap-3 pb-8">
          <Link href={`/dashboard/dairy/cows/${cow.id}`}
            className="flex-1 py-2.5 text-sm font-medium rounded-md border border-[#2A2D35] text-[#9CA3AF] hover:text-white hover:border-[#3A3D45] transition-colors text-center">
            Cancel
          </Link>
          <button onClick={handleSubmit} disabled={saving || success}
            className="flex-1 py-2.5 text-sm font-medium rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors">
            {saving ? 'Saving…' : success ? '✓ Saved' : 'Save changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
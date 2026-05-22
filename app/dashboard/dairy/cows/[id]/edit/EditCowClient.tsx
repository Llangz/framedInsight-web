'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
    >
      {children}
    </select>
  )
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
    />
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
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

  const bulls    = farmCows.filter(c => c.sex === 'male')
  const dams     = farmCows.filter(c => c.sex === 'female' || !c.sex)
  const isExited = form.status === 'sold' || form.status === 'deceased' || form.status === 'culled'

  async function handleSubmit() {
    setError(null)
    if (!form.cow_tag.trim()) { setError('Tag/ID is required'); return }

    setSaving(true)
    try {
      await updateCow(cow.id, {
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
      setSuccess(true)
      setTimeout(() => router.push(`/dashboard/dairy/cows/${cow.id}`), 700)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const displayName = cow.name ?? cow.cow_tag

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/dairy/cows/${cow.id}`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Edit 🐄 {displayName}</h1>
                <p className="text-xs text-gray-500 mt-0.5">Tag: {cow.cow_tag}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 space-y-6">

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium">
            ✓ Saved — redirecting…
          </div>
        )}

        {/* Identification */}
        <Section title="Identification">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Tag / ID</Label>
              <Input
                value={form.cow_tag}
                onChange={e => set('cow_tag', e.target.value)}
                placeholder="e.g. COW001"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Daisy"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Breed</Label>
              <Select value={form.breed} onChange={e => set('breed', e.target.value)}>
                <option value="">Select breed</option>
                {DAIRY_BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
            <div>
              <Label>Sex</Label>
              <Select value={form.sex} onChange={e => set('sex', e.target.value)}>
                <option value="female">♀ Female</option>
                <option value="male">♂ Male (Bull)</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={form.birth_date}
              onChange={e => set('birth_date', e.target.value)}
            />
          </div>
        </Section>

        {/* Management */}
        <Section title="Management">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Purpose</Label>
              <Select value={form.purpose} onChange={e => set('purpose', e.target.value)}>
                <option value="dairy">Dairy</option>
                <option value="beef">Beef</option>
                <option value="dual">Dual purpose</option>
                <option value="breeding">Breeding</option>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="dry">Dry</option>
                <option value="pregnant">Pregnant</option>
                <option value="sold">Sold</option>
                <option value="deceased">Deceased</option>
                <option value="culled">Culled</option>
              </Select>
            </div>
          </div>

          {/* Exit details — shown when status is sold/deceased/culled */}
          {isExited && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <Label>Exit date</Label>
                <Input
                  type="date"
                  value={form.exit_date}
                  onChange={e => set('exit_date', e.target.value)}
                />
              </div>
              <div>
                <Label>Exit value (KES)</Label>
                <Input
                  type="number"
                  value={form.exit_value}
                  onChange={e => set('exit_value', e.target.value)}
                  placeholder="e.g. 80000"
                />
              </div>
              <div className="col-span-2">
                <Label>Exit reason</Label>
                <Input
                  value={form.exit_reason}
                  onChange={e => set('exit_reason', e.target.value)}
                  placeholder="e.g. Low production, old age"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Source</Label>
              <Select value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">Select…</option>
                <option value="born on farm">Born on farm</option>
                <option value="purchased">Purchased</option>
                <option value="donated">Donated</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label>QR Code</Label>
              <Input
                value={form.qr_code}
                onChange={e => set('qr_code', e.target.value)}
                placeholder="Scan or type"
              />
            </div>
          </div>

          {(form.source === 'purchased' || cow.purchase_price || cow.purchase_date) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Purchase price (KES)</Label>
                <Input
                  type="number"
                  value={form.purchase_price}
                  onChange={e => set('purchase_price', e.target.value)}
                  placeholder="e.g. 80000"
                />
              </div>
              <div>
                <Label>Purchase date</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={e => set('purchase_date', e.target.value)}
                />
              </div>
            </div>
          )}
        </Section>

        {/* Parentage */}
        <Section title="Parentage">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sire (father/bull)</Label>
              <Select value={form.sire_id} onChange={e => set('sire_id', e.target.value)}>
                <option value="">Unknown / External</option>
                {bulls.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.cow_tag}{b.name ? ` — ${b.name}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Dam (mother)</Label>
              <Select value={form.dam_id} onChange={e => set('dam_id', e.target.value)}>
                <option value="">Unknown</option>
                {dams.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.cow_tag}{c.name ? ` — ${c.name}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <Textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any additional notes about this animal…"
          />
        </Section>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <Link
            href={`/dashboard/dairy/cows/${cow.id}`}
            className="flex-1 py-3 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || success}
            className="flex-1 py-3 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : success ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
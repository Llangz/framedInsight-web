'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateAnimal } from '../../action'
import { Database } from '@/lib/database.types'

type Animal = Database['public']['Tables']['small_ruminants']['Row']

interface FarmAnimal {
  id: string
  animal_tag: string
  name: string | null
  sex: string
  species: string
}

interface Props {
  animal?: Animal
  initialAnimal?: Animal
  farmAnimals?: FarmAnimal[]
}

// ── Same breed/option lists as the add form ───────────────────────────────────

const GOAT_BREEDS = [
  'Galla', 'Small East African (SEA)', 'Toggenburg', 'Saanen',
  'Alpine', 'Boer', 'Kalahari Red', 'Galla × Toggenburg', 'Crossbred', 'Other',
]
const SHEEP_BREEDS = [
  'Red Maasai', 'Dorper', 'Blackhead Persian', 'Hampshire Down',
  'Merino', 'Corriedale', 'Red Maasai × Dorper', 'Crossbred', 'Other',
]
const UPGRADE_LEVELS = ['Pure', 'F1 (50%)', 'F2 (75%)', 'F3 (87.5%)', 'F4 (93.75%)', 'Grade']

// ── Shared input components (same style as add form) ─────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-sm border border-[#2A2D35] rounded-lg px-3 py-2.5 bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-[#1E222B]"
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full text-sm border border-[#2A2D35] rounded-lg px-3 py-2.5 bg-[#17191F] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
      className="w-full text-sm border border-[#2A2D35] rounded-lg px-3 py-2.5 bg-[#17191F] text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
    />
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4 space-y-3">
      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EditAnimalClient(props: Props) {
  const { farmAnimals = [] } = props
  const animal = props.animal ?? props.initialAnimal!
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(
    // Open advanced section if any advanced fields have data
    !!(animal.sire_id || animal.dam_id || animal.coat_color || animal.ear_notch_pattern || animal.distinguishing_marks)
  )

  const [form, setForm] = useState({
    animal_tag:           animal.animal_tag,
    name:                 animal.name ?? '',
    species:              animal.species as 'goat' | 'sheep',
    breed:                animal.breed ?? '',
    upgrade_level:        animal.upgrade_level ?? '',
    sex:                  animal.sex as 'female' | 'male',
    birth_date:           animal.birth_date,
    birth_weight:         animal.birth_weight?.toString() ?? '',
    status:               animal.status ?? 'active',
    purpose:              animal.purpose ?? 'meat',
    source:               animal.source ?? 'born on farm',
    purchase_price:       animal.purchase_price?.toString() ?? '',
    purchase_date:        animal.purchase_date ?? '',
    breeding_type:        animal.breeding_type ?? 'natural',
    ear_notch_pattern:    animal.ear_notch_pattern ?? '',
    qr_code:              animal.qr_code ?? '',
    coat_color:           animal.coat_color ?? '',
    distinguishing_marks: animal.distinguishing_marks ?? '',
    sire_id:              animal.sire_id ?? '',
    dam_id:               animal.dam_id ?? '',
    exit_date:            animal.exit_date ?? '',
    exit_reason:          animal.exit_reason ?? '',
    exit_value:           animal.exit_value?.toString() ?? '',
    notes:                animal.notes ?? '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const breedOptions = form.species === 'goat' ? GOAT_BREEDS : SHEEP_BREEDS
  const sires = farmAnimals.filter(a => a.sex === 'male')
  const dams  = farmAnimals.filter(a => a.sex === 'female')
  const isExited = form.status === 'sold' || form.status === 'deceased' || form.status === 'culled'

  async function handleSubmit() {
    setError(null)
    if (!form.animal_tag.trim()) { setError('Animal tag is required'); return }
    if (!form.birth_date)        { setError('Birth date is required');  return }

    setSaving(true)
    try {
      const result = await updateAnimal(animal.id, {
        animal_tag:           form.animal_tag.trim().toUpperCase(),
        name:                 form.name.trim() || null,
        species:              form.species,
        breed:                form.breed || null,
        upgrade_level:        form.upgrade_level || null,
        sex:                  form.sex,
        birth_date:           form.birth_date,
        birth_weight:         form.birth_weight ? parseFloat(form.birth_weight) : null,
        status:               form.status,
        purpose:              form.purpose || null,
        source:               form.source || null,
        purchase_price:       form.purchase_price ? parseFloat(form.purchase_price) : null,
        purchase_date:        form.purchase_date || null,
        breeding_type:        form.breeding_type || null,
        ear_notch_pattern:    form.ear_notch_pattern.trim() || null,
        qr_code:              form.qr_code.trim() || null,
        coat_color:           form.coat_color.trim() || null,
        distinguishing_marks: form.distinguishing_marks.trim() || null,
        sire_id:              form.sire_id || null,
        dam_id:               form.dam_id || null,
        exit_date:            form.exit_date || null,
        exit_reason:          form.exit_reason || null,
        exit_value:           form.exit_value ? parseFloat(form.exit_value) : null,
        notes:                form.notes.trim() || null,
      })
      if (!result.success) {
        setError(result.error || 'Failed to save changes')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push(`/dashboard/smallRuminants/animal/${animal.id}`), 700)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const emoji = form.species === 'goat' ? '🐐' : '🐑'
  const displayName = animal.name ?? animal.animal_tag

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      {/* Sticky header */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/smallRuminants/animal/${animal.id}`}
                className="w-8 h-8 rounded-full bg-[#1C1E26] flex items-center justify-center text-[#9CA3AF] hover:bg-[#2A2D35] transition-colors"
              >
                ←
              </Link>
              <div>
                <h1 className="text-lg font-bold text-white leading-none">
                  {emoji} Edit {displayName}
                </h1>
                <p className="text-xs text-[#6B7280] mt-0.5">Tag: {animal.animal_tag}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-medium">
            ✓ Saved — redirecting…
          </div>
        )}

        {/* Species display (read-only — changing species would be a different animal) */}
        <div className="flex gap-2 bg-[#17191F] rounded-xl p-1 border border-[#2A2D35]">
          {(['goat', 'sheep'] as const).map(s => (
            <div
              key={s}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg text-center capitalize ${
                form.species === s
                  ? 'bg-[#2A2D35] text-white shadow-sm'
                  : 'text-[#6B7280]'
              }`}
            >
              {s === 'goat' ? '🐐 Goat' : '🐑 Sheep'}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#4B5563] text-center -mt-2">Species cannot be changed after registration</p>

        {/* Identification */}
        <SectionCard title="Identification">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>Tag / ID number</Label>
              <Input
                value={form.animal_tag}
                onChange={e => set('animal_tag', e.target.value)}
                placeholder="e.g. G001"
              />
            </div>
            <div>
              <Label>Name (optional)</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Mama"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>Sex</Label>
              <Select value={form.sex} onChange={e => set('sex', e.target.value)}>
                <option value="female">♀ Female</option>
                <option value="male">♂ Male</option>
              </Select>
            </div>
            <div>
              <Label required>Birth date</Label>
              <Input
                type="date"
                value={form.birth_date}
                onChange={e => set('birth_date', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Breed</Label>
              <Select value={form.breed} onChange={e => set('breed', e.target.value)}>
                <option value="">Select breed</option>
                {breedOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
            <div>
              <Label>Upgrade level</Label>
              <Select value={form.upgrade_level} onChange={e => set('upgrade_level', e.target.value)}>
                <option value="">Select</option>
                {UPGRADE_LEVELS.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Management */}
        <SectionCard title="Management">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Purpose</Label>
              <Select value={form.purpose} onChange={e => set('purpose', e.target.value)}>
                <option value="meat">Meat</option>
                <option value="dairy">Dairy</option>
                <option value="breeding">Breeding</option>
                <option value="dual">Dual purpose</option>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="deceased">Deceased</option>
                <option value="culled">Culled</option>
              </Select>
            </div>
          </div>

          {/* Exit fields — shown when status is not active */}
          {isExited && (
            <div className="grid grid-cols-2 gap-3 pt-1">
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
                  placeholder="e.g. 12000"
                />
              </div>
              <div className="col-span-2">
                <Label>Exit reason</Label>
                <Select value={form.exit_reason} onChange={e => set('exit_reason', e.target.value)}>
                  <option value="">Select reason</option>
                  {form.status === 'sold' && <option value="sold">Sold</option>}
                  {form.status === 'deceased' && (
                    <>
                      <option value="disease">Disease</option>
                      <option value="accident">Accident</option>
                      <option value="old age">Old age</option>
                      <option value="unknown">Unknown</option>
                    </>
                  )}
                  {form.status === 'culled' && (
                    <>
                      <option value="poor production">Poor production</option>
                      <option value="injury">Injury</option>
                      <option value="old age">Old age</option>
                      <option value="other">Other</option>
                    </>
                  )}
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="born on farm">Born on farm</option>
                <option value="purchased">Purchased</option>
                <option value="donated">Donated</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label>Birth weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 2.5"
                value={form.birth_weight}
                onChange={e => set('birth_weight', e.target.value)}
              />
            </div>
          </div>

          {form.source === 'purchased' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase price (KES)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 8000"
                  value={form.purchase_price}
                  onChange={e => set('purchase_price', e.target.value)}
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

          <div>
            <Label>Breeding type</Label>
            <Select value={form.breeding_type} onChange={e => set('breeding_type', e.target.value)}>
              <option value="natural">Natural service</option>
              <option value="AI">Artificial insemination (AI)</option>
              <option value="unknown">Unknown</option>
            </Select>
          </div>
        </SectionCard>

        {/* Advanced — parentage, physical */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full text-xs font-semibold text-[#6B7280] flex items-center justify-center gap-2 py-2 hover:text-emerald-400 transition-colors"
        >
          {showAdvanced ? '▲ Hide' : '▼ Show'} parentage & physical details
        </button>

        {showAdvanced && (
          <>
            <SectionCard title="Parentage">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sire (father)</Label>
                  <Select value={form.sire_id} onChange={e => set('sire_id', e.target.value)}>
                    <option value="">Unknown / External</option>
                    {sires.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.animal_tag}{a.name ? ` — ${a.name}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Dam (mother)</Label>
                  <Select value={form.dam_id} onChange={e => set('dam_id', e.target.value)}>
                    <option value="">Unknown</option>
                    {dams.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.animal_tag}{a.name ? ` — ${a.name}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Physical Description">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ear notch pattern</Label>
                  <Input
                    placeholder="e.g. R1L2"
                    value={form.ear_notch_pattern}
                    onChange={e => set('ear_notch_pattern', e.target.value)}
                  />
                </div>
                <div>
                  <Label>QR code ID</Label>
                  <Input
                    placeholder="Scan or type QR"
                    value={form.qr_code}
                    onChange={e => set('qr_code', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Coat color</Label>
                <Input
                  placeholder="e.g. Brown and white"
                  value={form.coat_color}
                  onChange={e => set('coat_color', e.target.value)}
                />
              </div>
              <div>
                <Label>Distinguishing marks</Label>
                <Textarea
                  placeholder="e.g. White patch on left ear, broken horn"
                  value={form.distinguishing_marks}
                  onChange={e => set('distinguishing_marks', e.target.value)}
                />
              </div>
            </SectionCard>
          </>
        )}

        {/* Notes */}
        <SectionCard title="Notes">
          <Textarea
            placeholder="Any additional notes about this animal…"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </SectionCard>

        {error && (
          <div className="rounded-xl bg-red-950/40 border border-red-700 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <Link
            href={`/dashboard/smallRuminants/animal/${animal.id}`}
            className="flex-1 py-3 text-sm font-semibold rounded-xl border border-[#2A2D35] text-[#9CA3AF] hover:bg-[#17191F] transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || success}
            className="flex-1 py-3 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : success ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Rabbit, AlertTriangle, Scale, Syringe, Milk, HeartPulse, Banknote } from 'lucide-react'

// ── Exact column names from Supabase schema ───────────────────────────────────

interface Animal {
  id: string
  farm_id: string
  animal_tag: string
  name: string | null
  species: string
  breed: string | null
  upgrade_level: string | null
  sex: string
  birth_date: string
  birth_weight: number | null
  sire_id: string | null
  dam_id: string | null
  breeding_type: string | null
  status: string | null
  purpose: string | null
  source: string | null
  purchase_price: number | null
  purchase_date: string | null
  exit_date: string | null
  exit_reason: string | null
  exit_value: number | null
  coat_color: string | null
  ear_notch_pattern: string | null
  qr_code: string | null
  distinguishing_marks: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface WeightRecord {
  id: string
  animal_id: string
  record_date: string          // NOT weighed_at
  weight_kg: number
  age_days: number | null
  average_daily_gain: number | null
  body_condition_score: number | null
  measurement_type: string | null
  notes: string | null
  created_at: string | null
}

// small_ruminant_health columns
interface HealthRecord {
  id: string
  animal_id: string
  event_date: string       // NOT "date"
  event_type: string       // NOT "type"
  vaccine_type: string | null
  vaccine_name: string | null
  vaccine_batch_number: string | null
  next_vaccination_due: string | null
  disease: string | null
  symptoms: string | null
  treatment: string | null
  drug_name: string | null
  dosage: string | null
  vet_name: string | null
  vet_contact: string | null
  withdrawal_days: number | null
  safe_consumption_date: string | null
  cost: number | null
  notes: string | null
  created_at: string | null
}

// small_ruminant_breeding columns
interface BreedingRecord {
  id: string
  dam_id: string           // foreign key — the female animal
  service_date: string     // NOT "date"
  service_type: string | null  // NOT "type"
  heat_date: string | null
  sire_id: string | null
  sire_breed: string | null
  sire_tag: string | null
  pregnancy_check_date: string | null
  pregnancy_result: string | null
  expected_delivery_date: string | null
  actual_delivery_date: string | null
  number_of_offspring: number | null
  offspring_ids: string[] | null
  delivery_type: string | null
  complications: string | null
  notes: string | null
  created_at: string | null
}

// goat_milk_records columns
interface MilkRecord {
  id: string
  animal_id: string
  record_date: string
  morning_milk: number | null
  midday_milk: number | null
  evening_milk: number | null
  total_milk: number | null
  lactation_number: number | null
  days_in_milk: number | null
  milk_quality: string | null
  notes: string | null
  created_at: string | null
}

interface Props {
  animal: Animal
  weights: WeightRecord[]
  healthRecords: HealthRecord[]
  breedingRecords: BreedingRecord[]
  milkRecords: MilkRecord[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months}mo`
  if (months === 0) return `${years}yr`
  return `${years}yr ${months}mo`
}

function statusBadge(status: string | null) {
  switch (status) {
    case 'active':   return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'sold':     return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'deceased': return 'bg-red-500/10 text-red-400 border-red-500/20'
    case 'culled':   return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    default:         return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
  }
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-KE')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnimalDetailClient({ animal, weights, healthRecords, breedingRecords, milkRecords }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)

  const displayName = animal.name ?? animal.animal_tag
  const latestWeight = weights[0] ?? null
  const isDairy = animal.species === 'goat' && (animal.purpose === 'dairy' || animal.purpose === 'dual')

  async function handleDelete() {
    if (!confirm(`Delete ${displayName}? This cannot be undone.`)) return
    setDeleting(true)
    const { error } = await supabase.from('small_ruminants').delete().eq('id', animal.id)
    if (error) {
      alert('Failed to delete: ' + error.message)
      setDeleting(false)
      return
    }
    router.push('/dashboard/smallRuminants')
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/dashboard/smallRuminants" className="text-neutral-400 hover:text-white transition-colors text-sm">
              ← Back
            </Link>
            <div className="h-5 w-px bg-neutral-700" />
            <span className="text-2xl"><Rabbit size={22} /></span>
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="text-neutral-400 text-sm">Tag: {animal.animal_tag}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border capitalize ${statusBadge(animal.status)}`}>
              {animal.status ?? 'unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/dashboard/smallRuminants/animal/${animal.id}/edit`}
              className="text-xs px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded-lg transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-2 bg-red-950/50 hover:bg-red-900/50 text-red-400 border border-red-900/30 rounded-lg transition-colors disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Incomplete profile banner */}
        {(!animal.breed || !animal.name || !animal.purpose || !animal.source) && (
          <div className="bg-amber-950 border border-amber-800 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-amber-400 flex-shrink-0 mt-0.5"><AlertTriangle size={16} /></span>
              <div>
                <p className="text-amber-300 text-sm font-bold">Profile incomplete</p>
                <p className="text-amber-400/80 text-xs mt-0.5">
                  {[
                    !animal.name && 'name',
                    !animal.breed && 'breed',
                    !animal.purpose && 'purpose',
                    !animal.source && 'source',
                  ].filter(Boolean).join(', ')} missing — complete this for accurate weight gain tracking and flock records.
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/smallRuminants/animal/${animal.id}/edit`}
              className="flex-shrink-0 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            >
              Complete profile
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Basic info */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Animal Info</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                {[
                  ['Species',       animal.species],
                  ['Breed',         animal.breed ?? '—'],
                  ['Sex',           animal.sex],
                  ['Age',           calculateAge(animal.birth_date)],
                  ['Birth Date',    fmt(animal.birth_date)],
                  ['Birth Weight',  animal.birth_weight ? `${animal.birth_weight} kg` : '—'],
                  ['Purpose',       animal.purpose ?? '—'],
                  ['Upgrade Level', animal.upgrade_level ?? '—'],
                  ['Breeding Type', animal.breeding_type ?? '—'],
                  ['Coat Color',    animal.coat_color ?? '—'],
                  ['Ear Notch',     animal.ear_notch_pattern ?? '—'],
                  ['Source',        animal.source ?? '—'],
                  ['Marks',         animal.distinguishing_marks ?? '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-neutral-500">{label}</p>
                    <p className="text-sm font-medium text-white capitalize">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Purchase / exit */}
            {(animal.purchase_date || animal.purchase_price || animal.exit_date) && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Purchase / Exit</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                  {animal.purchase_date && <div><p className="text-xs text-neutral-500">Purchased</p><p className="text-sm font-medium">{fmt(animal.purchase_date)}</p></div>}
                  {animal.purchase_price != null && <div><p className="text-xs text-neutral-500">Price Paid</p><p className="text-sm font-medium">KES {animal.purchase_price.toLocaleString()}</p></div>}
                  {animal.exit_date && <div><p className="text-xs text-neutral-500">Exit Date</p><p className="text-sm font-medium">{fmt(animal.exit_date)}</p></div>}
                  {animal.exit_reason && <div><p className="text-xs text-neutral-500">Exit Reason</p><p className="text-sm font-medium capitalize">{animal.exit_reason}</p></div>}
                  {animal.exit_value != null && <div><p className="text-xs text-neutral-500">Exit Value</p><p className="text-sm font-medium">KES {animal.exit_value.toLocaleString()}</p></div>}
                </div>
              </div>
            )}

            {/* Weight history */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Weight History</h2>
                <Link href={`/dashboard/smallRuminants/weights/add?animal=${animal.id}`} className="text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors">
                  + Record
                </Link>
              </div>
              {weights.length === 0 ? (
                <p className="text-sm text-neutral-500">No weight records yet.</p>
              ) : (
                <div className="space-y-2">
                  {weights.map((w, i) => (
                    <div key={w.id} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{w.weight_kg} kg</span>
                        {i === 0 && <span className="text-[10px] text-emerald-400 border border-emerald-800/60 rounded-full px-1.5 py-0.5">Latest</span>}
                        {w.notes && <span className="text-xs text-neutral-500">{w.notes}</span>}
                      </div>
                      <span className="text-xs text-neutral-500">{fmt(w.record_date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Health records — uses event_date, event_type */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Health Records</h2>
                <Link href={`/dashboard/smallRuminants/health/add?animal=${animal.id}`} className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors">
                  + Add
                </Link>
              </div>
              {healthRecords.length === 0 ? (
                <p className="text-sm text-neutral-500">No health records yet.</p>
              ) : (
                <div className="space-y-3">
                  {healthRecords.map(h => (
                    <div key={h.id} className="py-2 border-b border-neutral-800 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{h.event_type}</span>
                        <span className="text-xs text-neutral-500">{fmt(h.event_date)}</span>
                      </div>
                      {h.disease && <p className="text-xs text-neutral-400 mt-0.5">Disease: {h.disease}</p>}
                      {h.treatment && <p className="text-xs text-neutral-400">Treatment: {h.treatment}</p>}
                      {h.drug_name && <p className="text-xs text-neutral-400">Drug: {h.drug_name}{h.dosage ? ` · ${h.dosage}` : ''}</p>}
                      {h.vaccine_name && (
                        <p className="text-xs text-neutral-400">
                          Vaccine: {h.vaccine_name}{h.vaccine_batch_number ? ` · Batch: ${h.vaccine_batch_number}` : ''}
                        </p>
                      )}
                      {h.next_vaccination_due && <p className="text-xs text-amber-500/80">Next due: {fmt(h.next_vaccination_due)}</p>}
                      {(h.vet_name || h.cost != null) && (
                        <p className="text-xs text-neutral-500 mt-1">
                          {h.vet_name && `Vet: ${h.vet_name}`}
                          {h.vet_name && h.cost != null && ' · '}
                          {h.cost != null && `KES ${h.cost.toLocaleString()}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Breeding records — females only, uses dam_id / service_date / service_type */}
            {animal.sex === 'female' && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Breeding Records</h2>
                  <Link href={`/dashboard/smallRuminants/breeding/service?animal=${animal.id}`} className="text-xs px-3 py-1.5 bg-pink-700 hover:bg-pink-600 text-white rounded-lg transition-colors">
                    + Record
                  </Link>
                </div>
                {breedingRecords.length === 0 ? (
                  <p className="text-sm text-neutral-500">No breeding records yet.</p>
                ) : (
                  <div className="space-y-3">
                    {breedingRecords.map(b => (
                      <div key={b.id} className="py-2 border-b border-neutral-800 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{b.service_type ?? 'Service'}</span>
                          <span className="text-xs text-neutral-500">{fmt(b.service_date)}</span>
                        </div>
                        {b.sire_tag && <p className="text-xs text-neutral-400 mt-0.5">Sire: {b.sire_tag}{b.sire_breed ? ` (${b.sire_breed})` : ''}</p>}
                        {b.pregnancy_result && <p className="text-xs text-neutral-400 capitalize">Pregnancy: {b.pregnancy_result}</p>}
                        {b.expected_delivery_date && <p className="text-xs text-amber-500/80">Expected delivery: {fmt(b.expected_delivery_date)}</p>}
                        {b.actual_delivery_date && (
                          <p className="text-xs text-green-400">
                            Delivered: {fmt(b.actual_delivery_date)}
                            {b.number_of_offspring != null && ` · ${b.number_of_offspring} offspring`}
                          </p>
                        )}
                        {b.complications && <p className="text-xs text-red-400">Complications: {b.complications}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Milk records — goats only */}
            {isDairy && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Milk Records</h2>
                  <Link href={`/dashboard/smallRuminants/milk/add?animal=${animal.id}`} className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors">
                    + Record
                  </Link>
                </div>
                {milkRecords.length === 0 ? (
                  <p className="text-sm text-neutral-500">No milk records yet.</p>
                ) : (
                  <div className="space-y-2">
                    {milkRecords.map((m, i) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
                        <div>
                          <span className="text-sm font-semibold">{m.total_milk ?? '—'} L</span>
                          {i === 0 && <span className="ml-2 text-[10px] text-blue-400 border border-blue-800/60 rounded-full px-1.5 py-0.5">Latest</span>}
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {[
                              m.morning_milk != null && `AM: ${m.morning_milk}L`,
                              m.midday_milk != null && `Mid: ${m.midday_milk}L`,
                              m.evening_milk != null && `PM: ${m.evening_milk}L`,
                            ].filter(Boolean).join(' · ')}
                          </p>
                          {m.milk_quality && <p className="text-xs text-neutral-500 capitalize">Quality: {m.milk_quality}</p>}
                        </div>
                        <span className="text-xs text-neutral-500">{fmt(m.record_date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">

            {/* Summary stats */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Stats</h2>
              <div>
                <p className="text-xs text-neutral-500">Latest Weight</p>
                <p className="text-3xl font-bold">{latestWeight ? `${latestWeight.weight_kg} kg` : '—'}</p>
                {latestWeight && <p className="text-xs text-neutral-500 mt-0.5">{fmt(latestWeight.record_date)}</p>}
              </div>
              <div>
                <p className="text-xs text-neutral-500">Age</p>
                <p className="text-xl font-semibold">{calculateAge(animal.birth_date)}</p>
              </div>
              {isDairy && milkRecords[0] && (
                <div>
                  <p className="text-xs text-neutral-500">Last Milk</p>
                  <p className="text-xl font-semibold">{milkRecords[0].total_milk ?? '—'} L</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{fmt(milkRecords[0].record_date)}</p>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Quick Actions</h2>
              <div className="space-y-2">
                <Link href={`/dashboard/smallRuminants/weights/add?animal=${animal.id}`} className="flex items-center gap-2 w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition-colors">
                  <Scale size={15} /> <span>Record Weight</span>
                </Link>
                <Link href={`/dashboard/smallRuminants/health/add?animal=${animal.id}`} className="flex items-center gap-2 w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition-colors">
                  <Syringe size={15} /> <span>Health Record</span>
                </Link>
                {isDairy && (
                  <Link href={`/dashboard/smallRuminants/milk/add?animal=${animal.id}`} className="flex items-center gap-2 w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition-colors">
                    <Milk size={15} /> <span>Record Milk</span>
                  </Link>
                )}
                {animal.sex === 'female' && (
                  <Link href={`/dashboard/smallRuminants/breeding/service?animal=${animal.id}`} className="flex items-center gap-2 w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition-colors">
                    <HeartPulse size={15} /> <span>Record Breeding</span>
                  </Link>
                )}
                <Link href={`/dashboard/smallRuminants/sales/add?animal=${animal.id}`} className="flex items-center gap-2 w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition-colors">
                  <Banknote size={15} /> <span>Record Sale</span>
                </Link>
              </div>
            </div>

            {/* Record meta */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
              <p className="text-xs text-neutral-600">Added {animal.created_at ? fmt(animal.created_at) : '—'}</p>
              {animal.updated_at && animal.updated_at !== animal.created_at && (
                <p className="text-xs text-neutral-600 mt-1">Updated {fmt(animal.updated_at)}</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
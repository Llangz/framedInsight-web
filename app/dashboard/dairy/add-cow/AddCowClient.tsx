'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addCow } from './actions'
import { queueDairyEvent } from '@/lib/offline-db'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Hash,
  CalendarDays,
  Banknote,
  ShoppingCart,
} from 'lucide-react'

const BREEDS = [
  'Holstein Friesian (HF)',
  'Jersey',
  'Guernsey',
  'Ayrshire',
  'Sahiwal',
  'Boran',
  'Crossbreed',
  'Other',
]

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-[#D1D5DB]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle size={11} /> {error}
        </p>
      )}
      {hint && !error && <p className="text-[11px] text-[#4B5563]">{hint}</p>}
    </div>
  )
}

const inputCls = (hasError?: boolean) =>
  `w-full px-3 py-2 text-sm rounded-md border bg-[#17191F] text-white placeholder-[#4B5563] focus:outline-none focus:ring-1 transition-colors ${
    hasError
      ? 'border-red-800 focus:ring-red-700'
      : 'border-[#2A2D35] focus:ring-emerald-700 focus:border-emerald-700'
  }`

export default function AddCowClient({ farmId }: { farmId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    animal_id: '',
    tag_number: '',
    breed: '',
    date_of_birth: '',
    status: 'active',
    source: 'born on farm',
    purchase_date: '',
    purchase_price: '',
  })

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    setFieldErrors(prev => ({ ...prev, [key]: '' }))
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.animal_id.trim() && !form.tag_number.trim()) {
      errs.animal_id = 'Name or tag number is required'
    }
    if (!form.breed) errs.breed = 'Select a breed'
    if (!form.date_of_birth) {
      errs.date_of_birth = 'Date of birth is required'
    } else if (new Date(form.date_of_birth) > new Date()) {
      errs.date_of_birth = 'Cannot be in the future'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // cows' real live columns are cow_tag / birth_date / name — not the
  // animal_id / date_of_birth field names this form collects. addCow()'s
  // server action does this remapping before insert; the offline queue
  // insert bypasses that action entirely, so it must be remapped here too
  // (same discipline as every other offline-queued form in the app).
  function toCowInsert() {
    return {
      cow_tag: (form.tag_number || form.animal_id).trim(),
      breed: form.breed || null,
      birth_date: form.date_of_birth || null,
      source: form.source || null,
      purchase_date: form.source === 'purchased' ? form.purchase_date || null : null,
      purchase_price:
        form.source === 'purchased' && form.purchase_price
          ? parseFloat(form.purchase_price)
          : null,
      status: form.status || 'active',
      name: form.animal_id || null,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setError('')

    // OFFLINE FALLBACK: addCow() is a server action — a plain fetch under
    // the hood — so calling it with no connection just throws a raw
    // "Failed to fetch" that setError() would show verbatim to the farmer.
    // Queue it locally instead, same as every dairy/poultry record form
    // already does, so this reads as "saved offline" instead of "broken."
    if (!navigator.onLine) {
      try {
        await queueDairyEvent({
          eventId: crypto.randomUUID(),
          entityType: 'cow_registration',
          farmId,
          payload: toCowInsert(),
        })
        setSuccess(true)
        setSavedOffline(true)
        setTimeout(() => router.push('/dashboard/dairy/herd'), 1500)
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const result = await addCow(form)
      if (!result.success) {
        setError(result.error || 'Failed to add cow')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/dairy/herd'), 1500)
    } catch (err: any) {
      // A submit that started online but lost connection mid-request lands
      // here too — fall back to the same offline queue rather than showing
      // a raw network error.
      if (!navigator.onLine) {
        try {
          await queueDairyEvent({
            eventId: crypto.randomUUID(),
            entityType: 'cow_registration',
            farmId,
            payload: toCowInsert(),
          })
          setSuccess(true)
          setSavedOffline(true)
          setTimeout(() => router.push('/dashboard/dairy/herd'), 1500)
          return
        } catch (queueErr: any) {
          setError(queueErr.message || 'Could not save offline')
          return
        }
      }
      setError(err.message || 'Failed to add cow')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/dairy/herd"
            className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={13} /> Back to herd
          </Link>
          <h1 className="text-xl font-semibold text-white tracking-tight">Add animal</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Register a new cow in your herd</p>
        </div>

        {/* Success */}
        {success && (
          <div className="flex items-center gap-2 p-3 mb-6 rounded-md border border-emerald-800/50 bg-emerald-950/30">
            <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              {savedOffline ? 'Saved offline — will sync when connected.' : 'Cow added successfully. Redirecting…'}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 mb-6 rounded-md border border-red-800/50 bg-red-950/20">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Identity */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Tag size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Identity</h2>
            </div>

            <Field label="Animal name" error={fieldErrors.animal_id}>
              <input
                type="text"
                value={form.animal_id}
                onChange={set('animal_id')}
                placeholder="e.g. Wanjiru, Mwende"
                className={inputCls(!!fieldErrors.animal_id)}
                style={{ WebkitTextFillColor: 'white', color: 'white' }}
              />
            </Field>

            <Field label="Tag number" hint="Leave blank if not tagged yet">
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                <input
                  type="text"
                  value={form.tag_number}
                  onChange={set('tag_number')}
                  placeholder="e.g. TAG-001"
                  className={`${inputCls()} pl-8`}
                  style={{ WebkitTextFillColor: 'white', color: 'white' }}
                />
              </div>
            </Field>

            <Field label="Breed" required error={fieldErrors.breed}>
              <select
                value={form.breed}
                onChange={set('breed')}
                className={inputCls(!!fieldErrors.breed)}
                style={{ WebkitTextFillColor: 'white', color: 'white' }}
              >
                <option value="">Select breed</option>
                {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of birth" required error={fieldErrors.date_of_birth}>
                <div className="relative">
                  <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={set('date_of_birth')}
                    max={new Date().toISOString().split('T')[0]}
                    className={`${inputCls(!!fieldErrors.date_of_birth)} pl-8`}
                    style={{ WebkitTextFillColor: 'white', color: 'white' }}
                  />
                </div>
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={set('status')}
                  className={inputCls()}
                  style={{ WebkitTextFillColor: 'white', color: 'white' }}
                >
                  <option value="active">Active</option>
                  <option value="dry">Dry</option>
                  <option value="heifer">Heifer</option>
                  <option value="sold">Sold</option>
                  <option value="deceased">Deceased</option>
                </select>
              </Field>

              <Field label="Source">
                <select
                  value={form.source}
                  onChange={set('source')}
                  className={inputCls()}
                  style={{ WebkitTextFillColor: 'white', color: 'white' }}
                >
                  <option value="born on farm">Born on farm</option>
                  <option value="purchased">Purchased</option>
                  <option value="donated">Donated</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Purchase — only relevant when the cow was bought, not born on farm */}
          {form.source === 'purchased' && (
            <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart size={13} className="text-[#6B7280]" />
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Purchase</h2>
                <span className="text-[10px] text-[#4B5563] ml-1">(optional)</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Purchase date">
                  <div className="relative">
                    <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                    <input
                      type="date"
                      value={form.purchase_date}
                      onChange={set('purchase_date')}
                      max={new Date().toISOString().split('T')[0]}
                      className={`${inputCls()} pl-8`}
                      style={{ WebkitTextFillColor: 'white', color: 'white' }}
                    />
                  </div>
                </Field>

                <Field label="Price (KES)">
                  <div className="relative">
                    <Banknote size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                    <input
                      type="number"
                      value={form.purchase_price}
                      onChange={set('purchase_price')}
                      placeholder="50,000"
                      min="0"
                      step="500"
                      className={`${inputCls()} pl-8`}
                      style={{ WebkitTextFillColor: 'white', color: 'white' }}
                    />
                  </div>
                </Field>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Adding…' : 'Add to herd'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-[#9CA3AF] hover:text-white border border-[#2A2D35] hover:border-[#3A3D45] rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
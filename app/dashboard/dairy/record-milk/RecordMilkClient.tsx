'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordMilk } from './actions'
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  Droplets, CalendarDays, ClipboardList,
} from 'lucide-react'

interface Cow { id: string; cow_tag: string }

const inputCls = (err?: boolean) =>
  `w-full px-3 py-2 text-sm rounded-md border bg-[#17191F] text-white placeholder-[#4B5563] focus:outline-none focus:ring-1 transition-colors ${
    err ? 'border-red-800 focus:ring-red-700' : 'border-[#2A2D35] focus:ring-emerald-700 focus:border-emerald-700'
  }`

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-[#D1D5DB]">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function RecordMilkClient({ initialCows }: { initialCows: Cow[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    cow_id: '',
    record_date: new Date().toISOString().split('T')[0],
    morning_milk: '',
    evening_milk: '',
    milk_quality: '',
    lactation_number: '',
    notes: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const morning = parseFloat(form.morning_milk) || 0
  const evening = parseFloat(form.evening_milk) || 0
  const total = morning + evening

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await recordMilk(form)
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/dairy'), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to record milk')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-xl mx-auto px-6 py-10">

        <div className="mb-8">
          <Link href="/dashboard/dairy" className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors mb-4">
            <ArrowLeft size={13} /> Back to dairy
          </Link>
          <h1 className="text-xl font-semibold text-white tracking-tight">Record milk</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Log daily production for an animal</p>
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 mb-6 rounded-md border border-emerald-800/50 bg-emerald-950/30">
            <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">Milk recorded. Redirecting…</p>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 p-3 mb-6 rounded-md border border-red-800/50 bg-red-950/20">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Animal & Date */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Record</h2>
            </div>

            <Field label="Animal" required>
              <select value={form.cow_id} onChange={set('cow_id')} required className={inputCls()}
                style={{ WebkitTextFillColor: 'white', color: 'white' }}>
                <option value="">Select animal</option>
                {initialCows.map(c => <option key={c.id} value={c.id}>{c.cow_tag}</option>)}
              </select>
            </Field>

            <Field label="Date" required>
              <div className="relative">
                <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                <input type="date" value={form.record_date} onChange={set('record_date')}
                  max={new Date().toISOString().split('T')[0]}
                  required className={`${inputCls()} pl-8`}
                  style={{ WebkitTextFillColor: 'white', color: 'white' }} />
              </div>
            </Field>
          </section>

          {/* Milk volumes */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Droplets size={13} className="text-[#6B7280]" />
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Volume (litres)</h2>
              </div>
              {total > 0 && (
                <span className="text-xs font-semibold text-emerald-400">{total.toFixed(1)}L total</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Morning">
                <input type="number" value={form.morning_milk} onChange={set('morning_milk')}
                  placeholder="0.0" min="0" step="0.1"
                  className={inputCls()} style={{ WebkitTextFillColor: 'white', color: 'white' }} />
              </Field>
              <Field label="Evening">
                <input type="number" value={form.evening_milk} onChange={set('evening_milk')}
                  placeholder="0.0" min="0" step="0.1"
                  className={inputCls()} style={{ WebkitTextFillColor: 'white', color: 'white' }} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Quality">
                <select value={form.milk_quality} onChange={set('milk_quality')}
                  className={inputCls()} style={{ WebkitTextFillColor: 'white', color: 'white' }}>
                  <option value="">Select</option>
                  <option value="A">Grade A</option>
                  <option value="B">Grade B</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
              <Field label="Lactation #">
                <input type="number" value={form.lactation_number} onChange={set('lactation_number')}
                  placeholder="e.g. 3" min="1"
                  className={inputCls()} style={{ WebkitTextFillColor: 'white', color: 'white' }} />
              </Field>
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5">
            <Field label="Notes">
              <textarea value={form.notes} onChange={set('notes')}
                placeholder="Any observations…"
                rows={3}
                className={`${inputCls()} resize-none`}
                style={{ WebkitTextFillColor: 'white', color: 'white' }} />
            </Field>
          </section>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading || success}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md disabled:opacity-50 transition-colors">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Saving…' : 'Save record'}
            </button>
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-[#9CA3AF] hover:text-white border border-[#2A2D35] hover:border-[#3A3D45] rounded-md transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
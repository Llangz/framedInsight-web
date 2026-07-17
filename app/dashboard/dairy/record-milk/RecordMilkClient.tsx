'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordMilk } from './actions'
import { queueDairyEvent } from '@/lib/offline-db'
import { ArrowLeft, Milk, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Cow {
  id: string
  cow_tag: string
}

interface Props {
  farmId: string
  initialCows: Cow[]
}

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-bold text-[#D1D5DB] mb-1'

export default function RecordMilkClient({ farmId, initialCows }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    cow_id: initialCows[0]?.id || '',
    record_date: new Date().toISOString().split('T')[0],
    morning_milk: '',
    evening_milk: '',
    milk_quality: '',
    lactation_number: '',
    notes: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const totalMilk = useMemo(() => {
    const morning = parseFloat(form.morning_milk || '0') || 0
    const evening = parseFloat(form.evening_milk || '0') || 0
    return morning + evening
  }, [form.morning_milk, form.evening_milk])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.cow_id) {
      setError('Select a cow')
      return
    }
    if (!form.morning_milk && !form.evening_milk) {
      setError('Enter at least a morning or evening reading')
      return
    }

    setLoading(true)

    const payload = {
      cow_id: form.cow_id,
      record_date: form.record_date,
      morning_milk: form.morning_milk || null,
      evening_milk: form.evening_milk || null,
      milk_quality: form.milk_quality || null,
      lactation_number: form.lactation_number || null,
      notes: form.notes || null,
    }

    // Offline-first support
    if (!navigator.onLine) {
      try {
        await queueDairyEvent({
          eventId: crypto.randomUUID(),
          entityType: 'milk_record',
          farmId,
          referenceId: form.cow_id,
          payload,
        })

        setSuccess('Saved offline — will sync when connected.')
        setForm(f => ({
          ...f,
          morning_milk: '',
          evening_milk: '',
          notes: '',
        }))
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
      } finally {
        setLoading(false)
        setTimeout(() => setSuccess(''), 4000)
      }
      return
    }

    try {
      const result = await recordMilk(payload)
      if (!result.success) {
        setError(result.error || 'Failed to save milk record')
        return
      }
      setSuccess('Milk record saved!')
      setForm(f => ({
        ...f,
        morning_milk: '',
        evening_milk: '',
        notes: '',
      }))
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to save milk record')
    } finally {
      setLoading(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/dairy" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">Record Milk</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Morning and evening collection</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30">
            <AlertCircle size={14} className="text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
            <CheckCircle2 size={14} className="text-emerald-400" />
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
                <label className={LABEL}>Cow *</label>
                <select className={FIELD} value={form.cow_id} onChange={e => set('cow_id', e.target.value)}>
                  {initialCows.map(c => (
                    <option key={c.id} value={c.id}>{c.cow_tag}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Date *</label>
                <input type="date" className={FIELD} value={form.record_date} onChange={e => set('record_date', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Morning milk (litres)</label>
                <input type="number" step="0.1" min="0" className={FIELD} placeholder="e.g. 12.5"
                  value={form.morning_milk} onChange={e => set('morning_milk', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Evening milk (litres)</label>
                <input type="number" step="0.1" min="0" className={FIELD} placeholder="e.g. 9.0"
                  value={form.evening_milk} onChange={e => set('evening_milk', e.target.value)} />
              </div>
            </div>

            {totalMilk > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20">
                <Milk size={14} className="text-emerald-400" />
                <p className="text-sm text-white">Total: <span className="font-semibold">{totalMilk.toFixed(1)} litres</span></p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Milk quality</label>
                <select className={FIELD} value={form.milk_quality} onChange={e => set('milk_quality', e.target.value)}>
                  <option value="">— Not assessed —</option>
                  <option value="normal">Normal</option>
                  <option value="watery">Watery</option>
                  <option value="clotted">Clotted</option>
                  <option value="bloody">Bloody</option>
                  <option value="off_color">Off-color / off-smell</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Lactation number</label>
                <input type="number" min="0" className={FIELD} placeholder="e.g. 2"
                  value={form.lactation_number} onChange={e => set('lactation_number', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={LABEL}>Notes (optional)</label>
              <input className={FIELD} placeholder="e.g. Reduced feed, mastitis check…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
              {loading ? 'Saving…' : 'Save milk record'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
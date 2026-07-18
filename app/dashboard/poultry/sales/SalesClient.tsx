// 📁 FILE PATH: app/dashboard/poultry/sales/SalesClient.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { queuePoultryEvent } from '@/lib/offline-db'
import { ShoppingCart, ArrowLeft, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react'

interface Batch { id: string; batch_name: string; bird_type: string; current_count: number }
interface Sale {
  id: string; batch_id: string; sale_date: string; sale_type: string
  quantity: number; unit: string; price_per_unit: number; total_price: number
  buyer_name?: string; buyer_contact?: string; payment_method?: string
  market?: string; notes?: string
  poultry_batches?: { batch_name: string; bird_type: string }
}
interface Props { farmId: string; initialBatches: Batch[]; initialSales: Sale[] }

const SALE_TYPES = [
  { value: 'eggs',          label: 'Eggs',           unit: 'trays',  hint: 'Per tray (30 eggs). Retail: KES 350–450, wholesale KES 280–350' },
  { value: 'eggs_loose',    label: 'Eggs (loose)',   unit: 'pieces', hint: 'Per piece. Retail KES 15–20' },
  { value: 'live_birds',    label: 'Live birds',     unit: 'birds',  hint: 'Per bird. Kienyeji: KES 700–1,200. Broiler: KES 450–600' },
  { value: 'dressed',       label: 'Dressed carcass',unit: 'kg',     hint: 'Per kg. KES 350–500 local, 500+ supermarket' },
  { value: 'day_old_chicks',label: 'DOC / chicks',   unit: 'chicks', hint: 'Day-old chicks. KES 80–150 per chick' },
  { value: 'manure',        label: 'Poultry manure', unit: 'bags',   hint: 'Per 50kg bag. KES 200–400' },
]

const MARKETS = [
  'Farm gate', 'Local market', 'Supermarket', 'Hotel / restaurant',
  'Wholesale trader', 'Cooperative', 'Online order', 'Other',
]

const PAYMENT = ['Cash', 'M-Pesa', 'Bank transfer', 'Credit', 'Other']

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-bold text-[#D1D5DB] mb-1'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SalesClient({ farmId, initialBatches, initialSales }: Props) {
  const supabase = createClient()
  const [sales, setSales]     = useState(initialSales)
  const [tab, setTab]         = useState<'record' | 'history'>('record')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    batch_id:       initialBatches[0]?.id || '',
    sale_date:      new Date().toISOString().split('T')[0],
    sale_type:      'eggs',
    quantity:       '',
    price_per_unit: '',
    buyer_name:     '',
    buyer_contact:  '',
    payment_method: 'Cash',
    market:         '',
    notes:          '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const selectedType = SALE_TYPES.find(t => t.value === form.sale_type)
  const totalPrice = form.quantity && form.price_per_unit
    ? (parseFloat(form.quantity) * parseFloat(form.price_per_unit)).toFixed(0)
    : ''

  // Revenue summary
  const totalRevenue   = useMemo(() => sales.reduce((s, r) => s + r.total_price, 0), [sales])
  const eggRevenue     = useMemo(() => sales.filter(s => s.sale_type.startsWith('eggs')).reduce((s, r) => s + r.total_price, 0), [sales])
  const birdRevenue    = useMemo(() => sales.filter(s => ['live_birds', 'dressed'].includes(s.sale_type)).reduce((s, r) => s + r.total_price, 0), [sales])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.batch_id || !form.quantity || !form.price_per_unit) {
      setError('Fill in batch, quantity and price'); return
    }
    setLoading(true)

    const qty  = parseFloat(form.quantity)
    const ppu  = parseFloat(form.price_per_unit)

    if (!qty || qty <= 0) { setError('Quantity must be greater than 0'); setLoading(false); return }

    const salePayload = {
      id:             crypto.randomUUID(),
      farm_id:        farmId,
      batch_id:       form.batch_id,
      sale_date:      form.sale_date,
      sale_type:      form.sale_type,
      quantity:       qty,
      unit:           selectedType?.unit || 'units',
      price_per_unit: ppu,
      total_price:    qty * ppu,
      buyer_name:     form.buyer_name || null,
      buyer_contact:  form.buyer_contact || null,
      payment_method: form.payment_method,
      // BUG FIX: poultry_sales_payment_status_check requires 'paid' |
      // 'pending' | 'partial'. This column has a DB default of 'paid'
      // (confirmed), so omitting it didn't block saves — but it meant
      // every Credit sale was silently marked as already paid, which is
      // wrong for a deferred-payment sale. Missing from
      // lib/database.types.ts too (stale for this table, same dashboard-
      // schema-drift as coffee_activities). There's no dedicated UI for
      // this yet, so it's derived from payment_method: 'Credit' implies
      // not yet paid, everything else defaults to paid at point of sale.
      payment_status: form.payment_method === 'Credit' ? 'pending' : 'paid',
      market:         form.market || null,
      notes:          form.notes || null,
    }

    if (!navigator.onLine) {
      await queuePoultryEvent({
        eventId:    crypto.randomUUID(),
        entityType: 'poultry_sale',
        farmId,
        batchId:    form.batch_id,
        payload:    salePayload,
      })
      setSuccess('Saved offline — will sync when connected.')
      setForm(f => ({ ...f, quantity: '', price_per_unit: '', buyer_name: '', buyer_contact: '', market: '', notes: '' }))
      setLoading(false)
      setTimeout(() => setSuccess(''), 4000)
      return
    }

    const { data, error: err } = await (supabase as any)
      .from('poultry_sales')
      .insert(salePayload)
      .select('*, poultry_batches(batch_name, bird_type)')

    // If live birds sold, reduce batch count
    if (!err && (form.sale_type === 'live_birds' || form.sale_type === 'dressed')) {
      const batch = initialBatches.find(b => b.id === form.batch_id)
      if (batch && form.sale_type === 'live_birds') {
        await (supabase as any)
          .from('poultry_batches')
          .update({ current_count: Math.max(0, batch.current_count - Math.floor(qty)) })
          .eq('id', form.batch_id)
      }
    }

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(`Sale recorded – KES ${(parseFloat(form.quantity) * parseFloat(form.price_per_unit)).toLocaleString()}`)
    if (data) setSales(prev => [...(data as any[] || []), ...prev].sort((a: any, b: any) => b.sale_date.localeCompare(a.sale_date)))
    setForm(f => ({ ...f, quantity: '', price_per_unit: '', buyer_name: '', buyer_contact: '', notes: '' }))
    setTimeout(() => setSuccess(''), 4000)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Sales</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Eggs, live birds, dressed carcass, chicks, manure</p>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total revenue (3mo)', value: `KES ${totalRevenue.toLocaleString()}`,   sub: 'all products'  },
          { label: 'Egg revenue',         value: `KES ${eggRevenue.toLocaleString()}`,     sub: 'eggs only'     },
          { label: 'Bird revenue',        value: `KES ${birdRevenue.toLocaleString()}`,    sub: 'live + dressed' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-3">
            <p className="text-base font-semibold text-white truncate">{value}</p>
            <p className="text-[11px] text-[#6B7280]">{label}</p>
            <p className="text-[10px] text-[#4B5563]">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2A2D35] mb-6">
        {(['record', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-emerald-500 text-white' : 'border-transparent text-[#6B7280] hover:text-white'
            }`}>
            {t === 'record' ? 'Record sale' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'record' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error   && <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/30"><AlertCircle size={14} className="text-red-400" /><p className="text-sm text-red-300">{error}</p></div>}
          {success && <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30"><CheckCircle2 size={14} className="text-emerald-400" /><p className="text-sm text-emerald-300">{success}</p></div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Batch *</label>
              <select className={FIELD} value={form.batch_id} onChange={e => set('batch_id', e.target.value)}>
                {initialBatches.map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <input type="date" className={FIELD} value={form.sale_date} onChange={e => set('sale_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Sale type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SALE_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => set('sale_type', t.value)}
                  className={`text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                    form.sale_type === t.value
                      ? 'border-emerald-600/60 bg-emerald-950/30 text-white'
                      : 'border-[#2A2D35] bg-[#0A0C10] text-[#9CA3AF] hover:border-[#3A3D45]'
                  }`}>
                  <p className="font-medium">{t.label}</p>
                  <p className="text-[10px] text-[#4B5563] mt-0.5">{t.unit}</p>
                </button>
              ))}
            </div>
            {selectedType && (
              <p className="text-[11px] text-[#4B5563] mt-1.5">{selectedType.hint}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Quantity ({selectedType?.unit || 'units'}) *</label>
              <input type="number" className={FIELD} placeholder="0"
                value={form.quantity} onChange={e => set('quantity', e.target.value)} min="0" step="0.5" />
            </div>
            <div>
              <label className={LABEL}>Price / {selectedType?.unit || 'unit'} (KES) *</label>
              <input type="number" className={FIELD} placeholder="0"
                value={form.price_per_unit} onChange={e => set('price_per_unit', e.target.value)} min="0" step="0.5" />
            </div>
            <div>
              <label className={LABEL}>Total (KES)</label>
              <div className="px-3 py-2 rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm font-semibold text-emerald-400">
                {totalPrice ? parseInt(totalPrice).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Buyer name</label>
              <input className={FIELD} placeholder="Customer or trader name"
                value={form.buyer_name} onChange={e => set('buyer_name', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Buyer contact</label>
              <input className={FIELD} placeholder="Phone number"
                value={form.buyer_contact} onChange={e => set('buyer_contact', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Market / channel</label>
              <select className={FIELD} value={form.market} onChange={e => set('market', e.target.value)}>
                <option value="">Select…</option>
                {MARKETS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Payment method</label>
              <select className={FIELD} value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                {PAYMENT.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <input className={FIELD} placeholder="Invoice reference, credit terms…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
            {loading ? 'Saving…' : 'Record sale'}
          </button>
        </form>
      )}

      {tab === 'history' && (
        <div className="space-y-1">
          {sales.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-8">No sales in the last 3 months</p>
          ) : sales.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{s.poultry_batches?.batch_name || '—'}</p>
                <p className="text-xs text-[#6B7280]">
                  {SALE_TYPES.find(t => t.value === s.sale_type)?.label || s.sale_type}
                  {s.buyer_name ? ` · ${s.buyer_name}` : ''} · {fmt(s.sale_date)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-emerald-400">KES {s.total_price.toLocaleString()}</p>
                <p className="text-[11px] text-[#6B7280]">{s.quantity} {s.unit}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
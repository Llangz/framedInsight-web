// 📁 FILE PATH: app/dashboard/dairy/finance/FinanceClient.tsx
'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Banknote, Droplets, Plus, X, FileDown,
} from 'lucide-react'
import { recordMilkSale, recordDairyExpense } from './actions'
import { queueDairyEvent } from '@/lib/offline-db'

interface Cow { id: string; cow_tag: string; breed: string | null }
interface MonthlyRow {
  month: string
  liters_produced: number
  liters_sold: number
  total_revenue: number
  total_expenses: number
  net_profit: number
  avg_price_per_liter: number | null
  pct_production_sold: number | null
}
interface Sale {
  id: string; sale_date: string; quantity_liters: number; price_per_liter: number
  total_amount: number; buyer_name: string | null; channel: string; payment_status: string
  cow_tag: string | null
}
interface Expense {
  id: string; expense_date: string; category: string; amount: number; description: string | null
}

function fmtK(n: number) {
  return `KES ${Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString()}`
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' })
}

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#D1D5DB] mb-1'
const CARD = 'bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4'

const today = () => new Date().toISOString().split('T')[0]

export default function FinanceClient({
  farmId, cows, monthly, currentMonth, sales, expenses,
}: {
  farmId: string
  cows: Cow[]
  monthly: MonthlyRow[]
  currentMonth: MonthlyRow
  sales: Sale[]
  expenses: Expense[]
}) {
  const [tab, setTab] = useState<'overview' | 'sales' | 'expenses'>('overview')
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedOffline, setSavedOffline] = useState(false)
  const t = useTranslations('dairyFinance')

  const [saleForm, setSaleForm] = useState({
    cow_id: '', sale_date: today(), quantity_liters: '', price_per_liter: '',
    buyer_name: '', channel: 'cooperative', payment_method: 'cash', payment_status: 'paid',
  })
  const [expenseForm, setExpenseForm] = useState({
    expense_date: today(), category: 'feed', amount: '', description: '',
  })

  const chartData = useMemo(
    () => [...monthly].reverse().map(m => ({
      month: fmtMonth(m.month),
      Revenue: m.total_revenue,
      Expenses: m.total_expenses,
      'Net profit': m.net_profit,
    })),
    [monthly]
  )

  const statCards = [
    { label: t('revenueThisMonth'), value: fmtK(currentMonth.total_revenue), sub: t('litersSold', { count: currentMonth.liters_sold }), Icon: TrendingUp, color: 'text-emerald-400', border: 'border-emerald-900/40' },
    { label: t('expensesThisMonth'), value: fmtK(currentMonth.total_expenses), sub: 'Feed, vet, labor & more', Icon: TrendingDown, color: 'text-red-400', border: 'border-red-900/40' },
    {
      label: t('netProfitThisMonth'), value: fmtK(currentMonth.net_profit),
      sub: currentMonth.avg_price_per_liter != null ? `KES ${currentMonth.avg_price_per_liter}/L avg` : t('noSalesYet'),
      Icon: Banknote,
      color: currentMonth.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400',
      border: currentMonth.net_profit >= 0 ? 'border-emerald-900/40' : 'border-red-900/40',
    },
    {
      label: t('pctProductionSold'), value: currentMonth.pct_production_sold != null ? `${currentMonth.pct_production_sold}%` : '—',
      sub: t('litersProduced', { count: currentMonth.liters_produced }), Icon: Droplets, color: 'text-sky-400', border: 'border-sky-900/40',
    },
  ]

  async function handleRecordSale() {
    if (!saleForm.quantity_liters || !saleForm.price_per_liter) {
      setError('Quantity and price per liter are required')
      return
    }
    setLoading(true)
    setError('')

    const quantity = parseFloat(saleForm.quantity_liters)
    const pricePerLiter = parseFloat(saleForm.price_per_liter)
    const payload = {
      farm_id: farmId,
      cow_id: saleForm.cow_id || null,
      sale_date: saleForm.sale_date,
      quantity_liters: quantity,
      price_per_liter: pricePerLiter,
      total_amount: Math.round(quantity * pricePerLiter * 100) / 100,
      buyer_name: saleForm.buyer_name || null,
      channel: saleForm.channel,
      payment_method: saleForm.payment_method,
      payment_status: saleForm.payment_status,
    }

    // OFFLINE FALLBACK: recordMilkSale() is a server action — a plain
    // fetch under the hood — so calling it with no connection just
    // throws a raw "Failed to fetch". Queue it locally instead, same
    // pattern as milk_record and the other dairy entity types (see
    // supabase/functions/sync-offline-events's milk_sale case).
    if (!navigator.onLine) {
      try {
        await queueDairyEvent({
          eventId: crypto.randomUUID(),
          entityType: 'milk_sale',
          farmId,
          referenceId: payload.cow_id ?? undefined,
          payload,
        })
        setShowSaleForm(false)
        setSavedOffline(true)
        setTimeout(() => setSavedOffline(false), 4000)
      } catch (err: any) {
        setError(err.message || 'Could not save offline')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const result = await recordMilkSale(payload as any)
      if (!result.success) {
        setError(result.error || 'Failed to record sale')
        return
      }
      setShowSaleForm(false)
      setSaleForm({ cow_id: '', sale_date: today(), quantity_liters: '', price_per_liter: '', buyer_name: '', channel: 'cooperative', payment_method: 'cash', payment_status: 'paid' })
    } catch (err: any) {
      setError(err.message || 'Failed to record sale')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecordExpense() {
    if (!expenseForm.amount) {
      setError('Amount is required')
      return
    }
    setLoading(true)
    setError('')

    const payload = {
      farm_id: farmId,
      expense_date: expenseForm.expense_date,
      category: expenseForm.category,
      amount: parseFloat(expenseForm.amount),
      description: expenseForm.description || null,
    }

    try {
      const result = await recordDairyExpense(payload as any)
      if (!result.success) {
        setError(result.error || 'Failed to record expense')
        return
      }
      setShowExpenseForm(false)
      setExpenseForm({ expense_date: today(), category: 'feed', amount: '', description: '' })
    } catch (err: any) {
      setError(err.message || 'Failed to record expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white leading-none">{t('title')}</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">{t('subtitle')}</p>
          </div>
          <a
            href="/api/reports/farm-statement?enterprise=dairy&months=6"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A2D35] text-xs font-semibold text-[#D1D5DB] hover:bg-[#17191F] transition-colors"
          >
            <FileDown size={14} /> {t('statement')}
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(({ label, value, sub, Icon, color, border }) => (
            <div key={label} className={`${CARD} ${border}`}>
              <Icon size={16} className={color} />
              <p className="text-lg font-bold text-white mt-2 leading-none">{value}</p>
              <p className="text-xs text-[#6B7280] mt-1">{label}</p>
              <p className="text-[11px] text-[#4B5563] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {chartData.length > 0 && (
          <div className={CARD}>
            <p className="text-sm font-semibold text-white mb-3">Last 12 months</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0D0F14', border: '1px solid #2A2D35', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net profit" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => { setShowSaleForm(v => !v); setShowExpenseForm(false); setError('') }}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors">
            <Plus size={16} /> {t('recordSale')}
          </button>
          <button onClick={() => { setShowExpenseForm(v => !v); setShowSaleForm(false); setError('') }}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#2A2D35] text-[#D1D5DB] text-sm font-semibold hover:bg-[#17191F] transition-colors">
            <Plus size={16} /> {t('recordExpense')}
          </button>
        </div>

        {error && <div className="bg-red-950/40 border border-red-700 rounded-xl p-3 text-sm text-red-300">{error}</div>}
        {savedOffline && <div className="bg-emerald-950/40 border border-emerald-700 rounded-xl p-3 text-sm text-emerald-300">{t('savedOffline')}</div>}

        {showSaleForm && (
          <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">Record Milk Sale</p>
              <button onClick={() => setShowSaleForm(false)} className="text-[#6B7280] hover:text-white"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Sale Date *</label>
                <input type="date" max={today()} value={saleForm.sale_date}
                  onChange={e => setSaleForm(f => ({ ...f, sale_date: e.target.value }))} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Cow (optional — leave blank for a bulk/whole-herd sale)</label>
                <select value={saleForm.cow_id} onChange={e => setSaleForm(f => ({ ...f, cow_id: e.target.value }))} className={FIELD}>
                  <option value="">Whole herd / bulk</option>
                  {cows.map(c => <option key={c.id} value={c.id}>{c.cow_tag}{c.breed ? ` (${c.breed})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Quantity (liters) *</label>
                <input type="number" min="0" step="0.1" placeholder="0" value={saleForm.quantity_liters}
                  onChange={e => setSaleForm(f => ({ ...f, quantity_liters: e.target.value }))} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Price per liter (KES) *</label>
                <input type="number" min="0" step="0.5" placeholder="0" value={saleForm.price_per_liter}
                  onChange={e => setSaleForm(f => ({ ...f, price_per_liter: e.target.value }))} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Channel</label>
                <select value={saleForm.channel} onChange={e => setSaleForm(f => ({ ...f, channel: e.target.value }))} className={FIELD}>
                  <option value="cooperative">Cooperative / collection point</option>
                  <option value="processor">Processor</option>
                  <option value="hawker">Hawker</option>
                  <option value="direct_consumer">Direct to consumer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Buyer name</label>
                <input type="text" placeholder="Optional" value={saleForm.buyer_name}
                  onChange={e => setSaleForm(f => ({ ...f, buyer_name: e.target.value }))} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Payment method</label>
                <select value={saleForm.payment_method} onChange={e => setSaleForm(f => ({ ...f, payment_method: e.target.value }))} className={FIELD}>
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cooperative_account">Cooperative account</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Payment status</label>
                <select value={saleForm.payment_status} onChange={e => setSaleForm(f => ({ ...f, payment_status: e.target.value }))} className={FIELD}>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
            </div>
            <button onClick={handleRecordSale} disabled={loading}
              className="mt-4 w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Sale'}
            </button>
          </div>
        )}

        {showExpenseForm && (
          <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">Record Expense</p>
              <button onClick={() => setShowExpenseForm(false)} className="text-[#6B7280] hover:text-white"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Date *</label>
                <input type="date" max={today()} value={expenseForm.expense_date}
                  onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Category *</label>
                <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} className={FIELD}>
                  <option value="feed">Feed</option>
                  <option value="veterinary">Veterinary</option>
                  <option value="breeding">Breeding / AI</option>
                  <option value="labor">Labor</option>
                  <option value="transport">Transport</option>
                  <option value="equipment">Equipment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Amount (KES) *</label>
                <input type="number" min="0" step="1" placeholder="0" value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Description</label>
                <input type="text" placeholder="Optional" value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} className={FIELD} />
              </div>
            </div>
            <button onClick={handleRecordExpense} disabled={loading}
              className="mt-4 w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        )}

        <div className="flex gap-2 border-b border-[#2A2D35]">
          {(['overview', 'sales', 'expenses'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-emerald-500 text-white' : 'border-transparent text-[#6B7280] hover:text-[#D1D5DB]'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className={CARD}>
            <p className="text-sm text-[#9CA3AF]">
              {monthly.length === 0
                ? 'No milk sales or expenses recorded yet. Record a sale above to start building your profitability picture.'
                : `Showing ${monthly.length} month${monthly.length === 1 ? '' : 's'} of dairy finance history.`}
            </p>
          </div>
        )}

        {tab === 'sales' && (
          <div className={`${CARD} p-0 overflow-hidden`}>
            {sales.length === 0 ? (
              <p className="text-sm text-[#6B7280] p-4">No milk sales recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#17191F] text-[#6B7280] text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Cow</th>
                    <th className="text-right px-4 py-2 font-medium">Liters</th>
                    <th className="text-right px-4 py-2 font-medium">KES/L</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D35]">
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-[#D1D5DB]">{fmtDate(s.sale_date)}</td>
                      <td className="px-4 py-2 text-[#9CA3AF]">{s.cow_tag ?? 'Whole herd'}</td>
                      <td className="px-4 py-2 text-right text-[#D1D5DB]">{s.quantity_liters}</td>
                      <td className="px-4 py-2 text-right text-[#D1D5DB]">{s.price_per_liter}</td>
                      <td className="px-4 py-2 text-right font-semibold text-white">{fmtK(s.total_amount)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.payment_status === 'paid' ? 'bg-emerald-950/50 text-emerald-300' : 'bg-amber-950/50 text-amber-300'
                        }`}>{s.payment_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'expenses' && (
          <div className={`${CARD} p-0 overflow-hidden`}>
            {expenses.length === 0 ? (
              <p className="text-sm text-[#6B7280] p-4">No expenses recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#17191F] text-[#6B7280] text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Category</th>
                    <th className="text-left px-4 py-2 font-medium">Description</th>
                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D35]">
                  {expenses.map(e => (
                    <tr key={e.id}>
                      <td className="px-4 py-2 text-[#D1D5DB]">{fmtDate(e.expense_date)}</td>
                      <td className="px-4 py-2 text-[#9CA3AF] capitalize">{e.category}</td>
                      <td className="px-4 py-2 text-[#6B7280]">{e.description ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold text-white">{fmtK(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 📁 FILE PATH: app/dashboard/coffee/finance/FinanceClient.tsx
'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Banknote, BarChart3, Plus, X } from 'lucide-react'
import { addTransaction } from './actions'

interface YearSummary {
  year: string; total_revenue: number; total_costs: number; net_profit: number
  margin_pct: number; cost_per_kg: number; total_cherry_kg: number; harvest_count: number
}
interface PlotFinancials {
  plot_name: string; revenue: number; costs: number; profit: number; margin_pct: number; cherry_kg: number
}
interface MonthlyCost {
  month: string; weeding: number; fertilizer: number; spraying: number; pruning: number; other: number; total: number
}
interface FinancialTransaction {
  id: string; transaction_date: string; category: string; description: string
  amount: number; payment_method: string; cooperative_name: string; buyer_name: string
}

function fmtK(n: number) {
  return `KES ${Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toLocaleString()}`
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TABS = ['overview', 'costs', 'plots', 'transactions'] as const
type Tab = typeof TABS[number]

const COST_COLOURS: Record<string, string> = {
  fertilizer: '#10b981', spraying: '#3b82f6', weeding: '#f59e0b',
  pruning: '#8b5cf6', other: '#6b7280',
}

export default function FinanceClient({
  years, initialPlotFinancials, initialMonthlyCosts, transactions, selectedYear: initialSelectedYear,
}: {
  years: YearSummary[]; initialPlotFinancials: PlotFinancials[]; initialMonthlyCosts: MonthlyCost[]
  transactions: FinancialTransaction[]; selectedYear: string
}) {
  const [selectedYear, setSelectedYear] = useState(initialSelectedYear)
  const [tab, setTab] = useState<Tab>('overview')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [txForm, setTxForm] = useState({ category: 'expense', description: '', amount: '', payment_method: 'mpesa', transaction_date: new Date().toISOString().split('T')[0] })
  const [txError, setTxError] = useState('')

  const s = useMemo(() => years.find(y => y.year === selectedYear), [years, selectedYear])

  const statCards = s ? [
    { label: 'Revenue',    value: fmtK(s.total_revenue), sub: `${s.harvest_count} deliveries`,     Icon: TrendingUp,   color: 'text-emerald-400', border: 'border-emerald-900/40' },
    { label: 'Costs',      value: fmtK(s.total_costs),   sub: `KES ${s.cost_per_kg}/kg`,           Icon: TrendingDown, color: 'text-red-400',     border: 'border-red-900/40'     },
    { label: 'Net profit', value: fmtK(s.net_profit),    sub: `${s.margin_pct}% margin`,           Icon: Banknote,     color: s.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400', border: s.net_profit >= 0 ? 'border-emerald-900/40' : 'border-red-900/40' },
    { label: 'Cherry',     value: `${s.total_cherry_kg.toLocaleString()} kg`, sub: `${selectedYear} season`, Icon: BarChart3, color: 'text-sky-400', border: 'border-sky-900/40' },
  ] : []

  async function handleAddTransaction() {
    if (!txForm.description || !txForm.amount) return
    setLoading(true)
    setTxError('')
    try {
      const result = await addTransaction({ ...txForm, amount: parseFloat(txForm.amount) })
      if (!result.success) {
        setTxError(result.error || 'Failed to save record')
        return
      }
      setShowAdd(false)
      setTxForm({ category: 'expense', description: '', amount: '', payment_method: 'mpesa', transaction_date: new Date().toISOString().split('T')[0] })
    } catch (err: any) {
      setTxError(err.message || 'Failed to save record')
    } finally {
      setLoading(false)
    }
  }

  const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#4B5563] transition-colors'
  const LABEL = 'block text-xs font-medium text-[#D1D5DB] mb-1'

  return (
    <div className="min-h-screen bg-obsidian">

      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Coffee financials</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Seasonal P&amp;L and expense ledger</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-[#0D0F14] border border-[#2A2D35] text-sm text-white focus:outline-none focus:border-[#4B5563] transition-colors"
            >
              {years.map(y => <option key={y.year} value={y.year}>{y.year} season</option>)}
            </select>
            <button
              onClick={() => { setTxError(''); setShowAdd(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors"
            >
              <Plus size={12} /> Add record
            </button>
          </div>
        </div>

        {/* Stat cards */}
        {s && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map(({ label, value, sub, Icon, color, border }) => (
              <div key={label} className={`rounded-lg border ${border} bg-[#0D0F14] p-4`}>
                <Icon size={14} className={`${color} mb-3`} />
                <p className="text-xl font-semibold text-white tracking-tight">{value}</p>
                <p className="text-xs font-medium text-[#6B7280] mt-0.5">{label}</p>
                <p className="text-[11px] text-[#4B5563]">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg border border-[#2A2D35] bg-[#0D0F14] w-fit">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                tab === t ? 'text-white bg-white/10' : 'text-[#6B7280] hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Overview: P&L bar chart */}
        {tab === 'overview' && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35]">
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Seasonal P&amp;L</h2>
            </div>
            <div className="p-4 h-64">
              {years.length === 0 ? (
                <p className="text-sm text-[#6B7280] text-center py-8">No financial data yet — record a harvest to begin.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={years} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2128" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: '#0D0F14', border: '1px solid #2A2D35', borderRadius: 8, color: '#fff', fontSize: 12 }}
                      formatter={(v: number) => [`KES ${v.toLocaleString()}`, '']}
                    />
                    <ReferenceLine y={0} stroke="#2A2D35" />
                    <Bar dataKey="total_revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="total_costs" name="Costs" fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar dataKey="net_profit" name="Profit" fill="#3b82f6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        )}

        {/* Costs: monthly breakdown chart */}
        {tab === 'costs' && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35]">
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Activity costs — {selectedYear}</h2>
            </div>
            <div className="p-4 h-72">
              {initialMonthlyCosts.length === 0 ? (
                <p className="text-sm text-[#6B7280] text-center py-8">No activity costs recorded for {selectedYear}.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={initialMonthlyCosts} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2128" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: '#0D0F14', border: '1px solid #2A2D35', borderRadius: 8, color: '#fff', fontSize: 12 }}
                      formatter={(v: number) => [`KES ${v.toLocaleString()}`, '']}
                    />
                    {Object.entries(COST_COLOURS).map(([key, color]) => (
                      <Bar key={key} dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)} fill={color} stackId="a" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap px-4 pb-4">
              {Object.entries(COST_COLOURS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs text-[#6B7280] capitalize">{key}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Plots: per-plot P&L */}
        {tab === 'plots' && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2D35]">
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Plot P&amp;L — {selectedYear}</h2>
            </div>
            {initialPlotFinancials.length === 0 ? (
              <p className="text-sm text-[#6B7280] px-4 py-8 text-center">No plot-level financial data yet.</p>
            ) : (
              <div className="divide-y divide-[#1F2128]">
                {initialPlotFinancials.map(p => (
                  <div key={p.plot_name} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{p.plot_name}</p>
                      <p className="text-xs text-[#6B7280]">{p.cherry_kg.toLocaleString()} kg · {fmtK(p.costs)} costs</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-white">{fmtK(p.revenue)}</p>
                      <p className={`text-xs ${p.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.profit >= 0 ? '+' : ''}{fmtK(p.profit)}
                      </p>
                    </div>
                    <div className="w-12 text-right flex-shrink-0">
                      <p className={`text-xs font-medium ${p.margin_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.margin_pct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Transactions */}
        {tab === 'transactions' && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2D35]">
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Ledger — {selectedYear}</h2>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-[#6B7280] px-4 py-8 text-center">No manual transactions recorded.</p>
            ) : (
              <div className="divide-y divide-[#1F2128]">
                {transactions.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{t.description}</p>
                      <p className="text-xs text-[#6B7280]">
                        {fmtDate(t.transaction_date)} · {t.category}
                        {t.cooperative_name ? ` · ${t.cooperative_name}` : ''}
                        {t.payment_method ? ` · ${t.payment_method}` : ''}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold flex-shrink-0 ${t.category === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {t.category === 'expense' ? '-' : '+'}KES {t.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Add transaction modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-[#2A2D35] bg-[#0D0F14] shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D35]">
                <h3 className="text-sm font-semibold text-white">Add financial record</h3>
                <button onClick={() => { setTxError(''); setShowAdd(false) }} className="text-[#6B7280] hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {txError && (
                  <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-md text-xs text-red-300">
                    {txError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Type</label>
                    <select className={FIELD} value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Date</label>
                    <input type="date" className={FIELD} value={txForm.transaction_date} onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Description *</label>
                  <input className={FIELD} placeholder="e.g. Purchased CAN fertilizer" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Amount (KES) *</label>
                    <input type="number" min="0" step="0.01" className={FIELD} placeholder="e.g. 5000" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL}>Payment method</label>
                    <select className={FIELD} value={txForm.payment_method} onChange={e => setTxForm(f => ({ ...f, payment_method: e.target.value }))}>
                      <option value="mpesa">M-Pesa</option>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank transfer</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setTxError(''); setShowAdd(false) }} className="flex-1 py-2.5 rounded-md border border-[#2A2D35] text-sm text-[#9CA3AF] hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAddTransaction} disabled={loading || !txForm.description || !txForm.amount}
                    className="flex-1 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium text-white transition-colors">
                    {loading ? 'Saving…' : 'Save record'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
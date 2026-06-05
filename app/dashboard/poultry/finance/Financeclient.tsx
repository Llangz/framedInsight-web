// app/dashboard/poultry/finance/FinanceClient.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign,
  Wheat, Syringe, Skull, ShoppingCart, BarChart3,
  AlertTriangle, ChevronDown, Info,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Batch {
  id: string
  batch_name: string
  bird_type: 'layer' | 'broiler' | 'kienyeji' | 'dual_purpose'
  initial_count: number
  current_count: number
  date_of_placement: string
  status: 'active' | 'sold' | 'culled'
  house_number?: string
}

interface Sale {
  id: string; batch_id: string; sale_date: string; sale_type: string
  quantity: number; unit: string; price_per_unit: number; total_price: number
  buyer_name?: string; market?: string; payment_method?: string; notes?: string
  poultry_batches?: { batch_name: string; bird_type: string }
}

interface FeedRecord {
  id: string; batch_id: string; record_date: string; feed_type: string
  quantity_kg: number; cost_per_kg: number; total_cost: number
  poultry_batches?: { batch_name: string }
}

interface HealthRecord {
  id: string; batch_id: string; record_date: string; event_type: string
  vaccine_name?: string; disease?: string; drug_name?: string; cost?: number
  poultry_batches?: { batch_name: string }
}

interface MortalityRecord {
  id: string; batch_id: string; record_date: string
  count_dead: number; cause?: string
  poultry_batches?: { batch_name: string; initial_count?: number }
}

interface Props {
  farmId: string
  batches: Batch[]
  sales: Sale[]
  feedRecords: FeedRecord[]
  healthRecords: HealthRecord[]
  mortalityRecords: MortalityRecord[]
}

// ─── Constants ─────────────────────────────────────────────────────────────

const KES = (n: number) =>
  `KES ${Math.round(n).toLocaleString('en-KE')}`

const BIRD_LABEL: Record<string, string> = {
  layer: 'Layers', broiler: 'Broilers',
  kienyeji: 'Kienyeji', dual_purpose: 'Dual Purpose',
}

// Estimated mortality cost per bird by type (avg market value lost, KES)
const MORTALITY_COST_PER_BIRD: Record<string, number> = {
  layer: 800, broiler: 500, kienyeji: 900, dual_purpose: 700,
}

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white focus:outline-none focus:border-[#4B5563] transition-colors'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Internal P&L types ────────────────────────────────────────────────────

interface BatchPnL {
  batch: Batch
  revenue: number
  feedCost: number
  healthCost: number
  mortLoss: number
  mortBirds: number
  totalCosts: number
  netProfit: number
  margin: number
  profitable: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function FinanceClient({
  batches, sales, feedRecords, healthRecords, mortalityRecords,
}: Props) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL')
  const [period, setPeriod] = useState<'30' | '90' | '180' | 'ALL'>('90')

  // ── Date filter
  const cutoff = useMemo(() => {
    if (period === 'ALL') return null
    const d = new Date()
    d.setDate(d.getDate() - parseInt(period))
    return d.toISOString().split('T')[0]
  }, [period])

  // ── Filtered batch IDs
  const activeBatchIds = useMemo(() => {
    if (selectedBatchId === 'ALL') return batches.map(b => b.id)
    return [selectedBatchId]
  }, [selectedBatchId, batches])

  // ── P&L calculation
  const pnl = useMemo(() => {
    const inPeriod = (date: string) => !cutoff || date >= cutoff
    const inBatch  = (id: string)  => activeBatchIds.includes(id)
    const filter   = (date: string, id: string) => inPeriod(date) && inBatch(id)

    // Revenue
    const filteredSales = sales.filter(s => filter(s.sale_date, s.batch_id))
    const totalRevenue  = filteredSales.reduce((s, r) => s + r.total_price, 0)

    const revenueByType: Record<string, number> = {}
    filteredSales.forEach(s => {
      revenueByType[s.sale_type] = (revenueByType[s.sale_type] || 0) + s.total_price
    })

    // Feed costs
    const filteredFeed  = feedRecords.filter(f => filter(f.record_date, f.batch_id))
    const totalFeedCost = filteredFeed.reduce((s, r) => s + r.total_cost, 0)

    // Health / vet costs
    const filteredHealth     = healthRecords.filter(h => filter(h.record_date, h.batch_id))
    const totalHealthCost    = filteredHealth.reduce((s, r) => s + (r.cost || 0), 0)

    // Mortality losses (estimated value of dead birds)
    const filteredMortality  = mortalityRecords.filter(m => filter(m.record_date, m.batch_id))
    const totalMortalityLoss = filteredMortality.reduce((s, m) => {
      const batch = batches.find(b => b.id === m.batch_id)
      const costPerBird = batch ? (MORTALITY_COST_PER_BIRD[batch.bird_type] || 600) : 600
      return s + m.count_dead * costPerBird
    }, 0)
    const totalMortalityBirds = filteredMortality.reduce((s, m) => s + m.count_dead, 0)

    // Totals
    const totalCosts  = totalFeedCost + totalHealthCost
    const grossProfit = totalRevenue - totalCosts
    const netProfit   = grossProfit - totalMortalityLoss
    const margin      = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // Per-batch breakdown
    const batchBreakdown = activeBatchIds.map(batchId => {
      const batch = batches.find(b => b.id === batchId)
      if (!batch) return null

      const bSales    = filteredSales.filter(s => s.batch_id === batchId)
      const bFeed     = filteredFeed.filter(f => f.batch_id === batchId)
      const bHealth   = filteredHealth.filter(h => h.batch_id === batchId)
      const bMort     = filteredMortality.filter(m => m.batch_id === batchId)

      const rev        = bSales.reduce((s, r) => s + r.total_price, 0)
      const feedCost   = bFeed.reduce((s, r) => s + r.total_cost, 0)
      const healthCost = bHealth.reduce((s, r) => s + (r.cost || 0), 0)
      const mortLoss   = bMort.reduce((s, m) => {
        const cpb = MORTALITY_COST_PER_BIRD[batch.bird_type] || 600
        return s + m.count_dead * cpb
      }, 0)
      const mortBirds  = bMort.reduce((s, m) => s + m.count_dead, 0)
      const costs      = feedCost + healthCost
      const net        = rev - costs - mortLoss
      const batchMargin = rev > 0 ? (net / rev) * 100 : 0

      return {
        batch,
        revenue:      rev,
        feedCost,
        healthCost,
        mortLoss,
        mortBirds,
        totalCosts:   costs,
        netProfit:    net,
        margin:       batchMargin,
        profitable:   net >= 0,
      }
    }).filter(Boolean) as BatchPnL[]

    return {
      totalRevenue, totalFeedCost, totalHealthCost,
      totalMortalityLoss, totalMortalityBirds, totalCosts,
      grossProfit, netProfit, margin,
      revenueByType, filteredSales, filteredFeed, filteredHealth, filteredMortality,
      batchBreakdown,
    }
  }, [sales, feedRecords, healthRecords, mortalityRecords, activeBatchIds, batches, cutoff])

  if (!batches.length) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <BarChart3 className="w-12 h-12 text-[#2A2D35] mx-auto mb-4" />
          <p className="text-white font-medium mb-2">No batches yet</p>
          <p className="text-[#6B7280] text-sm mb-4">
            Add your first poultry batch to start tracking profitability.
          </p>
          <Link
            href="/dashboard/poultry/add-batch"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
          >
            Add batch
          </Link>
        </div>
      </div>
    )
  }

  const profitable = pnl.netProfit >= 0

  return (
    <div className="space-y-6 px-4 pb-16">
      {/* ── Back nav */}
      <Link
        href="/dashboard/poultry"
        className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Poultry overview
      </Link>

      {/* ── Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Batch</label>
          <div className="relative">
            <select
              className={FIELD + ' appearance-none pr-8'}
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
            >
              <option value="ALL">All batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.batch_name} ({BIRD_LABEL[b.bird_type]}) — {b.status}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[#6B7280] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Period</label>
          <div className="flex gap-1">
            {(['30', '90', '180', 'ALL'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0D0F14] border border-[#2A2D35] text-[#9CA3AF] hover:text-white'
                }`}
              >
                {p === 'ALL' ? 'All time' : `${p}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Revenue',
            value: KES(pnl.totalRevenue),
            Icon: DollarSign,
            color: 'text-emerald-400',
            bg:    'bg-emerald-950/30 border-emerald-900/40',
          },
          {
            label: 'Feed Costs',
            value: KES(pnl.totalFeedCost),
            Icon: Wheat,
            color: 'text-amber-400',
            bg:    'bg-amber-950/30 border-amber-900/40',
          },
          {
            label: 'Health Costs',
            value: KES(pnl.totalHealthCost),
            Icon: Syringe,
            color: 'text-blue-400',
            bg:    'bg-blue-950/30 border-blue-900/40',
          },
          {
            label: 'Mortality Losses',
            value: KES(pnl.totalMortalityLoss),
            sub:   `${pnl.totalMortalityBirds} birds`,
            Icon: Skull,
            color: 'text-red-400',
            bg:    'bg-red-950/30 border-red-900/40',
          },
        ].map(({ label, value, sub, Icon, color, bg }) => (
          <div key={label} className={`rounded-xl p-4 border ${bg}`}>
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-[#6B7280]">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-[#4B5563] mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Net P&L banner */}
      <div
        className={`rounded-xl p-5 border flex items-center justify-between ${
          profitable
            ? 'bg-emerald-950/40 border-emerald-800/50'
            : 'bg-red-950/40 border-red-800/50'
        }`}
      >
        <div>
          <p className="text-xs text-[#9CA3AF] mb-0.5">Net Profit / Loss</p>
          <p className={`text-2xl font-bold ${profitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {profitable ? '+' : ''}{KES(pnl.netProfit)}
          </p>
          <p className="text-xs text-[#6B7280] mt-1">
            After feed, health &amp; mortality losses
          </p>
        </div>
        <div className="text-right">
          {profitable
            ? <TrendingUp className="w-10 h-10 text-emerald-500/60 ml-auto mb-1" />
            : <TrendingDown className="w-10 h-10 text-red-500/60 ml-auto mb-1" />
          }
          <p className={`text-sm font-semibold ${profitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl.margin >= 0 ? '+' : ''}{pnl.margin.toFixed(1)}% margin
          </p>
        </div>
      </div>

      {/* ── Cost structure bar */}
      {pnl.totalRevenue > 0 && (
        <div className="rounded-xl bg-[#0D0F14] border border-[#2A2D35] p-4">
          <p className="text-xs font-medium text-[#9CA3AF] mb-3">Cost Structure (% of revenue)</p>
          {[
            { label: 'Feed',      val: pnl.totalFeedCost,      color: 'bg-amber-500' },
            { label: 'Health',    val: pnl.totalHealthCost,    color: 'bg-blue-500' },
            { label: 'Mortality', val: pnl.totalMortalityLoss, color: 'bg-red-500' },
          ].map(({ label, val, color }) => {
            const pct = pnl.totalRevenue > 0 ? (val / pnl.totalRevenue) * 100 : 0
            return (
              <div key={label} className="mb-2">
                <div className="flex justify-between text-xs text-[#6B7280] mb-1">
                  <span>{label}</span>
                  <span>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-[#1A1D24] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Revenue breakdown by type */}
      {Object.keys(pnl.revenueByType).length > 0 && (
        <div className="rounded-xl bg-[#0D0F14] border border-[#2A2D35] p-4">
          <p className="text-xs font-medium text-[#9CA3AF] mb-3">Revenue by Sale Type</p>
          <div className="space-y-2">
            {Object.entries(pnl.revenueByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, amount]) => {
                const pct = pnl.totalRevenue > 0 ? (amount / pnl.totalRevenue) * 100 : 0
                const label = ({
                  eggs: 'Eggs (trays)', eggs_loose: 'Eggs (loose)',
                  live_birds: 'Live birds', dressed: 'Dressed carcass',
                  day_old_chicks: 'DOC / chicks', manure: 'Manure',
                } as Record<string, string>)[type] || type
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-[#9CA3AF] w-32 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-[#1A1D24] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-emerald-400 w-24 text-right">
                      {KES(amount)}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── Per-batch P&L table */}
      {pnl.batchBreakdown.length > 1 && (
        <div className="rounded-xl bg-[#0D0F14] border border-[#2A2D35] overflow-hidden">
          <div className="p-4 border-b border-[#2A2D35]">
            <p className="text-xs font-medium text-[#9CA3AF]">Profitability by Batch</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2A2D35]">
                  {['Batch', 'Type', 'Revenue', 'Feed', 'Health', 'Mortality', 'Net', 'Margin'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-[#6B7280] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pnl.batchBreakdown.map(b => (
                  <tr key={b.batch.id} className="border-b border-[#2A2D35]/50 hover:bg-[#1A1D24] transition-colors">
                    <td className="px-3 py-3 font-medium text-white whitespace-nowrap">
                      {b.batch.batch_name}
                      {b.batch.status !== 'active' && (
                        <span className="ml-1.5 text-[#4B5563]">({b.batch.status})</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[#9CA3AF]">{BIRD_LABEL[b.batch.bird_type]}</td>
                    <td className="px-3 py-3 text-emerald-400">{KES(b.revenue)}</td>
                    <td className="px-3 py-3 text-amber-400">{KES(b.feedCost)}</td>
                    <td className="px-3 py-3 text-blue-400">{KES(b.healthCost)}</td>
                    <td className="px-3 py-3 text-red-400">
                      {KES(b.mortLoss)}
                      {b.mortBirds > 0 && (
                        <span className="text-[#4B5563] ml-1">({b.mortBirds})</span>
                      )}
                    </td>
                    <td className={`px-3 py-3 font-semibold ${b.profitable ? 'text-emerald-400' : 'text-red-400'}`}>
                      {b.netProfit >= 0 ? '+' : ''}{KES(b.netProfit)}
                    </td>
                    <td className={`px-3 py-3 ${b.profitable ? 'text-emerald-400' : 'text-red-400'}`}>
                      {b.margin >= 0 ? '+' : ''}{b.margin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent transactions */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">
          Recent Transactions
        </p>

        {/* Sales */}
        {pnl.filteredSales.slice(0, 5).map(s => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl bg-[#0D0F14] border border-[#2A2D35] p-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-900/40 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-white">
                  {(s.poultry_batches as any)?.batch_name || 'Unknown batch'}
                </p>
                <p className="text-xs text-[#6B7280]">{fmt(s.sale_date)} · {s.sale_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-emerald-400">+{KES(s.total_price)}</span>
          </div>
        ))}

        {/* Feed records */}
        {pnl.filteredFeed.slice(0, 3).map(f => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-xl bg-[#0D0F14] border border-[#2A2D35] p-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-950/50 border border-amber-900/40 flex items-center justify-center">
                <Wheat className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-white">
                  {(f.poultry_batches as any)?.batch_name || 'Unknown batch'}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {fmt(f.record_date)} · {f.feed_type.replace(/_/g, ' ')} — {f.quantity_kg}kg
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-amber-400">-{KES(f.total_cost)}</span>
          </div>
        ))}

        {pnl.filteredSales.length === 0 && pnl.filteredFeed.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-[#0D0F14] border border-[#2A2D35] p-4">
            <Info className="w-4 h-4 text-[#4B5563] shrink-0" />
            <p className="text-sm text-[#6B7280]">
              No transactions in the selected period. Record sales and feed purchases to see your P&amp;L.
            </p>
          </div>
        )}
      </div>

      {/* ── Mortality cost note */}
      <div className="flex items-start gap-2.5 rounded-xl bg-[#0D0F14] border border-[#2A2D35] p-4">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-[#6B7280]">
          Mortality losses are estimated using average Kenyan market values per bird type
          (layers KES 800, broilers KES 500, kienyeji KES 900). Actual replacement costs may vary.
        </p>
      </div>
    </div>
  )
}

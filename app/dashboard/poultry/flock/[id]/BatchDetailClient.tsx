'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Bird, Egg, Wheat, Skull, Syringe, ShoppingCart,
  TrendingUp, TrendingDown, AlertTriangle, Calendar, DollarSign,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Batch {
  id: string; batch_name: string; bird_type: string; breed: string | null
  date_of_placement: string; initial_count: number; current_count: number
  status: string; source: string | null; purchase_price_per_bird: number | null
  house_number: string | null; housing_system: string | null
  expected_laying_date: string | null; target_weight_kg: number | null
  notes: string | null
}
interface EggRecord     { id: string; record_date: string; total_eggs: number; eggs_collected: number; notes?: string }
interface FeedRecord    { id: string; record_date: string; feed_type: string; quantity_kg: number; days_remaining?: number; notes?: string }
interface MortRecord    { id: string; record_date: string; count_dead: number; notes?: string }
interface HealthRecord  { id: string; record_date: string; event_type: string; next_due_date?: string; notes?: string }
interface SaleRecord    { id: string; sale_date: string; sale_type: string; quantity: number; unit: string; price_per_unit: number; total_price: number; buyer_name?: string; market?: string; payment_method: string; notes?: string }

interface Props {
  batch:         Batch
  farmId:        string
  eggRecords:    EggRecord[]
  feedRecords:   FeedRecord[]
  mortRecords:   MortRecord[]
  healthRecords: HealthRecord[]
  salesRecords:  SaleRecord[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

const BIRD_LABEL: Record<string, string> = {
  layer: 'Layer', broiler: 'Broiler', kienyeji: 'Kienyeji', dual_purpose: 'Dual purpose',
}
const BIRD_COLOR: Record<string, string> = {
  layer:        'text-amber-400 border-amber-900/40 bg-amber-950/30',
  broiler:      'text-sky-400 border-sky-900/40 bg-sky-950/30',
  kienyeji:     'text-emerald-400 border-emerald-900/40 bg-emerald-950/30',
  dual_purpose: 'text-purple-400 border-purple-900/40 bg-purple-950/30',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20',
  sold:   'text-[#6B7280] border-[#2A2D35] bg-[#0A0C10]',
  culled: 'text-red-400 border-red-900/40 bg-red-950/20',
  closed: 'text-[#6B7280] border-[#2A2D35] bg-[#0A0C10]',
}

function StatCard({ label, value, sub, icon: Icon, alert }: {
  label: string; value: string; sub: string
  icon: React.ElementType; alert?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${alert ? 'border-red-900/40 bg-red-950/20' : 'border-[#2A2D35] bg-[#0D0F14]'}`}>
      <Icon size={14} className={`mb-2 ${alert ? 'text-red-400' : 'text-[#4B5563]'}`} />
      <p className={`text-xl font-semibold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-[#6B7280] mt-0.5">{label}</p>
      <p className="text-[11px] text-[#4B5563]">{sub}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BatchDetailClient({
  batch, farmId, eggRecords, feedRecords, mortRecords, healthRecords, salesRecords,
}: Props) {
  const [tab, setTab] = useState<'overview' | 'eggs' | 'feed' | 'health' | 'mortality' | 'sales' | 'financials'>('overview')

  const ageWeeks = Math.floor(
    (Date.now() - new Date(batch.date_of_placement).getTime()) / (7 * 86400000)
  )

  // ── Key metrics ────────────────────────────────────────────────────────────
  const totalMort      = useMemo(() => mortRecords.reduce((s, r) => s + r.count_dead, 0), [mortRecords])
  const mortRatePct    = batch.initial_count > 0
    ? ((totalMort / batch.initial_count) * 100).toFixed(1) : '0'

  const sevenAgo    = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const eggs7d      = eggRecords.filter(e => e.record_date >= sevenAgo)
  const avgEggs7d   = eggs7d.length
    ? Math.round(eggs7d.reduce((s, e) => s + e.total_eggs, 0) / eggs7d.length) : 0
  const isLayer     = batch.bird_type === 'layer' || batch.bird_type === 'dual_purpose'
  const henDayPct   = isLayer && avgEggs7d && batch.current_count
    ? Math.round((avgEggs7d / batch.current_count) * 100) : null
  const latestFeed  = feedRecords[0]

  // ── P&L ────────────────────────────────────────────────────────────────────
  const costOfBirds   = (batch.initial_count ?? 0) * (batch.purchase_price_per_bird ?? 0)
  const totalFeedCost = 0  // feed cost_per_kg not in DB schema — show 0 gracefully
  const totalRevenue  = salesRecords.reduce((s, r) => s + (r.total_price ?? 0), 0)
  const grossMargin   = totalRevenue - costOfBirds

  // ── Egg trend chart (last 14 days) ─────────────────────────────────────────
  const last14 = useMemo(() => {
    const days: { date: string; eggs: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
      const rec = eggRecords.find(e => e.record_date === d)
      days.push({ date: d, eggs: rec?.total_eggs ?? 0 })
    }
    return days
  }, [eggRecords])
  const maxEggs = Math.max(...last14.map(d => d.eggs), 1)

  const TABS = [
    { key: 'overview',   label: 'Overview'    },
    { key: 'eggs',       label: 'Eggs'        },
    { key: 'feed',       label: 'Feed'        },
    { key: 'health',     label: 'Health'      },
    { key: 'mortality',  label: 'Mortality'   },
    { key: 'sales',      label: 'Sales'       },
    { key: 'financials', label: 'Financials'  },
  ] as const

  return (
    <div className="min-h-screen bg-obsidian">

      {/* Sub-nav */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            <Link href="/dashboard/poultry/flock" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors">
              <ArrowLeft size={12} /> Flock
            </Link>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${BIRD_COLOR[batch.bird_type]}`}>
                {BIRD_LABEL[batch.bird_type]}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLOR[batch.status]}`}>
                {batch.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{batch.batch_name}</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {batch.breed || 'Mixed'} · {batch.house_number ? `House ${batch.house_number}` : 'No house'} · {ageWeeks}w old · Placed {fmt(batch.date_of_placement)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/dashboard/poultry/flock/${batch.id}/edit`}
              className="text-xs px-3 py-1.5 bg-[#0D0F14] hover:bg-[#161921] border border-[#2A2D35] text-[#9CA3AF] rounded-lg transition-colors"
            >
              Edit batch
            </Link>
            <div className="text-right">
              <p className="text-2xl font-semibold text-white">{batch.current_count.toLocaleString()}</p>
              <p className="text-xs text-[#6B7280]">of {(batch.initial_count ?? batch.current_count).toLocaleString()} placed</p>
            </div>
          </div>
        </div>

        {/* Incomplete batch banner */}
        {(!batch.source || !batch.housing_system || !batch.house_number || (!batch.target_weight_kg && !batch.expected_laying_date)) && (
          <div className="bg-amber-950 border border-amber-800 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-amber-400 text-base flex-shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-amber-300 text-sm font-bold">Batch details incomplete</p>
                <p className="text-amber-400/80 text-xs mt-0.5">
                  {[
                    !batch.source && 'source',
                    !batch.housing_system && 'housing system',
                    !batch.house_number && 'house/pen number',
                    (!batch.target_weight_kg && !batch.expected_laying_date) && (batch.bird_type === 'layer' || batch.bird_type === 'dual_purpose' ? 'expected laying date' : 'target weight'),
                  ].filter(Boolean).join(', ')} missing — add these for better performance tracking and financial reports.
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/poultry/flock/${batch.id}/edit`}
              className="flex-shrink-0 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            >
              Complete details
            </Link>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLayer && (
            <StatCard
              label="Hen-day production"
              value={henDayPct !== null ? `${henDayPct}%` : '—'}
              sub={henDayPct !== null ? (henDayPct >= 75 ? 'Good' : henDayPct >= 60 ? 'Average' : 'Below target') : 'No egg data'}
              icon={Egg}
              alert={henDayPct !== null && henDayPct < 60}
            />
          )}
          <StatCard
            label="Mortality rate"
            value={`${mortRatePct}%`}
            sub={`${totalMort} birds lost`}
            icon={Skull}
            alert={parseFloat(mortRatePct) > 5}
          />
          <StatCard
            label="Feed remaining"
            value={latestFeed?.days_remaining != null ? `${latestFeed.days_remaining}d` : '—'}
            sub={latestFeed ? `Last recorded ${fmtShort(latestFeed.record_date)}` : 'No feed data'}
            icon={Wheat}
            alert={!!latestFeed?.days_remaining && latestFeed.days_remaining <= 3}
          />
          <StatCard
            label="Total revenue"
            value={totalRevenue > 0 ? `KES ${totalRevenue.toLocaleString()}` : '—'}
            sub={`${salesRecords.length} sale${salesRecords.length !== 1 ? 's' : ''} recorded`}
            icon={DollarSign}
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2A2D35] overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key ? 'border-emerald-500 text-white' : 'border-transparent text-[#6B7280] hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4">
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-3">Batch details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Bird type',         value: BIRD_LABEL[batch.bird_type] },
                  { label: 'Breed',             value: batch.breed || 'Mixed / Unknown' },
                  { label: 'Date placed',       value: fmt(batch.date_of_placement) },
                  { label: 'Initial count',     value: (batch.initial_count ?? batch.current_count).toLocaleString() },
                  { label: 'Current count',     value: batch.current_count.toLocaleString() },
                  { label: 'Source',            value: batch.source || '—' },
                  { label: 'Cost / bird',       value: batch.purchase_price_per_bird ? `KES ${batch.purchase_price_per_bird}` : '—' },
                  { label: 'Total investment',  value: costOfBirds > 0 ? `KES ${costOfBirds.toLocaleString()}` : '—' },
                  { label: 'Housing system',    value: batch.housing_system || '—' },
                  { label: 'House / pen',       value: batch.house_number || '—' },
                  { label: batch.bird_type === 'broiler' ? 'Target weight' : 'Laying start',
                    value: batch.bird_type === 'broiler'
                      ? (batch.target_weight_kg ? `${batch.target_weight_kg} kg` : '—')
                      : (batch.expected_laying_date ? fmt(batch.expected_laying_date) : '—') },
                  { label: 'Status', value: batch.status },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-[#6B7280] mb-0.5">{label}</p>
                    <p className="text-xs font-medium text-white capitalize">{value}</p>
                  </div>
                ))}
              </div>
              {batch.notes && (
                <p className="text-xs text-[#6B7280] italic mt-4 pt-3 border-t border-[#2A2D35]">{batch.notes}</p>
              )}
            </div>

            {isLayer && (
              <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4">
                <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-3">Egg production — last 14 days</p>
                <div className="flex items-end gap-1 h-20">
                  {last14.map(({ date, eggs }) => (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-amber-700/70"
                        style={{ height: eggs > 0 ? `${Math.max(4, Math.round((eggs / maxEggs) * 72))}px` : '2px', opacity: eggs > 0 ? 1 : 0.2 }}
                        title={`${fmtShort(date)}: ${eggs} eggs`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#4B5563]">{fmtShort(last14[0].date)}</span>
                  <span className="text-[10px] text-[#4B5563]">{fmtShort(last14[13].date)}</span>
                </div>
              </div>
            )}

            {parseFloat(mortRatePct) > 5 && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/20">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-300">Mortality above 5% threshold</p>
                  <p className="text-xs text-red-400/80 mt-0.5">
                    {mortRatePct}% overall. Check disease history, biosecurity, and run the AI warnings analysis.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Eggs ─────────────────────────────────────────────────────────── */}
        {tab === 'eggs' && (
          <div className="space-y-2">
            {eggRecords.length === 0
              ? <p className="text-sm text-[#6B7280] py-8 text-center">No egg records in the last 90 days</p>
              : eggRecords.map(r => (
                <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                  <Egg size={13} className="text-amber-500/60 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.total_eggs} eggs</p>
                    <p className="text-xs text-[#6B7280]">{fmt(r.record_date)}{r.notes ? ` · ${r.notes}` : ''}</p>
                  </div>
                  {batch.current_count > 0 && (
                    <p className="text-xs text-[#6B7280] flex-shrink-0">
                      {Math.round((r.total_eggs / batch.current_count) * 100)}% HDP
                    </p>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* ── Feed ─────────────────────────────────────────────────────────── */}
        {tab === 'feed' && (
          <div className="space-y-2">
            {feedRecords.length === 0
              ? <p className="text-sm text-[#6B7280] py-8 text-center">No feed records in the last 90 days</p>
              : feedRecords.map(r => (
                <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                  <Wheat size={13} className="text-emerald-500/60 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.quantity_kg} kg — {r.feed_type?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-[#6B7280]">{fmt(r.record_date)}{r.notes ? ` · ${r.notes}` : ''}</p>
                  </div>
                  {r.days_remaining != null && (
                    <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${
                      r.days_remaining <= 3 ? 'text-red-400 border-red-900/40 bg-red-950/20'
                      : r.days_remaining <= 7 ? 'text-amber-400 border-amber-900/40 bg-amber-950/20'
                      : 'text-[#6B7280] border-[#2A2D35] bg-[#0A0C10]'
                    }`}>
                      {r.days_remaining}d left
                    </span>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* ── Health ───────────────────────────────────────────────────────── */}
        {tab === 'health' && (
          <div className="space-y-2">
            {healthRecords.length === 0
              ? <p className="text-sm text-[#6B7280] py-8 text-center">No health records for this batch</p>
              : healthRecords.map(r => (
                <div key={r.id} className="flex items-start gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                  <Syringe size={13} className="text-blue-500/60 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white capitalize">{r.event_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-[#6B7280]">{fmt(r.record_date)}{r.notes ? ` · ${r.notes}` : ''}</p>
                  </div>
                  {r.next_due_date && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-[#6B7280]">Next due</p>
                      <p className={`text-xs ${r.next_due_date < new Date().toISOString().split('T')[0] ? 'text-red-400' : 'text-amber-400'}`}>
                        {fmtShort(r.next_due_date)}
                      </p>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* ── Mortality ────────────────────────────────────────────────────── */}
        {tab === 'mortality' && (
          <div className="space-y-2">
            {mortRecords.length === 0
              ? <p className="text-sm text-[#6B7280] py-8 text-center">No mortality records in the last 90 days</p>
              : mortRecords.map(r => (
                <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                  <Skull size={13} className="text-red-500/60 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.count_dead} bird{r.count_dead !== 1 ? 's' : ''} lost</p>
                    <p className="text-xs text-[#6B7280]">{fmt(r.record_date)}{r.notes ? ` · ${r.notes}` : ''}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-400 flex-shrink-0">-{r.count_dead}</p>
                </div>
              ))
            }
          </div>
        )}

        {/* ── Sales ────────────────────────────────────────────────────────── */}
        {tab === 'sales' && (
          <div className="space-y-2">
            {salesRecords.length === 0
              ? <p className="text-sm text-[#6B7280] py-8 text-center">No sales recorded for this batch</p>
              : salesRecords.map(r => (
                <div key={r.id} className="flex items-start gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                  <ShoppingCart size={13} className="text-emerald-500/60 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {r.quantity} {r.unit} — {r.sale_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {fmt(r.sale_date)} · {r.buyer_name || 'Unknown buyer'} · {r.market || 'Unknown market'} · {r.payment_method}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-white">KES {(r.total_price ?? 0).toLocaleString()}</p>
                    <p className="text-[11px] text-[#6B7280]">@ {r.price_per_unit}/unit</p>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── Financials ───────────────────────────────────────────────────── */}
        {tab === 'financials' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Bird cost',     value: costOfBirds,   note: `${batch.initial_count ?? batch.current_count} birds × KES ${batch.purchase_price_per_bird ?? 0}` },
                { label: 'Total revenue', value: totalRevenue,  note: `${salesRecords.length} sales recorded` },
                { label: 'Gross margin',  value: grossMargin,   note: 'Revenue minus bird cost' },
                { label: 'Margin %',      value: costOfBirds > 0 ? Math.round((grossMargin / costOfBirds) * 100) : 0, note: 'Return on bird investment', isPercent: true },
              ].map(({ label, value, note, isPercent }: any) => (
                <div key={label} className={`rounded-lg border p-4 ${
                  label === 'Gross margin' && value < 0 ? 'border-red-900/40 bg-red-950/20' :
                  label === 'Gross margin' && value > 0 ? 'border-emerald-900/40 bg-emerald-950/20' :
                  'border-[#2A2D35] bg-[#0D0F14]'
                }`}>
                  {label === 'Gross margin' && (
                    value >= 0
                      ? <TrendingUp size={13} className="text-emerald-400 mb-2" />
                      : <TrendingDown size={13} className="text-red-400 mb-2" />
                  )}
                  <p className={`text-xl font-semibold ${
                    label === 'Gross margin' ? (value >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white'
                  }`}>
                    {isPercent ? `${value}%` : `KES ${value.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{label}</p>
                  <p className="text-[11px] text-[#4B5563]">{note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-[#2A2D35] bg-[#0A0C10] px-4 py-3">
              <p className="text-xs text-[#4B5563]">
                Feed costs are not included in this margin calculation as cost-per-kg is not currently captured in feed records.
                Add a cost field to your feed records to get a full P&L.
              </p>
            </div>

            {salesRecords.length > 0 && (
              <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                <div className="px-4 py-3 border-b border-[#2A2D35]">
                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Revenue breakdown</p>
                </div>
                {salesRecords.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-4 py-3 border-b border-[#1F2128] last:border-0">
                    <div className="flex-1">
                      <p className="text-sm text-white">{r.sale_type.replace(/_/g, ' ')} · {r.quantity} {r.unit}</p>
                      <p className="text-xs text-[#6B7280]">{fmtShort(r.sale_date)} · {r.buyer_name || '—'}</p>
                    </div>
                    <p className="text-sm font-medium text-white flex-shrink-0">KES {(r.total_price ?? 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
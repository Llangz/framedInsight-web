'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TreePine, FlaskConical, Scissors, Leaf, Package, Activity,
  Plus, ArrowLeft, Users, Calendar, ChevronRight,
} from 'lucide-react'
import type { Tables } from '@/lib/database.types'

interface ActivityItem {
  id: string
  activity_type: string
  activity_date: string
  plot_id: string | null
  plot_name?: string
  weeding_method: string | null
  fertilizer_type: string | null
  spray_type: string | null
  pruning_type: string | null
  product_name: string | null
  labour_mode: string | null
  num_workers: number | null
  days_worked: number | null
  rate_per_day: number | null
  cost_inputs: number
  cost_labour: number
  total_cost: number
  notes: string | null
}

interface CalendarRec {
  type: string
  label: string
  priority: 'high' | 'medium' | 'low'
  notes: string
}

type SeasonCost = Tables<'v_season_cost_summary'>

// ── Config ────────────────────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<string, {
  icon: React.ElementType
  label: string
}> = {
  weeding:    { icon: Leaf,        label: 'Weeding'    },
  fertilizer: { icon: Package,     label: 'Fertilizer' },
  spraying:   { icon: FlaskConical,label: 'Spraying'   },
  pruning:    { icon: Scissors,    label: 'Pruning'    },
  mulching:   { icon: TreePine,    label: 'Mulching'   },
  other:      { icon: Activity,    label: 'Other'      },
}

const PRIORITY_CLASSES = {
  high:   'border-red-900/40 bg-red-950/20',
  medium: 'border-amber-900/40 bg-amber-950/20',
  low:    'border-[#2A2D35] bg-[#0D0F14]',
}
const PRIORITY_DOT = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-[#4B5563]',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActivitySummary(a: ActivityItem): string {
  if (a.activity_type === 'weeding') {
    const m: Record<string, string> = {
      herbicide: 'Herbicide', manual_jembe: 'Jembe (manual)',
      slashing: 'Slashing', combined: 'Combined',
    }
    return m[a.weeding_method || ''] || 'Weeding'
  }
  if (a.activity_type === 'fertilizer') return a.product_name || a.fertilizer_type || 'Fertilizer'
  if (a.activity_type === 'spraying') return a.product_name || a.spray_type || 'Spraying'
  if (a.activity_type === 'pruning') {
    const t: Record<string, string> = {
      frame_pruning: 'Frame Pruning', de_suckering: 'De-suckering',
      stumping: 'Stumping', tipping: 'Tipping', selective_pruning: 'Selective',
    }
    return t[a.pruning_type || ''] || 'Pruning'
  }
  return a.product_name || a.activity_type
}

function getLabourSummary(a: ActivityItem): string {
  if (a.labour_mode === 'own_labour') return 'Own labour'
  if (a.labour_mode === 'piece_work') return 'Piece work'
  if (a.num_workers && a.days_worked && a.rate_per_day)
    return `${a.num_workers} worker${a.num_workers > 1 ? 's' : ''} × ${a.days_worked}d @ KES ${a.rate_per_day}/day`
  return ''
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActivitiesClient({
  initialActivities,
  calendarRecs,
  seasonCosts,
  currentYear,
}: {
  initialActivities: ActivityItem[]
  calendarRecs: CalendarRec[]
  seasonCosts: SeasonCost[]
  currentYear: number
}) {
  const [filterType, setFilterType] = useState<string>('all')
  const currentMonthName = new Date().toLocaleString('en-KE', { month: 'long' })

  const filtered = useMemo(() =>
    filterType === 'all'
      ? initialActivities
      : initialActivities.filter(a => a.activity_type === filterType),
    [initialActivities, filterType]
  )

  const totalCost   = seasonCosts.reduce((s, c) => s + (c.total_cost ?? 0), 0)
  const inputCost   = seasonCosts.reduce((s, c) => s + (c.total_input_cost ?? 0), 0)
  const labourCost  = seasonCosts.reduce((s, c) => s + (c.total_labour_cost ?? 0), 0)
  const highPrio    = calendarRecs.filter(r => r.priority === 'high')

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-2">Coffee</p>
            <h1 className="text-xl font-semibold text-white tracking-tight">Farm Activities</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {initialActivities.length} recorded · {currentYear} season
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/coffee"
              className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors mt-1"
            >
              <ArrowLeft size={13} />
              Coffee
            </Link>
            <Link
              href="/dashboard/coffee/activities/record"
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={12} strokeWidth={2.5} />
              Record
            </Link>
          </div>
        </div>

        {/* Monthly recommendations */}
        {calendarRecs.length > 0 && (
          <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] divide-y divide-[#1F2128]">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-[#6B7280]" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-white">{currentMonthName} Recommendations</p>
              </div>
              {highPrio.length > 0 && (
                <span className="text-xs font-medium text-red-400 bg-red-950/50 border border-red-900/50 px-2 py-0.5 rounded-md">
                  {highPrio.length} urgent
                </span>
              )}
            </div>
            <div className="divide-y divide-[#1F2128]">
              {calendarRecs.map((rec, i) => {
                const cfg = ACTIVITY_CONFIG[rec.type] || ACTIVITY_CONFIG.other
                const Icon = cfg.icon
                return (
                  <div key={i} className={`flex items-start gap-4 px-5 py-4 border-l-2 ${
                    rec.priority === 'high' ? 'border-l-red-500' :
                    rec.priority === 'medium' ? 'border-l-amber-400' : 'border-l-transparent'
                  }`}>
                    <div className="mt-0.5 p-2 rounded-md bg-[#17191F] border border-[#2A2D35] flex-shrink-0">
                      <Icon size={12} className="text-[#6B7280]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{rec.label}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{rec.notes}</p>
                    </div>
                    <Link
                      href={`/dashboard/coffee/activities/record?type=${rec.type}`}
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-[#6B7280] hover:text-white transition-colors mt-0.5"
                    >
                      Record <ChevronRight size={11} />
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Season cost breakdown */}
        {seasonCosts.length > 0 && (
          <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] divide-y divide-[#1F2128]">
            <div className="px-5 py-4">
              <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">{currentYear} Season Costs</p>
            </div>
            {/* Summary cells */}
            <div className="grid grid-cols-3 gap-px bg-[#1F2128]">
              {[
                { label: 'Total',   value: totalCost,  accent: 'text-white' },
                { label: 'Inputs',  value: inputCost,  accent: 'text-[#9CA3AF]' },
                { label: 'Labour',  value: labourCost, accent: 'text-[#9CA3AF]' },
              ].map(({ label, value, accent }) => (
                <div key={label} className="bg-[#0D0F14] px-5 py-4">
                  <p className="text-[11px] text-[#4B5563] uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-base font-semibold tabular-nums ${accent}`}>
                    KES {value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            {/* Per-activity breakdown */}
            <div className="px-5 py-4 space-y-3">
              {[...seasonCosts]
                .sort((a, b) => (b.total_cost ?? 0) - (a.total_cost ?? 0))
                .map(cost => {
                  const cfg = ACTIVITY_CONFIG[cost.activity_type ?? 'other'] || ACTIVITY_CONFIG.other
                  const Icon = cfg.icon
                  const pct = totalCost > 0 ? ((cost.total_cost ?? 0) / totalCost) * 100 : 0
                  return (
                    <div key={cost.activity_type ?? 'unknown'}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                          <Icon size={12} className="text-[#4B5563]" strokeWidth={1.5} />
                          {cfg.label}
                          <span className="text-xs text-[#4B5563]">({cost.activity_count ?? 0}×)</span>
                        </span>
                        <span className="text-sm font-medium text-white tabular-nums">
                          KES {(cost.total_cost ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-px bg-[#1F2128] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border ${
              filterType === 'all'
                ? 'bg-[#17191F] border-[#3A3D45] text-white'
                : 'border-[#2A2D35] text-[#6B7280] hover:text-[#9CA3AF]'
            }`}
          >
            All · {initialActivities.length}
          </button>
          {Object.entries(ACTIVITY_CONFIG).map(([type, cfg]) => {
            const count = initialActivities.filter(a => a.activity_type === type).length
            if (!count) return null
            const Icon = cfg.icon
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border ${
                  filterType === type
                    ? 'bg-[#17191F] border-[#3A3D45] text-white'
                    : 'border-[#2A2D35] text-[#6B7280] hover:text-[#9CA3AF]'
                }`}
              >
                <Icon size={11} strokeWidth={1.5} />
                {cfg.label} · {count}
              </button>
            )
          })}
        </div>

        {/* Activity list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-[#2A2D35] rounded-lg">
            <Activity size={20} className="text-[#2A2D35]" strokeWidth={1} />
            <p className="text-sm text-[#4B5563]">No activities recorded yet</p>
            <Link
              href="/dashboard/coffee/activities/record"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Record first activity →
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-[#2A2D35] overflow-hidden divide-y divide-[#1F2128]">
            {filtered.map(a => {
              const cfg = ACTIVITY_CONFIG[a.activity_type] || ACTIVITY_CONFIG.other
              const Icon = cfg.icon
              const labour = getLabourSummary(a)
              return (
                <div key={a.id} className="bg-[#0D0F14] px-5 py-4 hover:bg-[#111318] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-md bg-[#17191F] border border-[#2A2D35] flex-shrink-0">
                      <Icon size={13} className="text-[#6B7280]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{getActivitySummary(a)}</p>
                          <p className="text-xs text-[#4B5563] mt-0.5">
                            {a.plot_name ? `${a.plot_name} · ` : ''}{fmtDate(a.activity_date)}
                          </p>
                        </div>
                        {a.total_cost > 0 && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-white tabular-nums">
                              KES {a.total_cost.toLocaleString()}
                            </p>
                            {(a.cost_inputs > 0 || a.cost_labour > 0) && (
                              <p className="text-[11px] text-[#4B5563] mt-0.5">
                                {a.cost_inputs > 0 && `I: ${a.cost_inputs.toLocaleString()}`}
                                {a.cost_inputs > 0 && a.cost_labour > 0 && ' · '}
                                {a.cost_labour > 0 && `L: ${a.cost_labour.toLocaleString()}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {labour && (
                        <p className="flex items-center gap-1.5 text-xs text-[#6B7280] mt-1.5">
                          <Users size={10} strokeWidth={1.5} />
                          {labour}
                        </p>
                      )}
                      {a.notes && (
                        <p className="text-xs text-[#4B5563] mt-1 truncate italic">{a.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick record links */}
        <div>
          <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-3">Quick Record</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(ACTIVITY_CONFIG).map(([type, cfg]) => {
              const Icon = cfg.icon
              return (
                <Link
                  key={type}
                  href={`/dashboard/coffee/activities/record?type=${type}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2A2D35] rounded-md text-xs text-[#6B7280] hover:text-white hover:border-[#3A3D45] transition-colors"
                >
                  <Icon size={11} strokeWidth={1.5} />
                  {cfg.label}
                </Link>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
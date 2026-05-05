'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Tables } from '@/lib/database.types'

interface Activity {
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

const ACTIVITY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  weeding: { icon: '🌿', label: 'Weeding', color: 'bg-green-100 text-green-800 border-green-200' },
  fertilizer: { icon: '🌱', label: 'Fertilizer', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  spraying: { icon: '💧', label: 'Spraying', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  pruning: { icon: '✂️', label: 'Pruning', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  mulching: { icon: '🍂', label: 'Mulching', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  other: { icon: '📋', label: 'Other', color: 'bg-gray-100 text-gray-800 border-gray-200' },
}

const PRIORITY_COLOR = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  low: 'bg-gray-50 border-gray-200 text-gray-600',
}

function getActivitySummary(a: Activity): string {
  if (a.activity_type === 'weeding') {
    const methods: Record<string, string> = {
      herbicide: 'Herbicide', manual_jembe: 'Jembe (manual)',
      slashing: 'Slashing', combined: 'Combined'
    }
    return methods[a.weeding_method || ''] || 'Weeding'
  }
  if (a.activity_type === 'fertilizer') return a.product_name || a.fertilizer_type || 'Fertilizer'
  if (a.activity_type === 'spraying') return a.product_name || a.spray_type || 'Spraying'
  if (a.activity_type === 'pruning') {
    const types: Record<string, string> = {
      frame_pruning: 'Frame Pruning', de_suckering: 'De-suckering',
      stumping: 'Stumping', tipping: 'Tipping', selective_pruning: 'Selective'
    }
    return types[a.pruning_type || ''] || 'Pruning'
  }
  return a.product_name || a.activity_type
}

function getLabourSummary(a: Activity): string {
  if (a.labour_mode === 'own_labour') return 'Own labour'
  if (a.labour_mode === 'piece_work') return `Piece work`
  if (a.num_workers && a.days_worked && a.rate_per_day) {
    return `${a.num_workers} worker${a.num_workers > 1 ? 's' : ''} × ${a.days_worked}d @ KES ${a.rate_per_day}/day`
  }
  return '—'
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ActivitiesClient({
  initialActivities,
  calendarRecs,
  seasonCosts,
  currentYear
}: {
  initialActivities: Activity[]
  calendarRecs: CalendarRec[]
  seasonCosts: SeasonCost[]
  currentYear: number
}) {
  const [filterType, setFilterType] = useState<string>('all')
  const currentMonthName = new Date().toLocaleString('en-KE', { month: 'long' })

  const filteredActivities = useMemo(() =>
    filterType === 'all'
      ? initialActivities
      : initialActivities.filter(a => a.activity_type === filterType),
    [initialActivities, filterType]
  )

  const totalSeasonCost = seasonCosts.reduce((s, c) => s + (c.total_cost ?? 0), 0)
  const totalInputCost = seasonCosts.reduce((s, c) => s + (c.total_input_cost ?? 0), 0)
  const totalLabourCost = seasonCosts.reduce((s, c) => s + (c.total_labour_cost ?? 0), 0)
  const highPriorityRecs = calendarRecs.filter(r => r.priority === 'high')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Farm Activities</h1>
            <p className="text-gray-500 text-sm mt-1">
              {initialActivities.length} recorded · {currentYear} season
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/coffee" className="text-sm text-gray-500 hover:text-gray-800">
              ← Coffee
            </Link>
            <Link
              href="/dashboard/coffee/activities/record"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-1"
            >
              + Record Activity
            </Link>
          </div>
        </div>

        {calendarRecs.length > 0 && (
          <div className="mb-5 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                📅 {currentMonthName} Recommendations
              </h2>
              {highPriorityRecs.length > 0 && (
                <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  {highPriorityRecs.length} urgent
                </span>
              )}
            </div>
            <div className="space-y-2">
              {calendarRecs.map((rec, i) => {
                const cfg = ACTIVITY_CONFIG[rec.type] || ACTIVITY_CONFIG.other
                return (
                  <div key={i} className={`p-3 rounded-lg border ${PRIORITY_COLOR[rec.priority]} flex gap-3`}>
                    <span className="text-lg shrink-0 mt-0.5">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{rec.label}</p>
                      <p className="text-xs opacity-80 mt-0.5">{rec.notes}</p>
                    </div>
                    <Link
                      href={`/dashboard/coffee/activities/record?type=${rec.type}`}
                      className="shrink-0 text-xs font-medium underline opacity-70 hover:opacity-100 mt-1"
                    >
                      Record →
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {seasonCosts.length > 0 && (
          <div className="mb-5 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              {currentYear} Season Costs
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Spent</p>
                <p className="text-lg font-bold text-gray-900">KES {totalSeasonCost.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600">Inputs</p>
                <p className="text-lg font-bold text-blue-800">KES {totalInputCost.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600">Labour</p>
                <p className="text-lg font-bold text-amber-800">KES {totalLabourCost.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              {seasonCosts
                .sort((a, b) => (b.total_cost ?? 0) - (a.total_cost ?? 0))
                .map(cost => {
                  const cfg = ACTIVITY_CONFIG[cost.activity_type ?? 'other'] || ACTIVITY_CONFIG.other
                  const pct = totalSeasonCost > 0 ? ((cost.total_cost ?? 0) / totalSeasonCost) * 100 : 0
                  return (
                    <div key={cost.activity_type ?? 'unknown'}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5 text-gray-700">
                          {cfg.icon} {cfg.label}
                          <span className="text-xs text-gray-400">({cost.activity_count ?? 0}×)</span>
                        </span>
                        <span className="font-medium text-gray-900">
                          KES {(cost.total_cost ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterType === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
          >
            All ({initialActivities.length})
          </button>
          {Object.entries(ACTIVITY_CONFIG).map(([type, cfg]) => {
            const count = initialActivities.filter(a => a.activity_type === type).length
            if (count === 0) return null
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${filterType === type
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
              >
                {cfg.icon} {cfg.label} ({count})
              </button>
            )
          })}
        </div>

        {filteredActivities.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="text-5xl mb-4">🌿</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No activities recorded yet</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              Start tracking your farm activities to monitor costs and follow seasonal recommendations.
            </p>
            <Link
              href="/dashboard/coffee/activities/record"
              className="inline-block px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Record First Activity
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map(activity => {
              const cfg = ACTIVITY_CONFIG[activity.activity_type] || ACTIVITY_CONFIG.other
              return (
                <div
                  key={activity.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 border ${cfg.color}`}>
                      {cfg.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {getActivitySummary(activity)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {activity.plot_name && `${activity.plot_name} · `}
                            {fmtDate(activity.activity_date)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {activity.total_cost > 0 && (
                            <p className="text-sm font-bold text-gray-900">
                              KES {activity.total_cost.toLocaleString()}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">total</p>
                        </div>
                      </div>

                      {(activity.cost_inputs > 0 || activity.cost_labour > 0) && (
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          {activity.cost_inputs > 0 && (
                            <span>Inputs: KES {activity.cost_inputs.toLocaleString()}</span>
                          )}
                          {activity.cost_labour > 0 && (
                            <span>Labour: KES {activity.cost_labour.toLocaleString()}</span>
                          )}
                        </div>
                      )}

                      {activity.labour_mode && (
                        <p className="text-xs text-gray-400 mt-1">
                          👷 {getLabourSummary(activity)}
                        </p>
                      )}

                      {activity.notes && (
                        <p className="text-xs text-gray-500 mt-1.5 italic truncate">
                          "{activity.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 mb-8">
          <p className="text-xs text-gray-400 mb-2">Quick record:</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(ACTIVITY_CONFIG).map(([type, cfg]) => (
              <Link
                key={type}
                href={`/dashboard/coffee/activities/record?type=${type}`}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-green-400 hover:text-green-700 flex items-center gap-1 transition-colors"
              >
                {cfg.icon} {cfg.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

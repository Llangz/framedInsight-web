'use client'

// ═══════════════════════════════════════════════════════════════════════════
// NDVITrendChart.tsx — Upgraded Satellite Health Chart
// Location: /app/dashboard/coffee/satellite/components/NDVITrendChart.tsx
//
// Features:
//  ✅ Multi-line chart per plot
//  ✅ Agronomic tooltip with context-aware insights
//  ✅ 🌧 Rainfall overlay via Open-Meteo API (no API key needed)
//  ✅ 🤖 Rule-based agronomic recommendations per plot
//  ✅ Health zone bands (Good / Watch / Stress / Critical)
//  ✅ CSV export
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  TooltipProps,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendDataPoint {
  date: string
  plot_id: string
  plot_name: string
  ndvi: number | null
  health_score: number | null
  alert_triggered: boolean
  anomaly?: boolean
  /** Optional — pass if available from your satellite view */
  ndwi?: number | null
  weeks_of_decline?: number | null
}

interface PlotCoordinates {
  lat: number
  lon: number
}

interface NDVITrendChartProps {
  data: TrendDataPoint[]
  /** Map of plot_id → { lat, lon } for rainfall fetch */
  plotCoordinates?: Record<string, PlotCoordinates>
  selectedPlots?: string[]
}

interface RainfallPoint {
  date: string
  rainfall_mm: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLOT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#14b8a6', // teal
  '#84cc16', // lime
]

// NDVI health thresholds for coffee (Coffea arabica, Kenya highlands)
const NDVI_ZONES = {
  CRITICAL: 0.35,
  STRESS:   0.50,
  WATCH:    0.65,
  GOOD:     0.80,
}

// ─── Agronomic Recommendation Engine ─────────────────────────────────────────
//
// Rule priority (highest → lowest):
//  1. Multi-week decline → urgent scouting
//  2. Critical NDVI       → disease / severe stress
//  3. Low NDWI            → water stress
//  4. Low NDVI (stress)   → nutrition / canopy issue
//  5. Improving trend     → positive reinforcement
//  6. Healthy             → maintain

interface Recommendation {
  priority: 'urgent' | 'warning' | 'info' | 'good'
  icon: string
  title: string
  detail: string
}

function getRecommendation(
  plotName: string,
  latestNdvi: number | null,
  previousNdvi: number | null,
  weeksOfDecline: number,
  latestNdwi: number | null,
  alertTriggered: boolean,
): Recommendation {
  const ndvi = latestNdvi ?? 0
  const prevNdvi = previousNdvi ?? ndvi
  const trend = ndvi - prevNdvi // positive = improving

  // Rule 1 — prolonged decline
  if (weeksOfDecline >= 3 || alertTriggered) {
    return {
      priority: 'urgent',
      icon: '🚨',
      title: `Scout ${plotName} immediately`,
      detail: `${weeksOfDecline > 0 ? `${weeksOfDecline}-week` : 'Triggered'} NDVI decline. Possible CBD, leaf rust, or severe drought. Physical inspection required before next spray window.`,
    }
  }

  // Rule 2 — critical NDVI level
  if (ndvi < NDVI_ZONES.CRITICAL) {
    return {
      priority: 'urgent',
      icon: '⚠️',
      title: `Critical canopy loss — ${plotName}`,
      detail: `NDVI ${ndvi.toFixed(3)} is severely low. Likely defoliation from disease or drought. Confirm CBD/leaf rust presence. Consider emergency foliar spray and soil moisture check.`,
    }
  }

  // Rule 3 — water stress signal
  if (latestNdwi != null && latestNdwi < -0.2) {
    return {
      priority: 'warning',
      icon: '💧',
      title: `Water stress detected — ${plotName}`,
      detail: `NDWI ${latestNdwi.toFixed(3)} indicates moisture deficit. If no rainfall in 14+ days, consider supplemental irrigation. Check mulch coverage and soil structure.`,
    }
  }

  // Rule 4 — stress zone, declining
  if (ndvi < NDVI_ZONES.STRESS && trend < -0.02) {
    return {
      priority: 'warning',
      icon: '🌿',
      title: `Apply nitrogen to ${plotName}`,
      detail: `NDVI ${ndvi.toFixed(3)} with declining trend (${(trend * 100).toFixed(1)}% change). Low chlorophyll signal. Apply CAN or top-dress with 50kg/ha NPK before next rains. Monitor for 2 weeks.`,
    }
  }

  // Rule 5 — watch zone
  if (ndvi < NDVI_ZONES.WATCH) {
    return {
      priority: 'warning',
      icon: '👁',
      title: `Monitor ${plotName} closely`,
      detail: `NDVI ${ndvi.toFixed(3)} is in the Watch zone. Schedule a field check within 7 days. Check for early-stage CBD, iron deficiency, or shade imbalance.`,
    }
  }

  // Rule 6 — recovering / improving
  if (trend > 0.03 && ndvi >= NDVI_ZONES.WATCH) {
    return {
      priority: 'info',
      icon: '📈',
      title: `${plotName} responding well`,
      detail: `NDVI improving by ${(trend * 100).toFixed(1)}%. Recent inputs or rains are working. Maintain current program. Re-assess in 2 weeks.`,
    }
  }

  // Rule 7 — healthy & stable
  return {
    priority: 'good',
    icon: '✅',
    title: `${plotName} is healthy`,
    detail: `NDVI ${ndvi.toFixed(3)} — good canopy cover. Continue standard farm calendar: timely pruning, copper fungicide before long rains, and soil testing this season.`,
  }
}

// ─── Agronomic Tooltip ────────────────────────────────────────────────────────

function ndviToContext(ndvi: number | null): string {
  if (ndvi === null) return 'No data'
  if (ndvi >= NDVI_ZONES.GOOD)     return 'Dense healthy canopy — excellent photosynthesis'
  if (ndvi >= NDVI_ZONES.WATCH)    return 'Good canopy — monitor for changes'
  if (ndvi >= NDVI_ZONES.STRESS)   return 'Reduced canopy — check nutrition & pests'
  if (ndvi >= NDVI_ZONES.CRITICAL) return 'Stress detected — inspect within 48h'
  return 'Critical — possible disease or severe drought'
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  const date = new Date(label)
  const formattedDate = date.toLocaleDateString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const ndviEntries = payload.filter((p: any) => p.dataKey?.toString().startsWith('ndvi_'))
  const rainfallEntry = payload.find((p: any) => p.dataKey === 'rainfall_mm')

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 max-w-xs">
      <p className="text-xs font-bold text-slate-700 mb-2">{formattedDate}</p>

      {/* NDVI readings */}
      {ndviEntries.map((entry: any) => {
        const ndvi = entry.value as number | null
        const color = entry.color
        return (
          <div key={entry.dataKey} className="mb-2 last:mb-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-slate-800">{entry.name}</span>
              <span className="text-xs font-bold ml-auto" style={{ color }}>
                {ndvi !== null ? ndvi.toFixed(3) : '—'}
              </span>
            </div>
            <p className="text-xs text-slate-500 pl-4">{ndviToContext(ndvi)}</p>
          </div>
        )
      })}

      {/* Rainfall */}
      {rainfallEntry && rainfallEntry.value != null && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
          <span className="text-xs">🌧</span>
          <span className="text-xs text-slate-600">
            {(rainfallEntry.value as number).toFixed(1)} mm rainfall
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Open-Meteo Rainfall Fetch ────────────────────────────────────────────────
//
// Fetches daily precipitation for a single coordinate over the chart date range.
// Uses the first available plot coordinate (rainfall is farm-level granularity
// for small farms; if plots are far apart, pass the farm centroid).

async function fetchRainfall(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<RainfallPoint[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',  lat.toString())
  url.searchParams.set('longitude', lon.toString())
  url.searchParams.set('daily',     'precipitation_sum')
  url.searchParams.set('timezone',  'Africa/Nairobi')
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date',   endDate)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Open-Meteo fetch failed')

  const json = await res.json()
  const dates: string[]  = json.daily?.time ?? []
  const rain: number[]   = json.daily?.precipitation_sum ?? []

  return dates.map((d, i) => ({ date: d, rainfall_mm: rain[i] ?? 0 }))
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NDVITrendChart({
  data,
  plotCoordinates,
  selectedPlots,
}: NDVITrendChartProps) {

  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('90d')
  const [showHealthZones, setShowHealthZones] = useState(true)
  const [showRainfall, setShowRainfall]       = useState(true)
  const [rainfall, setRainfall]               = useState<RainfallPoint[]>([])
  const [rainfallLoading, setRainfallLoading] = useState(false)
  const [activeTab, setActiveTab]             = useState<'chart' | 'recommendations'>('chart')

  // ── Filter by time range ───────────────────────────────────────────────────
  const now = new Date()
  const filteredData = useMemo(() => data.filter(d => {
    const date = new Date(d.date)
    const daysDiff = (now.getTime() - date.getTime()) / 86_400_000
    switch (timeRange) {
      case '30d': return daysDiff <= 30
      case '90d': return daysDiff <= 90
      case '1y':  return daysDiff <= 365
      default:    return true
    }
  }), [data, timeRange])

  // ── Unique plots ───────────────────────────────────────────────────────────
  const plots = useMemo(() => {
    const seen = new Set<string>()
    return filteredData
      .filter(d => !selectedPlots || selectedPlots.includes(d.plot_id))
      .filter(d => { if (seen.has(d.plot_id)) return false; seen.add(d.plot_id); return true })
      .map((d, i) => ({
        id:    d.plot_id,
        name:  d.plot_name,
        color: PLOT_COLORS[i % PLOT_COLORS.length],
      }))
  }, [filteredData, selectedPlots])

  // ── Pivot data into recharts format ───────────────────────────────────────
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, any>>()

    filteredData
      .filter(d => !selectedPlots || selectedPlots.includes(d.plot_id))
      .forEach(point => {
        if (!dateMap.has(point.date)) dateMap.set(point.date, { date: point.date })
        const entry = dateMap.get(point.date)!
        entry[`ndvi_${point.plot_id}`]  = point.ndvi
        entry[`alert_${point.plot_id}`] = point.alert_triggered
        entry[`anomaly_${point.plot_id}`] = point.anomaly
      })

    // Merge rainfall
    rainfall.forEach(r => {
      if (dateMap.has(r.date)) {
        dateMap.get(r.date)!.rainfall_mm = r.rainfall_mm
      }
    })

    return Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [filteredData, selectedPlots, rainfall])

  // ── Date range for rainfall fetch ─────────────────────────────────────────
  const dateRange = useMemo(() => {
    const dates = filteredData.map(d => d.date).sort()
    return {
      start: dates[0] ?? new Date().toISOString().split('T')[0],
      end:   dates[dates.length - 1] ?? new Date().toISOString().split('T')[0],
    }
  }, [filteredData])

  // ── Fetch rainfall when coords / range changes ────────────────────────────
  useEffect(() => {
    if (!plotCoordinates) return
    const coords = Object.values(plotCoordinates)[0]
    if (!coords) return

    setRainfallLoading(true)
    fetchRainfall(coords.lat, coords.lon, dateRange.start, dateRange.end)
      .then(setRainfall)
      .catch(console.error)
      .finally(() => setRainfallLoading(false))
  }, [plotCoordinates, dateRange.start, dateRange.end])

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = useMemo(() => {
    return plots.map(plot => {
      const plotPoints = filteredData
        .filter(d => d.plot_id === plot.id && d.ndvi !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      const latest   = plotPoints[plotPoints.length - 1]
      const previous = plotPoints[plotPoints.length - 2]

      const weeksOfDecline = latest?.weeks_of_decline ?? (() => {
        // Derive from data if not provided: count consecutive declining points
        let count = 0
        for (let i = plotPoints.length - 1; i > 0; i--) {
          if ((plotPoints[i].ndvi ?? 0) < (plotPoints[i - 1].ndvi ?? 0)) count++
          else break
        }
        return count
      })()

      return {
        plot,
        rec: getRecommendation(
          plot.name,
          latest?.ndvi ?? null,
          previous?.ndvi ?? null,
          weeksOfDecline,
          latest?.ndwi ?? null,
          latest?.alert_triggered ?? false,
        ),
      }
    })
  }, [plots, filteredData])

  // ── CSV export ────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    const headers = ['Date', ...plots.map(p => `${p.name} NDVI`), 'Rainfall (mm)']
    const rows = chartData.map(row => [
      row.date,
      ...plots.map(p => row[`ndvi_${p.id}`] ?? ''),
      row.rainfall_mm ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ndvi-trend-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Recommendation priority styling ───────────────────────────────────────
  const priorityStyle = {
    urgent:  'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    good:    'bg-emerald-50 border-emerald-200 text-emerald-800',
  }

  const urgentCount = recommendations.filter(r => r.rec.priority === 'urgent').length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Tab row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'chart'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📈 Chart
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'recommendations'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🤖 Recommendations
            {urgentCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {urgentCount}
              </span>
            )}
          </button>
        </div>

        {/* Chart controls — only shown on chart tab */}
        {activeTab === 'chart' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Time range */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(['30d', '90d', '1y', 'all'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    timeRange === r
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {r === 'all' ? 'All' : r.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Toggles */}
            <button
              onClick={() => setShowHealthZones(v => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                showHealthZones
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              Zones
            </button>

            {plotCoordinates && (
              <button
                onClick={() => setShowRainfall(v => !v)}
                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                  showRainfall
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                {rainfallLoading ? '⏳' : '🌧'} Rain
              </button>
            )}

            <button
              onClick={downloadCsv}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              CSV
            </button>
          </div>
        )}
      </div>

      {/* ── CHART TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'chart' && (
        <>
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

              {/* Health zone bands */}
              {showHealthZones && (
                <>
                  <ReferenceArea y1={0}                    y2={NDVI_ZONES.CRITICAL} fill="#fee2e2" fillOpacity={0.25} />
                  <ReferenceArea y1={NDVI_ZONES.CRITICAL}  y2={NDVI_ZONES.STRESS}   fill="#fed7aa" fillOpacity={0.20} />
                  <ReferenceArea y1={NDVI_ZONES.STRESS}    y2={NDVI_ZONES.WATCH}    fill="#fef9c3" fillOpacity={0.20} />
                  <ReferenceArea y1={NDVI_ZONES.WATCH}     y2={NDVI_ZONES.GOOD}     fill="#d1fae5" fillOpacity={0.20} />
                  <ReferenceArea y1={NDVI_ZONES.GOOD}      y2={0.95}                fill="#bbf7d0" fillOpacity={0.20} />
                  {/* Zone boundary lines */}
                  {Object.entries(NDVI_ZONES).map(([, val]) => (
                    <ReferenceLine key={val} y={val} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} />
                  ))}
                </>
              )}

              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={v => {
                  const d = new Date(v)
                  return `${d.getDate()}/${d.getMonth() + 1}`
                }}
                tickLine={false}
                axisLine={false}
              />

              {/* Left Y-axis — NDVI */}
              <YAxis
                yAxisId="ndvi"
                domain={[0.2, 0.95]}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.toFixed(2)}
              />

              {/* Right Y-axis — Rainfall */}
              {showRainfall && rainfall.length > 0 && (
                <YAxis
                  yAxisId="rain"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#93c5fd' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}mm`}
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                formatter={(value: string) => {
                  if (value === 'rainfall_mm') return '🌧 Rainfall'
                  const plotId = value.replace('ndvi_', '')
                  return plots.find(p => p.id === plotId)?.name ?? plotId
                }}
              />

              {/* Rainfall bars */}
              {showRainfall && rainfall.length > 0 && (
                <Bar
                  yAxisId="rain"
                  dataKey="rainfall_mm"
                  fill="#bfdbfe"
                  stroke="#93c5fd"
                  strokeWidth={0}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={10}
                  opacity={0.7}
                  name="rainfall_mm"
                />
              )}

              {/* NDVI lines per plot */}
              {plots.map(plot => (
                <Line
                  key={plot.id}
                  yAxisId="ndvi"
                  type="monotone"
                  dataKey={`ndvi_${plot.id}`}
                  name={`ndvi_${plot.id}`}
                  stroke={plot.color}
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props
                    const isAlert   = payload[`alert_${plot.id}`]
                    const isAnomaly = payload[`anomaly_${plot.id}`]
                    if (isAlert || isAnomaly) {
                      return (
                        <circle
                          key={`dot-${cx}-${cy}`}
                          cx={cx} cy={cy} r={5}
                          fill="#ef4444"
                          stroke="white"
                          strokeWidth={1.5}
                        />
                      )
                    }
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx} cy={cy} r={3}
                        fill={plot.color}
                        stroke="white"
                        strokeWidth={1}
                      />
                    )
                  }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Zone legend */}
          {showHealthZones && (
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <span className="text-xs text-slate-400 font-medium">Zones:</span>
              {[
                { label: 'Good',     color: 'bg-emerald-200', range: '≥ 0.65' },
                { label: 'Watch',    color: 'bg-yellow-200',  range: '0.50–0.65' },
                { label: 'Stress',   color: 'bg-orange-200',  range: '0.35–0.50' },
                { label: 'Critical', color: 'bg-red-200',     range: '< 0.35' },
              ].map(z => (
                <div key={z.label} className="flex items-center gap-1">
                  <div className={`w-2.5 h-2.5 rounded-sm ${z.color}`} />
                  <span className="text-xs text-slate-500">{z.label} <span className="text-slate-400">{z.range}</span></span>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-slate-500">Alert / Anomaly</span>
              </div>
            </div>
          )}

          {/* Per-plot stats summary */}
          {plots.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 sm:grid-cols-3">
              {plots.map(plot => {
                const pts = filteredData
                  .filter(d => d.plot_id === plot.id && d.ndvi !== null)
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

                if (pts.length === 0) return null
                const avg    = pts.reduce((s, d) => s + (d.ndvi ?? 0), 0) / pts.length
                const latest = pts[pts.length - 1]?.ndvi ?? 0
                const first  = pts[0]?.ndvi ?? 0
                const delta  = latest - first

                return (
                  <div key={plot.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                    <div className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: plot.color }} />
                    <div>
                      <p className="text-xs font-semibold text-slate-700 leading-tight">{plot.name}</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{avg.toFixed(3)}</p>
                      <p className={`text-xs font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta).toFixed(3)} over period
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── RECOMMENDATIONS TAB ───────────────────────────────────────────── */}
      {activeTab === 'recommendations' && (
        <div className="space-y-2">
          {recommendations.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No plot data available</p>
          )}

          {/* Sort: urgent first */}
          {[...recommendations]
            .sort((a, b) => {
              const order = { urgent: 0, warning: 1, info: 2, good: 3 }
              return order[a.rec.priority] - order[b.rec.priority]
            })
            .map(({ plot, rec }) => (
              <div
                key={plot.id}
                className={`rounded-xl border p-3 ${priorityStyle[rec.priority]}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 mt-0.5">{rec.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold">{rec.title}</p>
                      {rec.priority === 'urgent' && (
                        <span className="text-xs font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full">Urgent</span>
                      )}
                    </div>
                    <p className="text-xs mt-1 opacity-80 leading-relaxed">{rec.detail}</p>
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: plot.color }}
                  />
                </div>
              </div>
            ))
          }

          <p className="text-xs text-slate-400 pt-1">
            Recommendations are based on NDVI trends, threshold thresholds for Coffea arabica in the Kenya highlands, and observed alert patterns. Always confirm with physical field scouting.
          </p>
        </div>
      )}
    </div>
  )
}

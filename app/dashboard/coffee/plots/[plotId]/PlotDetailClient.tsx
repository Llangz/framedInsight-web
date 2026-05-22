'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Database } from '@/lib/database.types'

type CoffeePlot = Database['public']['Tables']['coffee_plots']['Row']
type CoffeeHarvest = Database['public']['Tables']['coffee_harvests']['Row']
type CoffeeActivity = Database['public']['Tables']['coffee_activities']['Row']
type CoffeeDisease = Database['public']['Tables']['coffee_diseases']['Row']
type SatelliteIndex = Database['public']['Tables']['coffee_satellite_indices']['Row']

interface Props {
  plot: CoffeePlot
  harvests: CoffeeHarvest[]
  activities: CoffeeActivity[]
  diseases: CoffeeDisease[]
  satelliteHistory: SatelliteIndex[]
}

type Tab = 'overview' | 'harvests' | 'activities' | 'health'

// ── helpers ──────────────────────────────────────────────────────────────────

function plotAge(plot: CoffeePlot): number {
  if (plot.establishment_year) return new Date().getFullYear() - plot.establishment_year
  if (plot.age_years) return plot.age_years
  if (plot.planting_date) return Math.floor((Date.now() - new Date(plot.planting_date).getTime()) / (365.25 * 24 * 3600 * 1000))
  return 0
}

function matureTreeCount(plot: CoffeePlot): number {
  if (plot.productive_trees != null) return plot.productive_trees
  return plotAge(plot) >= 3 ? plot.total_trees : 0
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtKES(n: number | null | undefined): string {
  if (n == null) return '—'
  return `KES ${n.toLocaleString('en-KE')}`
}

function ndviColor(ndvi: number | null | undefined): string {
  if (ndvi == null) return 'text-gray-400'
  if (ndvi >= 0.6) return 'text-green-600'
  if (ndvi >= 0.4) return 'text-yellow-600'
  return 'text-red-600'
}

function ndviLabel(ndvi: number | null | undefined, label: string | null | undefined): string {
  if (label) return label
  if (ndvi == null) return 'No data'
  if (ndvi >= 0.6) return 'Healthy'
  if (ndvi >= 0.4) return 'Moderate'
  return 'Stressed'
}

function severityBadge(severity: string): string {
  if (severity === 'severe' || severity === 'high') return 'bg-red-100 text-red-700 border-red-200'
  if (severity === 'moderate' || severity === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function NdviBar({ value }: { value: number | null | undefined }) {
  if (value == null) return <div className="h-2 bg-gray-100 rounded-full" />
  const pct = Math.max(0, Math.min(100, ((value + 1) / 2) * 100))
  const color = value >= 0.6 ? 'bg-green-500' : value >= 0.4 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    fertilization: '🌿',
    spraying: '💧',
    weeding: '🌾',
    pruning: '✂️',
    harvest: '🍒',
    planting: '🌱',
    irrigation: '🚿',
    soil_test: '🧪',
  }
  const lower = type?.toLowerCase() || ''
  for (const [key, icon] of Object.entries(icons)) {
    if (lower.includes(key)) return <span className="text-xl">{icon}</span>
  }
  return <span className="text-xl">📋</span>
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ plot, latestSat }: { plot: CoffeePlot; latestSat: SatelliteIndex | null }) {
  const age = plotAge(plot)
  const mature = matureTreeCount(plot)

  return (
    <div className="space-y-6">
      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Trees" value={plot.total_trees.toLocaleString()} />
        <StatCard label="Mature Trees" value={mature.toLocaleString()} sub="≥3 years" />
        <StatCard label="Plot Age" value={`${age} yrs`} sub={plot.establishment_year ? `Est. ${plot.establishment_year}` : undefined} />
        <StatCard
          label="Size"
          value={plot.land_size_acres ? `${plot.land_size_acres} ac` : plot.area_hectares ? `${plot.area_hectares} ha` : '—'}
        />
      </div>

      {/* Plot Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Plot Details</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: 'Variety', value: plot.variety },
            { label: 'Status', value: plot.plant_status },
            { label: 'Region', value: plot.region_name },
            { label: 'Spacing (m)', value: plot.plant_spacing_meters },
            { label: 'Land Type', value: plot.land_ownership_type },
            { label: 'Plot Code', value: plot.plot_code },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-gray-400 text-xs">{label}</dt>
              <dd className="text-gray-900 font-medium mt-0.5 capitalize">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
        {plot.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-gray-400 text-xs mb-1">Notes</dt>
            <dd className="text-gray-700 text-sm">{plot.notes}</dd>
          </div>
        )}
      </div>

      {/* GPS */}
      {(plot.gps_latitude || plot.gps_longitude) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">GPS Location</h3>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📍</span>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {plot.gps_latitude?.toFixed(6)}, {plot.gps_longitude?.toFixed(6)}
              </p>
              <p className="text-xs text-gray-400">
                {plot.gps_polygon ? 'GPS polygon boundary recorded' : 'Point coordinate only'}
              </p>
            </div>
          </div>
          <a
            href={`https://maps.google.com/?q=${plot.gps_latitude},${plot.gps_longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Open in Google Maps →
          </a>
        </div>
      )}

      {/* Satellite health snapshot */}
      {latestSat && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Latest Satellite Scan</h3>
            <span className="text-xs text-gray-400">{fmtDate(latestSat.image_date)}</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className={`text-2xl font-black ${ndviColor(latestSat.ndvi_mean)}`}>
              {latestSat.ndvi_mean?.toFixed(2) ?? '—'}
            </div>
            <div>
              <p className={`text-sm font-semibold ${ndviColor(latestSat.ndvi_mean)}`}>
                {ndviLabel(latestSat.ndvi_mean, latestSat.health_label)}
              </p>
              <p className="text-xs text-gray-400">NDVI mean</p>
            </div>
          </div>
          <NdviBar value={latestSat.ndvi_mean} />
          {latestSat.alert_triggered && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <span>🚨</span>
              <p className="text-xs text-red-700 font-medium">{latestSat.alert_reason ?? 'Health alert triggered'}</p>
            </div>
          )}
        </div>
      )}

      {/* Compliance badges */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Compliance</h3>
        <div className="flex flex-wrap gap-2">
          {plot.eudr_risk_level ? (
            <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
              plot.eudr_risk_level === 'low'
                ? 'bg-green-100 text-green-700 border-green-200'
                : plot.eudr_risk_level === 'medium'
                ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                : 'bg-red-100 text-red-700 border-red-200'
            }`}>
              EUDR: {plot.eudr_risk_level.toUpperCase()} RISK
            </span>
          ) : (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-full border bg-gray-100 text-gray-500 border-gray-200">
              EUDR: Not assessed
            </span>
          )}
          {plot.afa_geo_mapping_id && (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-full border bg-blue-100 text-blue-700 border-blue-200">
              ✓ AFA Registered
            </span>
          )}
          {plot.land_ownership_doc_url && (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-full border bg-purple-100 text-purple-700 border-purple-200">
              ✓ Title Uploaded
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/dashboard/coffee/eudr-check/${plot.id}`}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            View EUDR detail →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Harvests tab ──────────────────────────────────────────────────────────────

function HarvestsTab({ harvests, plotId }: { harvests: CoffeeHarvest[]; plotId: string }) {
  const totalCherry = harvests.reduce((s, h) => s + (h.cherry_kg ?? 0), 0)
  const totalPaid = harvests.reduce((s, h) => s + (h.amount_paid ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Cherry (all seasons)" value={`${totalCherry.toLocaleString()} kg`} />
        <StatCard label="Total Paid" value={fmtKES(totalPaid || null)} />
      </div>

      <div className="flex justify-end">
        <Link
          href={`/dashboard/coffee/harvest/record?plot=${plotId}`}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          🍒 Record Harvest
        </Link>
      </div>

      {harvests.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-3">🍒</div>
          <p className="text-gray-600 text-sm">No harvest records yet for this plot</p>
        </div>
      ) : (
        <div className="space-y-3">
          {harvests.map((h) => (
            <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{fmtDate(h.harvest_date)}</p>
                  <p className="text-xs text-gray-400">{h.harvest_season ?? `Season ${h.harvest_year ?? '—'}`}</p>
                </div>
                {h.payment_status && (
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                    h.payment_status === 'paid'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                  }`}>
                    {h.payment_status}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Cherry</p>
                  <p className="font-medium">{h.cherry_kg} kg</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Parchment</p>
                  <p className="font-medium">{h.parchment_kg ?? '—'} {h.parchment_kg ? 'kg' : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Paid</p>
                  <p className="font-medium text-green-700">{fmtKES(h.amount_paid)}</p>
                </div>
              </div>
              {(h.cooperative_name || h.factory_code) && (
                <p className="text-xs text-gray-400 mt-2">
                  {h.cooperative_name}{h.factory_code ? ` · ${h.factory_code}` : ''}
                </p>
              )}
              {h.quality_grade && (
                <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                  Grade: {h.quality_grade}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Activities tab ────────────────────────────────────────────────────────────

function ActivitiesTab({ activities, plotId }: { activities: CoffeeActivity[]; plotId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/dashboard/coffee/activities/record?plot=${plotId}`}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          + Log Activity
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-600 text-sm">No activities logged for this plot yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <ActivityIcon type={a.activity_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 text-sm capitalize">
                      {a.activity_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(a.activity_date)}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {a.product_name && <span>🧴 {a.product_name}</span>}
                    {a.quantity && a.quantity_unit && <span>{a.quantity} {a.quantity_unit}</span>}
                    {a.num_workers && <span>👷 {a.num_workers} workers</span>}
                    {a.total_cost != null && <span className="text-orange-600 font-medium">{fmtKES(a.total_cost)}</span>}
                  </div>
                  {a.notes && <p className="text-xs text-gray-400 mt-1 truncate">{a.notes}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Health / Satellite tab ────────────────────────────────────────────────────

function HealthTab({
  diseases,
  satelliteHistory,
  plotId,
}: {
  diseases: CoffeeDisease[]
  satelliteHistory: SatelliteIndex[]
  plotId: string
}) {
  return (
    <div className="space-y-6">
      {/* Disease reports */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Disease / Pest Reports</h3>
          <Link
            href={`/dashboard/coffee/disease/scout?plot=${plotId}`}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            + Scout →
          </Link>
        </div>

        {diseases.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
            <p className="text-2xl mb-2">🌿</p>
            <p className="text-gray-600 text-sm">No disease reports — looking healthy!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diseases.map((d) => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{d.disease_name}</p>
                    <p className="text-xs text-gray-400">{fmtDate(d.detection_date)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${severityBadge(d.severity_level)}`}>
                    {d.severity_level}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Affected: {d.affected_percentage}% of trees</p>
                  {d.treatment_applied && (
                    <p>Treatment: {d.treatment_applied}{d.treatment_date ? ` (${fmtDate(d.treatment_date)})` : ''}</p>
                  )}
                  {d.resulting_losses_kg != null && (
                    <p className="text-red-600 font-medium">Losses: {d.resulting_losses_kg} kg</p>
                  )}
                </div>
                {d.ai_diagnosis && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-indigo-600 font-medium">🤖 AI: {d.ai_diagnosis}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Satellite history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Satellite NDVI History</h3>
          <Link
            href={`/dashboard/coffee/satellite`}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Full view →
          </Link>
        </div>

        {satelliteHistory.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
            <p className="text-2xl mb-2">🛰️</p>
            <p className="text-gray-600 text-sm">No satellite data yet for this plot</p>
          </div>
        ) : (
          <div className="space-y-2">
            {satelliteHistory.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">{fmtDate(s.image_date)}</p>
                  <div className="flex items-center gap-2">
                    {s.alert_triggered && (
                      <span className="text-xs text-red-600 font-bold">🚨 Alert</span>
                    )}
                    <span className={`text-xs font-semibold ${ndviColor(s.ndvi_mean)}`}>
                      NDVI {s.ndvi_mean?.toFixed(3) ?? '—'}
                    </span>
                  </div>
                </div>
                <NdviBar value={s.ndvi_mean} />
                {s.ndvi_change != null && (
                  <p className={`text-xs mt-1 ${s.ndvi_change < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {s.ndvi_change > 0 ? '↑' : '↓'} {Math.abs(s.ndvi_change).toFixed(3)} vs prev scan
                    {s.weeks_of_decline != null && s.weeks_of_decline > 0
                      ? ` · ${s.weeks_of_decline}w decline`
                      : ''}
                  </p>
                )}
                {s.cloud_cover_pct != null && s.cloud_cover_pct > 50 && (
                  <p className="text-xs text-gray-400 mt-0.5">☁️ {s.cloud_cover_pct}% cloud cover</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PlotDetailClient({ plot, harvests, activities, diseases, satelliteHistory }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const age = plotAge(plot)
  const latestSat = satelliteHistory[0] ?? null

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'harvests', label: 'Harvests', count: harvests.length },
    { id: 'activities', label: 'Activities', count: activities.length },
    { id: 'health', label: 'Health', count: diseases.length > 0 ? diseases.length : undefined },
  ]

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 pt-4 pb-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Link href="/dashboard/coffee" className="hover:text-gray-600">Coffee</Link>
            <span>/</span>
            <Link href="/dashboard/coffee/plots" className="hover:text-gray-600">Plots</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{plot.plot_name}</span>
            <Link href={`/dashboard/coffee/plots/${plot.id}/edit`} className="text-blue-600 hover:text-blue-800">
              Edit Plot
            </Link>
          </div>

          {/* Plot title + status */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{plot.plot_name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {plot.variety ?? 'Unknown variety'}
                {plot.region_name ? ` · ${plot.region_name}` : ''}
                {age > 0 ? ` · ${age} yr old` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                plot.plant_status === 'productive'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-yellow-100 text-yellow-700 border-yellow-200'
              }`}>
                {plot.plant_status ?? 'active'}
              </span>
              {latestSat && (
                <span className={`text-xs font-semibold ${ndviColor(latestSat.ndvi_mean)}`}>
                  🛰 {ndviLabel(latestSat.ndvi_mean, latestSat.health_label)}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 pt-5">
        {activeTab === 'overview' && <OverviewTab plot={plot} latestSat={latestSat} />}
        {activeTab === 'harvests' && <HarvestsTab harvests={harvests} plotId={plot.id} />}
        {activeTab === 'activities' && <ActivitiesTab activities={activities} plotId={plot.id} />}
        {activeTab === 'health' && <HealthTab diseases={diseases} satelliteHistory={satelliteHistory} plotId={plot.id} />}
      </div>

      {/* ── FAB: Record Harvest ── */}
      <div className="fixed bottom-6 right-4 flex flex-col gap-2 items-end">
        <Link
          href={`/dashboard/coffee/harvest/record?plot=${plot.id}`}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-lg transition-all active:scale-95"
        >
          🍒 Record Harvest
        </Link>
      </div>
    </div>
  )
}
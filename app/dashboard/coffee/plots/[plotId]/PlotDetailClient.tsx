'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft,
  MapPin,
  TreePine,
  Satellite,
  Activity,
  Wheat,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  FlaskConical,
  Plus,
  ExternalLink,
  Cloud,
  Pencil,
} from 'lucide-react'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function plotAge(plot: CoffeePlot): number {
  if (plot.establishment_year) return new Date().getFullYear() - plot.establishment_year
  if (plot.age_years) return plot.age_years
  if (plot.planting_date)
    return Math.floor((Date.now() - new Date(plot.planting_date).getTime()) / (365.25 * 24 * 3600 * 1000))
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

// Returns Tailwind text color class for NDVI value — dark-mode safe
function ndviTextColor(ndvi: number | null | undefined): string {
  if (ndvi == null) return 'text-[#6B7280]'
  if (ndvi >= 0.6) return 'text-emerald-400'
  if (ndvi >= 0.4) return 'text-amber-400'
  return 'text-red-400'
}

function ndviLabel(ndvi: number | null | undefined, label: string | null | undefined): string {
  if (label) return label
  if (ndvi == null) return 'No data'
  if (ndvi >= 0.6) return 'Healthy'
  if (ndvi >= 0.4) return 'Moderate'
  return 'Stressed'
}

// Severity badge — dark-mode tokens only
function severityClasses(severity: string): string {
  if (severity === 'severe' || severity === 'high')
    return 'bg-red-950/60 text-red-400 border-red-900/60'
  if (severity === 'moderate' || severity === 'medium')
    return 'bg-amber-950/60 text-amber-400 border-amber-900/60'
  return 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60'
}

// Activity type → Lucide icon
function ActivityIcon({ type }: { type: string }) {
  const lower = type?.toLowerCase() || ''
  if (lower.includes('fertiliz')) return <Activity size={13} className="text-[#6B7280]" strokeWidth={1.5} />
  if (lower.includes('spray') || lower.includes('pest')) return <FlaskConical size={13} className="text-[#6B7280]" strokeWidth={1.5} />
  if (lower.includes('weed') || lower.includes('prun')) return <TreePine size={13} className="text-[#6B7280]" strokeWidth={1.5} />
  if (lower.includes('harvest')) return <Wheat size={13} className="text-[#6B7280]" strokeWidth={1.5} />
  return <Activity size={13} className="text-[#6B7280]" strokeWidth={1.5} />
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StatCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-[#0D0F14] px-5 py-5 flex flex-col gap-2">
      <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">{label}</p>
      <p className="text-xl font-semibold text-white tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-[#4B5563]">{sub}</p>}
    </div>
  )
}

function NdviBar({ value }: { value: number | null | undefined }) {
  if (value == null)
    return <div className="h-1 bg-[#1F2128] rounded-full" />
  const pct = Math.max(0, Math.min(100, ((value + 1) / 2) * 100))
  const color =
    value >= 0.6 ? 'bg-emerald-500' : value >= 0.4 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="h-1 bg-[#1F2128] rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function EmptyState({ icon: Icon, message, action }: {
  icon: React.ElementType
  message: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 border border-dashed border-[#2A2D35] rounded-lg">
      <Icon size={20} className="text-[#2A2D35]" strokeWidth={1} />
      <p className="text-sm text-[#4B5563]">{message}</p>
      {action && (
        <Link
          href={action.href}
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ plot, latestSat }: { plot: CoffeePlot; latestSat: SatelliteIndex | null }) {
  const age = plotAge(plot)
  const mature = matureTreeCount(plot)

  return (
    <div className="space-y-4">

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1F2128] rounded-lg overflow-hidden border border-[#1F2128]">
        <StatCell label="Total Trees" value={plot.total_trees.toLocaleString()} />
        <StatCell label="Mature" value={mature.toLocaleString()} sub="≥ 3 years" />
        <StatCell label="Age" value={age > 0 ? `${age} yr` : '—'} sub={plot.establishment_year ? `Est. ${plot.establishment_year}` : undefined} />
        <StatCell
          label="Size"
          value={
            plot.land_size_acres
              ? `${plot.land_size_acres} ac`
              : plot.area_hectares
              ? `${plot.area_hectares} ha`
              : '—'
          }
        />
      </div>

      {/* Plot details */}
      <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] divide-y divide-[#1F2128]">
        <div className="px-5 py-4">
          <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">Plot Details</p>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-y divide-[#1F2128]">
          {[
            ['Variety', plot.variety],
            ['Status', plot.plant_status],
            ['Region', plot.region_name],
            ['Spacing', plot.plant_spacing_meters ? `${plot.plant_spacing_meters} m` : null],
            ['Land type', plot.land_ownership_type],
            ['Plot code', plot.plot_code],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-3.5">
              <dt className="text-[11px] text-[#4B5563] uppercase tracking-wider mb-1">{label}</dt>
              <dd className="text-sm text-white capitalize">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
        {plot.notes && (
          <div className="px-5 py-3.5">
            <dt className="text-[11px] text-[#4B5563] uppercase tracking-wider mb-1">Notes</dt>
            <dd className="text-sm text-[#9CA3AF]">{plot.notes}</dd>
          </div>
        )}
      </div>

      {/* GPS */}
      {(plot.gps_latitude || plot.gps_longitude) ? (
        <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] divide-y divide-[#1F2128]">
          <div className="px-5 py-4 flex items-center gap-3">
            <MapPin size={14} className="text-[#6B7280]" strokeWidth={1.5} />
            <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">GPS Location</p>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-mono text-white">
                {plot.gps_latitude?.toFixed(6)}, {plot.gps_longitude?.toFixed(6)}
              </p>
              <p className="text-xs text-[#4B5563] mt-1">
                {plot.gps_polygon ? 'Polygon boundary recorded' : 'Point coordinate only'}
              </p>
            </div>
            <a
              href={`https://maps.google.com/?q=${plot.gps_latitude},${plot.gps_longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors"
            >
              <ExternalLink size={12} />
              Maps
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-amber-800/60 bg-amber-950/20 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <MapPin size={14} className="text-amber-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-amber-300">No GPS boundary recorded</p>
              <p className="text-xs text-amber-500/80 mt-0.5">Required for EUDR compliance and satellite monitoring.</p>
            </div>
          </div>
          <Link
            href={`/dashboard/coffee/plots/${plot.id}/edit`}
            className="flex-shrink-0 text-xs font-bold text-amber-400 hover:text-amber-300 border border-amber-700 hover:border-amber-500 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Map now →
          </Link>
        </div>
      )}

      {/* Latest satellite */}
      {latestSat && (
        <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] divide-y divide-[#1F2128]">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Satellite size={14} className="text-[#6B7280]" strokeWidth={1.5} />
              <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">Latest Scan</p>
            </div>
            <span className="text-xs text-[#4B5563]">{fmtDate(latestSat.image_date)}</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold tabular-nums ${ndviTextColor(latestSat.ndvi_mean)}`}>
                  {latestSat.ndvi_mean?.toFixed(2) ?? '—'}
                </p>
                <p className="text-xs text-[#4B5563] mt-0.5">NDVI · {ndviLabel(latestSat.ndvi_mean, latestSat.health_label)}</p>
              </div>
              {latestSat.ndvi_change != null && (
                <div className="flex items-center gap-1.5">
                  {latestSat.ndvi_change > 0
                    ? <TrendingUp size={14} className="text-emerald-400" />
                    : latestSat.ndvi_change < 0
                    ? <TrendingDown size={14} className="text-red-400" />
                    : <Minus size={14} className="text-[#6B7280]" />}
                  <span className={`text-xs font-medium tabular-nums ${latestSat.ndvi_change < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {latestSat.ndvi_change > 0 ? '+' : ''}{latestSat.ndvi_change.toFixed(3)}
                  </span>
                </div>
              )}
            </div>
            <NdviBar value={latestSat.ndvi_mean} />
            {latestSat.alert_triggered && (
              <div className="flex items-start gap-2.5 p-3 bg-red-950/40 border border-red-900/40 rounded-md">
                <AlertTriangle size={13} className="text-red-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-xs text-red-300">{latestSat.alert_reason ?? 'Health alert triggered'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance */}
      <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] divide-y divide-[#1F2128]">
        <div className="px-5 py-4 flex items-center gap-3">
          <Shield size={14} className="text-[#6B7280]" strokeWidth={1.5} />
          <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">Compliance</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {plot.eudr_risk_level ? (
            <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
              plot.eudr_risk_level === 'low'
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60'
                : plot.eudr_risk_level === 'medium'
                ? 'bg-amber-950/60 text-amber-400 border-amber-900/60'
                : 'bg-red-950/60 text-red-400 border-red-900/60'
            }`}>
              EUDR · {plot.eudr_risk_level.toUpperCase()} RISK
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-medium rounded-md border bg-[#17191F] text-[#6B7280] border-[#2A2D35]">
              EUDR · Not assessed
            </span>
          )}
          {plot.afa_geo_mapping_id && (
            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border bg-emerald-950/60 text-emerald-400 border-emerald-900/60">
              <CheckCircle size={10} strokeWidth={2} /> AFA Registered
            </span>
          )}
          {plot.land_ownership_doc_url && (
            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border bg-[#17191F] text-[#9CA3AF] border-[#2A2D35]">
              <CheckCircle size={10} strokeWidth={2} /> Title Uploaded
            </span>
          )}
        </div>
        <div className="px-5 py-3">
          <Link
            href={`/dashboard/coffee/eudr-check/${plot.id}`}
            className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors"
          >
            View EUDR detail <ChevronRight size={11} />
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
      <div className="grid grid-cols-2 gap-px bg-[#1F2128] rounded-lg overflow-hidden border border-[#1F2128]">
        <StatCell label="Total Cherry" value={`${totalCherry.toLocaleString()} kg`} sub="all seasons" />
        <StatCell label="Total Paid" value={totalPaid > 0 ? fmtKES(totalPaid) : '—'} />
      </div>

      {harvests.length === 0 ? (
        <EmptyState
          icon={Wheat}
          message="No harvest records yet for this plot"
          action={{ label: 'Record first harvest', href: `/dashboard/coffee/harvest/record?plot=${plotId}` }}
        />
      ) : (
        <div className="rounded-lg border border-[#2A2D35] overflow-hidden divide-y divide-[#1F2128]">
          {harvests.map((h) => (
            <div key={h.id} className="bg-[#0D0F14] px-5 py-4 hover:bg-[#111318] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-white">{fmtDate(h.harvest_date)}</p>
                  <p className="text-xs text-[#4B5563] mt-0.5">{h.harvest_season ?? `Season ${h.harvest_year ?? '—'}`}</p>
                </div>
                {h.payment_status && (
                  <span className={`text-xs px-2 py-1 rounded-md border font-medium ${
                    h.payment_status === 'paid'
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60'
                      : 'bg-amber-950/60 text-amber-400 border-amber-900/60'
                  }`}>
                    {h.payment_status}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'Cherry', value: h.cherry_kg ? `${h.cherry_kg} kg` : '—' },
                  { label: 'Parchment', value: h.parchment_kg ? `${h.parchment_kg} kg` : '—' },
                  { label: 'Paid', value: fmtKES(h.amount_paid) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[11px] text-[#4B5563] uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm text-white tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              {(h.cooperative_name || h.factory_code) && (
                <p className="text-xs text-[#4B5563] mt-2">
                  {h.cooperative_name}{h.factory_code ? ` · ${h.factory_code}` : ''}
                </p>
              )}
              {h.quality_grade && (
                <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-md border bg-[#17191F] text-[#9CA3AF] border-[#2A2D35]">
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
      {activities.length === 0 ? (
        <EmptyState
          icon={Activity}
          message="No activities logged for this plot"
          action={{ label: 'Log first activity', href: `/dashboard/coffee/activities/record?plot=${plotId}` }}
        />
      ) : (
        <div className="rounded-lg border border-[#2A2D35] overflow-hidden divide-y divide-[#1F2128]">
          {activities.map((a) => (
            <div key={a.id} className="bg-[#0D0F14] px-5 py-4 hover:bg-[#111318] transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-md bg-[#17191F] border border-[#2A2D35]">
                  <ActivityIcon type={a.activity_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white capitalize">
                      {a.activity_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-[#4B5563] whitespace-nowrap tabular-nums">{fmtDate(a.activity_date)}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6B7280]">
                    {a.product_name && <span>{a.product_name}</span>}
                    {a.quantity && a.quantity_unit && <span>{a.quantity} {a.quantity_unit}</span>}
                    {a.num_workers && <span>{a.num_workers} workers</span>}
                    {a.total_cost != null && (
                      <span className="text-amber-400 font-medium">{fmtKES(a.total_cost)}</span>
                    )}
                  </div>
                  {a.notes && <p className="text-xs text-[#4B5563] mt-1 truncate">{a.notes}</p>}
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

function HealthTab({ diseases, satelliteHistory, plotId }: {
  diseases: CoffeeDisease[]
  satelliteHistory: SatelliteIndex[]
  plotId: string
}) {
  return (
    <div className="space-y-6">

      {/* Disease reports */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">Disease / Pest Reports</p>
          <Link
            href={`/dashboard/coffee/disease/scout?plot=${plotId}`}
            className="text-xs text-[#6B7280] hover:text-white transition-colors"
          >
            Scout →
          </Link>
        </div>

        {diseases.length === 0 ? (
          <EmptyState icon={CheckCircle} message="No disease reports — looking healthy" />
        ) : (
          <div className="rounded-lg border border-[#2A2D35] overflow-hidden divide-y divide-[#1F2128]">
            {diseases.map((d) => (
              <div key={d.id} className="bg-[#0D0F14] px-5 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{d.disease_name}</p>
                    <p className="text-xs text-[#4B5563] mt-0.5">{fmtDate(d.detection_date)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-md border font-medium ${severityClasses(d.severity_level)}`}>
                    {d.severity_level}
                  </span>
                </div>
                <div className="text-xs text-[#6B7280] space-y-0.5">
                  <p>Affected: {d.affected_percentage}% of trees</p>
                  {d.treatment_applied && (
                    <p>Treatment: {d.treatment_applied}{d.treatment_date ? ` · ${fmtDate(d.treatment_date)}` : ''}</p>
                  )}
                  {d.resulting_losses_kg != null && (
                    <p className="text-red-400 font-medium">Losses: {d.resulting_losses_kg} kg</p>
                  )}
                </div>
                {d.ai_diagnosis && (
                  <div className="mt-2 pt-2 border-t border-[#1F2128]">
                    <p className="text-xs text-[#6B7280]">
                      <span className="text-[#4B5563]">AI · </span>{d.ai_diagnosis}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Satellite NDVI history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">NDVI History</p>
          <Link
            href="/dashboard/coffee/satellite"
            className="text-xs text-[#6B7280] hover:text-white transition-colors"
          >
            Full view →
          </Link>
        </div>

        {satelliteHistory.length === 0 ? (
          <EmptyState icon={Satellite} message="No satellite data yet for this plot" />
        ) : (
          <div className="rounded-lg border border-[#2A2D35] overflow-hidden divide-y divide-[#1F2128]">
            {satelliteHistory.map((s) => (
              <div key={s.id} className="bg-[#0D0F14] px-5 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-white tabular-nums">{fmtDate(s.image_date)}</p>
                  <div className="flex items-center gap-3">
                    {s.cloud_cover_pct != null && s.cloud_cover_pct > 50 && (
                      <span className="flex items-center gap-1 text-xs text-[#4B5563]">
                        <Cloud size={10} strokeWidth={1.5} />
                        {s.cloud_cover_pct}%
                      </span>
                    )}
                    {s.alert_triggered && (
                      <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                        <AlertTriangle size={10} strokeWidth={1.5} />
                        Alert
                      </span>
                    )}
                    <span className={`text-xs font-semibold tabular-nums ${ndviTextColor(s.ndvi_mean)}`}>
                      {s.ndvi_mean?.toFixed(3) ?? '—'}
                    </span>
                  </div>
                </div>
                <NdviBar value={s.ndvi_mean} />
                {s.ndvi_change != null && (
                  <p className={`text-xs mt-1.5 flex items-center gap-1 ${s.ndvi_change < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {s.ndvi_change < 0
                      ? <TrendingDown size={10} strokeWidth={1.5} />
                      : <TrendingUp size={10} strokeWidth={1.5} />}
                    {s.ndvi_change > 0 ? '+' : ''}{s.ndvi_change.toFixed(3)} vs prev
                    {s.weeks_of_decline != null && s.weeks_of_decline > 0
                      ? ` · ${s.weeks_of_decline}w decline`
                      : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PlotDetailClient({ plot, harvests, activities, diseases, satelliteHistory }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const age = plotAge(plot)
  const latestSat = satelliteHistory[0] ?? null

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'harvests', label: 'Harvests', count: harvests.length },
    { id: 'activities', label: 'Activities', count: activities.length },
    { id: 'health', label: 'Health', count: diseases.length || undefined },
  ]

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-3xl mx-auto pb-24">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 bg-obsidian/95 backdrop-blur border-b border-[#1F2128]">
          <div className="px-6 pt-6 pb-0">

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-[#4B5563] mb-4">
              <Link href="/dashboard/coffee" className="hover:text-[#9CA3AF] transition-colors">Coffee</Link>
              <ChevronRight size={11} />
              <Link href="/dashboard/coffee/plots" className="hover:text-[#9CA3AF] transition-colors">Plots</Link>
              <ChevronRight size={11} />
              <span className="text-[#9CA3AF]">{plot.plot_name}</span>
            </div>

            {/* Title row */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-xl font-semibold text-white tracking-tight">{plot.plot_name}</h1>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {plot.variety ?? 'Unknown variety'}
                  {plot.region_name ? ` · ${plot.region_name}` : ''}
                  {age > 0 ? ` · ${age} yr` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {latestSat && (
                  <span className={`text-xs font-medium tabular-nums ${ndviTextColor(latestSat.ndvi_mean)}`}>
                    {ndviLabel(latestSat.ndvi_mean, latestSat.health_label)}
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-md border font-medium ${
                  plot.plant_status === 'productive'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60'
                    : 'bg-[#17191F] text-[#9CA3AF] border-[#2A2D35]'
                }`}>
                  {plot.plant_status ?? 'active'}
                </span>
                <Link
                  href={`/dashboard/coffee/plots/${plot.id}/edit`}
                  className="p-1.5 rounded-md text-[#4B5563] hover:text-[#9CA3AF] hover:bg-[#17191F] transition-colors"
                >
                  <Pencil size={13} strokeWidth={1.5} />
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-white'
                      : 'border-transparent text-[#6B7280] hover:text-[#9CA3AF]'
                  }`}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="ml-1.5 text-[11px] bg-[#1F2128] text-[#6B7280] rounded-full px-1.5 py-0.5 tabular-nums">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="px-6 pt-5">
          {activeTab === 'overview' && <OverviewTab plot={plot} latestSat={latestSat} />}
          {activeTab === 'harvests' && <HarvestsTab harvests={harvests} plotId={plot.id} />}
          {activeTab === 'activities' && <ActivitiesTab activities={activities} plotId={plot.id} />}
          {activeTab === 'health' && <HealthTab diseases={diseases} satelliteHistory={satelliteHistory} plotId={plot.id} />}
        </div>

        {/* ── FAB ── */}
        <div className="fixed bottom-6 right-6">
          <Link
            href={`/dashboard/coffee/harvest/record?plot=${plot.id}`}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-all active:scale-95 border border-emerald-600/50"
          >
            <Plus size={14} strokeWidth={2} />
            Record Harvest
          </Link>
        </div>

      </div>
    </div>
  )
}
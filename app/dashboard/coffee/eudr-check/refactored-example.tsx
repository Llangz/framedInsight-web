/**
 * Refactored EUDR Page: Using Event Sourcing + Materialized Views
 *
 * Before: Direct queries to coffee_eudr_compliance
 * After: Event sourcing for compliance history + materialized view for fast dashboard
 *
 * Benefits:
 * - Audit trail (any dispute → replay events to see what happened)
 * - Faster queries (no expensive JOINs, just hit the view)
 * - Eventual consistency (offline changes sync without data loss)
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { EventStore, PlotAggregate, type FarmEvent } from '@/lib/event-sourcing'

type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown'

interface PlotData {
  id: string
  plot_name: string
  area_hectares: number | null
  gps_polygon: any
  region_name: string | null
}

// Use materialized view schema (faster, normalized)
type EudrSummary = Database['public']['Views']['v_plot_status']['Row']

export default function EUDRPlotDetailPage() {
  const router = useRouter()
  const params = useParams()
  const plotId = params?.plotId as string

  const [loading, setLoading] = useState(true)
  const [plot, setPlot] = useState<PlotData | null>(null)
  const [eudr, setEudr] = useState<EudrSummary | null>(null)
  const [auditTrail, setAuditTrail] = useState<FarmEvent[]>([])
  const [showAuditLog, setShowAuditLog] = useState(false)

  useEffect(() => {
    if (plotId) loadData()
  }, [plotId])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // 1. Get plot data (unchanged)
      const { data: plotData } = await supabase
        .from('coffee_plots')
        .select('id,plot_name,area_hectares,gps_polygon,region_name')
        .eq('id', plotId)
        .single()

      // 2. Query materialized view instead of raw table
      //    This is much faster and already denormalized
      const { data: eudrData } = await supabase
        .from('v_plot_status')
        .select('*')
        .eq('id', plotId)
        .single()

      // 3. Get audit trail (event sourcing)
      //    Shows all actions that led to this state
      const eventStore = new EventStore()
      const auditData = await eventStore.getPlotAuditTrail(plotId)

      setPlot(plotData)
      setEudr(eudrData)
      setAuditTrail(auditData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleRevalidate() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Get the farm_id for this plot
      const { data: plotData } = await supabase
        .from('coffee_plots')
        .select('farm_id')
        .eq('id', plotId)
        .single()

      if (!plotData?.farm_id) throw new Error('Plot not found')

      // Use aggregate to enforce business rules
      const aggregate = new PlotAggregate(plotId, plotData.farm_id)
      await aggregate.runEudrAssessment('afa_api')

      // Reload data
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <LoadingSpinner />

  const risk = getRisk(eudr?.traffic_light_status as RiskLevel)

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Back nav */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link
          href="/dashboard/coffee/eudr-check"
          className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600 transition"
        >
          ←
        </Link>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">EUDR Risk Dashboard</p>
          <p className="text-sm font-bold text-white">{plot?.plot_name || '—'}</p>
        </div>

        {/* NEW: Audit log toggle */}
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className="ml-auto text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded border border-slate-600"
        >
          📋 Audit Log ({auditTrail.length})
        </button>
      </div>

      {/* Status Banner */}
      <StatusBanner risk={risk} eudr={eudr} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Plot Map */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            📍 Plot Boundary Map
          </p>
          {/* PlotMap component unchanged */}
        </div>

        {/* Risk Cards */}
        <RiskCards eudr={eudr} plot={plot} />

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRevalidate}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-4 px-4 rounded-xl text-base transition"
          >
            🔄 Re-Validate Plot (Satellite)
          </button>
        </div>

        {/* NEW: Audit Trail Section */}
        {showAuditLog && (
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-4">
            <h3 className="font-bold text-white mb-3">Compliance History</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditTrail.length === 0 ? (
                <p className="text-slate-500 text-sm">No events recorded yet</p>
              ) : (
                auditTrail.map((event, i) => (
                  <div
                    key={i}
                    className="text-xs bg-slate-700 rounded p-2 border-l-2 border-blue-500"
                  >
                    <p className="font-mono text-slate-300">{event.event_type}</p>
                    <p className="text-slate-500">
                      {new Date(event.created_at).toLocaleString('en-KE')}
                    </p>
                    {event.event_type === 'eudr_assessment_run' && (
                      <p className="text-slate-400 text-xs mt-1">
                        Risk: {(event as any).event_data.risk_level} · Forest:{' '}
                        {(event as any).event_data.forest_cover_pct}% ·{' '}
                        {(event as any).event_data.assessment_service}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getRisk(status: RiskLevel): RiskLevel {
  if (!status) return 'unknown'
  return status === 'green' ? 'green' : status === 'red' ? 'red' : 'yellow'
}

function StatusBanner({ risk, eudr }: { risk: RiskLevel; eudr: any }) {
  const config = {
    green: {
      bg: 'bg-green-700',
      icon: '✅',
      title: 'PLOT READY FOR EXPORT',
      sub: 'No deforestation detected. All documents clear.',
    },
    yellow: {
      bg: 'bg-amber-600',
      icon: '⚠️',
      title: 'ACTION REQUIRED',
      sub: 'Verify boundary, upload land title, or review forest baseline.',
    },
    red: {
      bg: 'bg-red-700',
      icon: '🚫',
      title: 'POTENTIAL FOREST CONFLICT',
      sub: 'Significant tree-cover loss detected after Jan 1, 2021.',
    },
    unknown: {
      bg: 'bg-slate-700',
      icon: '❓',
      title: 'COMPLIANCE NOT CHECKED YET',
      sub: 'Run validation to assess this plot.',
    },
  }[risk]

  return (
    <div className={`${config.bg} px-4 py-6`}>
      <div className="max-w-2xl mx-auto flex items-center gap-4">
        <span className="text-5xl">{config.icon}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Deforestation Risk</p>
          <h1 className="text-xl font-black mt-0.5">{config.title}</h1>
          <p className="text-sm opacity-80 mt-1">{config.sub}</p>
        </div>
      </div>
    </div>
  )
}

function RiskCards({ eudr, plot }: { eudr: any; plot: any }) {
  if (!eudr) return null

  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Risk Breakdown</p>
      <div className="space-y-3">
        {/* Forest Baseline Card */}
        <div
          className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
            eudr?.forest_cover_pct !== null
              ? eudr.risk_level === 'low'
                ? 'bg-green-950 border-green-600'
                : 'bg-red-950 border-red-600'
              : 'bg-slate-800 border-slate-600'
          }`}
        >
          <span className="text-2xl flex-shrink-0">🌳</span>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">Forest Baseline — Dec 31, 2020</p>
            {eudr?.forest_cover_pct !== null ? (
              <p
                className={`text-sm mt-0.5 font-semibold ${
                  eudr.risk_level === 'low' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {eudr.risk_level === 'low'
                  ? `✅ No forest detected. Forest cover: ${eudr.forest_cover_pct}%`
                  : `🚫 Forest detected. Risk: ${eudr.risk_level?.toUpperCase()}. Cover: ${eudr.forest_cover_pct}%`}
              </p>
            ) : (
              <p className="text-amber-400 text-sm mt-0.5 font-semibold">
                ❓ Not yet assessed — run validation below
              </p>
            )}
          </div>
        </div>

        {/* GPS Card */}
        <div
          className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
            plot?.gps_polygon ? 'bg-green-950 border-green-600' : 'bg-red-950 border-red-600'
          }`}
        >
          <span className="text-2xl flex-shrink-0">📡</span>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">GPS Coordinates</p>
            {plot?.gps_polygon ? (
              <p className="text-green-400 text-sm mt-0.5 font-semibold">
                ✅ GPS recorded · Polygon boundary available
              </p>
            ) : (
              <p className="text-red-400 text-sm mt-0.5 font-semibold">
                🚫 No GPS data — plot boundary required for EUDR
              </p>
            )}
          </div>
        </div>

        {/* Last Assessment */}
        {eudr?.assessment_date && (
          <p className="text-center text-slate-500 text-xs">
            Last assessment:{' '}
            {new Date(eudr.assessment_date).toLocaleDateString('en-KE', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-600 border-t-green-400 rounded-full animate-spin" />
    </div>
  )
}

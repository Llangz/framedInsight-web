'use client'

import Link from 'next/link'
import {
  CheckCircle2, AlertTriangle, XCircle, HelpCircle, Calendar, ChevronRight,
  ClipboardList, Camera, RefreshCw, MapPin, Leaf, Plus,
} from 'lucide-react'
import {
  EUDR_DEADLINE_SMALL_LABEL,
  EUDR_DEADLINE_LARGE_LABEL,
  daysUntilEudrDeadline,
  KENYA_RISK_TIER_EXPLAINER,
} from '@/lib/eudr-constants'

type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown'

interface PlotCompliance {
  plotId: string
  plotName: string
  areaHectares: number | null
  riskLevel: RiskLevel
  deforestationRisk: string
  forestCoverPct: number
  hasLandDoc: boolean
  hasGps: boolean
  complianceStatus: string
  lastCheck: string | null
  latestNdvi: number | null
  healthLabel: string | null
}

const RISK_CONFIG: Record<RiskLevel, {
  badge: string; badgeBg: string; badgeBorder: string;
  Icon: typeof CheckCircle2; label: string; statusLabel: string;
}> = {
  green: {
    badge: 'text-emerald-400', badgeBg: 'bg-emerald-500/10', badgeBorder: 'border-emerald-500/30',
    Icon: CheckCircle2, label: 'CLEAR — Ready for Export', statusLabel: 'CLEAR',
  },
  yellow: {
    badge: 'text-amber-400', badgeBg: 'bg-amber-500/10', badgeBorder: 'border-amber-500/30',
    Icon: AlertTriangle, label: 'VERIFY — Action Needed', statusLabel: 'VERIFY',
  },
  red: {
    badge: 'text-red-400', badgeBg: 'bg-red-500/10', badgeBorder: 'border-red-500/30',
    Icon: XCircle, label: 'BLOCKED — Forest Conflict', statusLabel: 'BLOCKED',
  },
  unknown: {
    badge: 'text-[#6B7280]', badgeBg: 'bg-white/5', badgeBorder: 'border-[#2A2D35]',
    Icon: HelpCircle, label: 'NOT CHECKED', statusLabel: 'CHECK',
  },
}

const EVENT_ICON: Record<string, typeof ClipboardList> = {
  photo_evidence_uploaded: Camera,
  eudr_assessment_run: RefreshCw,
  plot_boundary_recorded: MapPin,
}

export default function EUDRFleetClient({
  plots,
  recentEvents
}: {
  plots: PlotCompliance[]
  recentEvents: any[]
}) {
  const summary = {
    green: plots.filter(p => p.riskLevel === 'green').length,
    yellow: plots.filter(p => p.riskLevel === 'yellow').length,
    red: plots.filter(p => p.riskLevel === 'red').length,
    total: plots.length,
  }

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {recentEvents.length > 0 && (
          <div className="bg-[#0D0F14] rounded-xl p-4 border border-[#2A2D35]">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#6B7280] uppercase tracking-wide mb-3">
              <ClipboardList size={13} strokeWidth={1.5} />
              Recent Compliance Activities
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentEvents.map((event, idx) => {
                const EventIcon = EVENT_ICON[event.event_type] || ClipboardList
                return (
                  <div key={idx} className="flex items-start gap-2.5 text-xs bg-[#17191F] border border-[#2A2D35] rounded-lg p-2">
                    <EventIcon size={13} strokeWidth={1.5} className="flex-shrink-0 mt-0.5 text-[#6B7280]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 font-semibold capitalize">
                        {event.event_type?.replace(/_/g, ' ')}
                      </p>
                      {event.risk_level && (
                        <p className={`text-xs mt-0.5 font-semibold ${
                          event.risk_level === 'low' ? 'text-emerald-400' :
                          event.risk_level === 'medium' ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          Risk: {event.risk_level}
                        </p>
                      )}
                      {event.created_at_local_tz && (
                        <p className="text-[#6B7280] text-xs mt-1">
                          {new Date(event.created_at_local_tz).toLocaleDateString('en-KE')} {new Date(event.created_at_local_tz).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Clear', count: summary.green, cfg: RISK_CONFIG.green },
            { label: 'Verify', count: summary.yellow, cfg: RISK_CONFIG.yellow },
            { label: 'Blocked', count: summary.red, cfg: RISK_CONFIG.red },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border ${s.cfg.badgeBorder} ${s.cfg.badgeBg} p-4 text-center`}>
              <s.cfg.Icon size={20} strokeWidth={1.5} className={`mx-auto mb-1 ${s.cfg.badge}`} />
              <p className={`text-3xl font-bold ${s.cfg.badge}`}>{s.count}</p>
              <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Deadline banner (sourced from eudr-constants — dates have shifted twice) ── */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3 items-start">
          <Calendar size={18} strokeWidth={1.5} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-300 text-sm">
              EUDR Enforcement Deadline
            </p>
            <p className="text-amber-200/80 text-xs mt-1 space-y-1">
              <span className="block">
                <strong>Small/micro operators</strong> (most Kenyan farmers): <strong>{EUDR_DEADLINE_SMALL_LABEL}</strong>
                {' '}— {daysUntilEudrDeadline()} days away.
              </span>
              <span className="block">
                <strong>Large/medium operators</strong>: {EUDR_DEADLINE_LARGE_LABEL}.
              </span>
              <span className="block mt-1">
                Coffee exported to the EU must have due-diligence statements with GPS evidence and deforestation-free proof per plot.
              </span>
            </p>
          </div>
        </div>

        {/* ── Kenya standard-risk tier explainer ──────────────────────────────── */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-xl p-4 flex gap-3 items-start">
          <span className="flex-shrink-0 text-xs font-bold text-[#6B7280] mt-0.5">KE</span>
          <div>
            <p className="font-bold text-slate-200 text-sm">Kenya Risk Tier: Standard</p>
            <p className="text-[#6B7280] text-xs mt-1 leading-relaxed">{KENYA_RISK_TIER_EXPLAINER}</p>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280] mb-3">Your Plots</h2>
          <div className="space-y-3">
            {plots.length === 0 ? (
              <div className="bg-[#0D0F14] rounded-lg border border-dashed border-[#2A2D35] p-8 text-center">
                <Leaf size={28} strokeWidth={1.5} className="mx-auto mb-3 text-[#6B7280]" />
                <p className="text-[#6B7280]">No coffee plots found.</p>
                <Link
                  href="/dashboard/coffee/plots/add"
                  className="mt-3 inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus size={14} strokeWidth={2} />
                  Add Plot
                </Link>
              </div>
            ) : (
              plots.map(plot => {
                const r = RISK_CONFIG[plot.riskLevel]
                return (
                  <Link
                    key={plot.plotId}
                    href={`/dashboard/coffee/eudr-check/${plot.plotId}`}
                    className="block bg-[#0D0F14] border border-[#2A2D35] hover:border-emerald-700/60 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border ${r.badgeBg} ${r.badgeBorder}`}>
                        <r.Icon size={22} strokeWidth={1.5} className={r.badge} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-white text-base leading-tight">{plot.plotName}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 border ${r.badgeBg} ${r.badgeBorder} ${r.badge}`}>
                            {r.statusLabel}
                          </span>
                        </div>
                        <p className="text-[#6B7280] text-xs mt-0.5">
                          {plot.areaHectares ? `${plot.areaHectares} ha` : 'Area unknown'}
                          {plot.latestNdvi !== null && ` · NDVI ${plot.latestNdvi.toFixed(2)} (${plot.healthLabel || '—'})`}
                        </p>

                        <div className="flex gap-3 mt-2">
                          <span className={`flex items-center gap-1 text-xs ${plot.hasGps ? 'text-emerald-400' : 'text-red-400'}`}>
                            {plot.hasGps ? <CheckCircle2 size={11} strokeWidth={2} /> : <XCircle size={11} strokeWidth={2} />} GPS
                          </span>
                          <span className={`flex items-center gap-1 text-xs ${plot.hasLandDoc ? 'text-emerald-400' : 'text-red-400'}`}>
                            {plot.hasLandDoc ? <CheckCircle2 size={11} strokeWidth={2} /> : <XCircle size={11} strokeWidth={2} />} Land Title
                          </span>
                          <span className={`flex items-center gap-1 text-xs ${plot.deforestationRisk === 'low' ? 'text-emerald-400' : plot.deforestationRisk === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                            {plot.deforestationRisk === 'low' ? <CheckCircle2 size={11} strokeWidth={2} /> : <AlertTriangle size={11} strokeWidth={2} />} Forest Check
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={18} strokeWidth={1.5} className="text-[#6B7280] flex-shrink-0" />
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        <div className="bg-[#0D0F14] rounded-xl p-4 border border-[#2A2D35]">
          <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wide mb-3">What do the statuses mean?</p>
          <div className="space-y-2">
            {[
              { cfg: RISK_CONFIG.green, label: 'CLEAR', desc: 'No forest detected before or after Dec 31, 2020. Plot is ready for export.' },
              { cfg: RISK_CONFIG.yellow, label: 'VERIFY', desc: 'Forest was detected near the cutoff date, or documents are missing. Needs review.' },
              { cfg: RISK_CONFIG.red, label: 'BLOCKED', desc: 'Significant tree cover loss detected AFTER Jan 1, 2021. Cannot be exported until resolved.' },
            ].map(item => (
              <div key={item.label} className="flex gap-3 items-start">
                <item.cfg.Icon size={16} strokeWidth={1.5} className={`flex-shrink-0 mt-0.5 ${item.cfg.badge}`} />
                <div>
                  <p className="text-white text-sm font-semibold">{item.label}</p>
                  <p className="text-[#6B7280] text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'

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
  bg: string; border: string; badge: string; badgeBg: string;
  icon: string; label: string; textColor: string;
}> = {
  green: {
    bg: 'bg-green-50', border: 'border-green-400',
    badge: 'text-green-800', badgeBg: 'bg-green-100',
    icon: '✅', label: 'CLEAR — Ready for Export', textColor: 'text-green-700'
  },
  yellow: {
    bg: 'bg-amber-50', border: 'border-amber-400',
    badge: 'text-amber-900', badgeBg: 'bg-amber-100',
    icon: '⚠️', label: 'VERIFY — Action Needed', textColor: 'text-amber-700'
  },
  red: {
    bg: 'bg-red-50', border: 'border-red-500',
    badge: 'text-red-900', badgeBg: 'bg-red-100',
    icon: '🚫', label: 'BLOCKED — Forest Conflict', textColor: 'text-red-700'
  },
  unknown: {
    bg: 'bg-slate-50', border: 'border-slate-300',
    badge: 'text-slate-700', badgeBg: 'bg-slate-100',
    icon: '❓', label: 'NOT CHECKED', textColor: 'text-slate-600'
  },
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

  const overallStatus: RiskLevel =
    summary.red > 0 ? 'red' :
    summary.yellow > 0 ? 'yellow' :
    summary.green === summary.total && summary.total > 0 ? 'green' : 'unknown'

  const cfg = RISK_CONFIG[overallStatus]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className={`w-full py-6 px-4 ${
        overallStatus === 'green' ? 'bg-green-700' :
        overallStatus === 'yellow' ? 'bg-amber-600' :
        overallStatus === 'red' ? 'bg-red-700' : 'bg-slate-700'
      }`}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{cfg.icon}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">EUDR Compliance Status</p>
              <h1 className="text-2xl font-black mt-0.5">{cfg.label}</h1>
              <p className="text-sm opacity-80 mt-1">
                {summary.green} clear · {summary.yellow} need action · {summary.red} blocked — out of {summary.total} plots
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {recentEvents.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">📋 Recent Compliance Activities</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentEvents.map((event, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs bg-slate-700 rounded-lg p-2">
                  <span className="flex-shrink-0 mt-0.5">
                    {event.event_type === 'photo_evidence_uploaded' ? '📷' :
                     event.event_type === 'eudr_assessment_run' ? '🔄' :
                     event.event_type === 'plot_boundary_recorded' ? '📍' : '📝'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 font-semibold capitalize">
                      {event.event_type?.replace(/_/g, ' ')}
                    </p>
                    {event.risk_level && (
                      <p className={`text-xs mt-0.5 font-semibold ${
                        event.risk_level === 'low' ? 'text-green-400' :
                        event.risk_level === 'medium' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        Risk: {event.risk_level}
                      </p>
                    )}
                    {event.created_at_local_tz && (
                      <p className="text-slate-500 text-xs mt-1">
                        {new Date(event.created_at_local_tz).toLocaleDateString('en-KE')} {new Date(event.created_at_local_tz).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Clear', count: summary.green, color: 'bg-green-900 border-green-600', text: 'text-green-400', icon: '✅' },
            { label: 'Verify', count: summary.yellow, color: 'bg-amber-900 border-amber-600', text: 'text-amber-400', icon: '⚠️' },
            { label: 'Blocked', count: summary.red, color: 'bg-red-900 border-red-700', text: 'text-red-400', icon: '🚫' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border-2 ${s.color} p-4 text-center`}>
              <p className="text-2xl">{s.icon}</p>
              <p className={`text-3xl font-black ${s.text}`}>{s.count}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-amber-950 border-2 border-amber-500 rounded-xl p-4 flex gap-3 items-start">
          <span className="text-2xl flex-shrink-0">📅</span>
          <div>
            <p className="font-bold text-amber-300 text-sm">EUDR Enforcement — Dec 30, 2025</p>
            <p className="text-amber-200 text-xs mt-1">
              All plots must be fully verified before this date. Coffee exported to the EU must have due-diligence statements with GPS polygons and deforestation-free proof.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Your Plots</h2>
          <div className="space-y-3">
            {plots.length === 0 ? (
              <div className="bg-slate-800 rounded-xl p-8 text-center">
                <p className="text-4xl mb-3">🌿</p>
                <p className="text-slate-400">No coffee plots found.</p>
                <Link href="/dashboard/coffee/add-plot" className="mt-3 inline-block bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-lg">
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
                    className="block bg-slate-800 border-2 border-slate-700 hover:border-slate-500 rounded-xl p-4 transition-all active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 ${r.badgeBg}`}>
                        {r.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-white text-base leading-tight">{plot.plotName}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${r.badgeBg} ${r.badge}`}>
                            {plot.riskLevel === 'green' ? 'CLEAR' :
                             plot.riskLevel === 'yellow' ? 'VERIFY' :
                             plot.riskLevel === 'red' ? 'BLOCKED' : 'CHECK'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {plot.areaHectares ? `${plot.areaHectares} ha` : 'Area unknown'}
                          {plot.latestNdvi !== null && ` · NDVI ${plot.latestNdvi.toFixed(2)} (${plot.healthLabel || '—'})`}
                        </p>

                        <div className="flex gap-3 mt-2">
                          <span className={`text-xs ${plot.hasGps ? 'text-green-400' : 'text-red-400'}`}>
                            {plot.hasGps ? '✓' : '✗'} GPS
                          </span>
                          <span className={`text-xs ${plot.hasLandDoc ? 'text-green-400' : 'text-red-400'}`}>
                            {plot.hasLandDoc ? '✓' : '✗'} Land Title
                          </span>
                          <span className={`text-xs ${plot.deforestationRisk === 'low' ? 'text-green-400' : plot.deforestationRisk === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                            {plot.deforestationRisk === 'low' ? '✓' : '⚠'} Forest Check
                          </span>
                        </div>
                      </div>

                      <span className="text-slate-500 text-lg flex-shrink-0">›</span>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">What do the statuses mean?</p>
          <div className="space-y-2">
            {[
              { icon: '✅', label: 'CLEAR', desc: 'No forest detected before or after Dec 31, 2020. Plot is ready for export.' },
              { icon: '⚠️', label: 'VERIFY', desc: 'Forest was detected near the cutoff date, or documents are missing. Needs review.' },
              { icon: '🚫', label: 'BLOCKED', desc: 'Significant tree cover loss detected AFTER Jan 1, 2021. Cannot be exported until resolved.' },
            ].map(item => (
              <div key={item.label} className="flex gap-3 items-start">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-white text-sm font-bold">{item.label}</p>
                  <p className="text-slate-400 text-xs">{item.desc}</p>
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

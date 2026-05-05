'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Severity = 'info' | 'warning' | 'critical'
type WarningType =
  | 'estrus_predicted'
  | 'weight_loss_alert'
  | 'kidding_due'
  | 'health_gap_alert'
  | 'pregnancy_check_due'
  | 'disease_risk'
  | 'parasite_risk'

interface Warning {
  animalId: string; animalTag: string; species: 'goat' | 'sheep'
  warningType: WarningType; severity: Severity; title: string; detail: string
  actionRequired: string; predictedDate: string | null; confidence: number
}

const WARNING_CONFIG: Record<WarningType, { icon: string; color: string }> = {
  estrus_predicted:     { icon: '🔥', color: 'pink' },
  weight_loss_alert:    { icon: '⚖️', color: 'red' },
  kidding_due:          { icon: '🐐', color: 'blue' },
  health_gap_alert:     { icon: '🩺', color: 'slate' },
  pregnancy_check_due:  { icon: '🔬', color: 'purple' },
  disease_risk:         { icon: '⚠️', color: 'amber' },
  parasite_risk:        { icon: '🪱', color: 'orange' },
}

const SEVERITY_CONFIG: Record<Severity, { bg: string; border: string; badge: string; badgeBg: string; dot: string }> = {
  critical: { bg: 'bg-red-950',    border: 'border-red-600',    badge: 'text-red-300',    badgeBg: 'bg-red-800',    dot: 'bg-red-500' },
  warning:  { bg: 'bg-amber-950',  border: 'border-amber-600',  badge: 'text-amber-300',  badgeBg: 'bg-amber-800',  dot: 'bg-amber-500' },
  info:     { bg: 'bg-blue-950',   border: 'border-blue-700',   badge: 'text-blue-300',   badgeBg: 'bg-blue-800',   dot: 'bg-blue-400' },
}

function WarningCard({ w }: { w: Warning }) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEVERITY_CONFIG[w.severity]
  const wc = WARNING_CONFIG[w.warningType]
  return (
    <div className={`rounded-xl border-2 ${sev.bg} ${sev.border} overflow-hidden`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">{wc.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-white text-base">{w.animalTag}</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sev.badgeBg} ${sev.badge} uppercase`}>
                {w.severity}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">
                {w.species}
              </span>
            </div>
            <p className="text-white text-sm font-semibold mt-0.5">{w.title}</p>
            <p className="text-slate-300 text-xs mt-0.5 line-clamp-2">{w.detail}</p>
          </div>
          <span className="text-slate-500 text-sm flex-shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Detail</p>
            <p className="text-slate-200 text-sm mt-1">{w.detail}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 flex items-start gap-2">
            <span className="text-lg">👉</span>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Action Required</p>
              <p className="text-white text-sm font-semibold mt-0.5">{w.actionRequired}</p>
            </div>
          </div>
          {w.predictedDate && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">📅 Date:</span>
              <span className="text-white font-bold">
                {new Date(w.predictedDate).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${sev.dot}`} style={{ width: `${w.confidence}%` }} />
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">{w.confidence}% confidence</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SmallRuminantsWarningsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [analyzedCount, setAnalyzedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<string | null>(null)

  const criticals = warnings.filter(w => w.severity === 'critical')
  const warningsOnly = warnings.filter(w => w.severity === 'warning')
  const infos = warnings.filter(w => w.severity === 'info')

  const heatAlerts = warnings.filter(w => w.warningType === 'estrus_predicted')

  async function runAnalysis() {
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch('/api/ai/livestock-warnings/small-ruminants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Analysis failed')
      }
      const data = await res.json()
      setWarnings(data.warnings || [])
      setAnalyzedCount(data.analyzedCount || 0)
      setLastRun(new Date().toLocaleTimeString('en-KE'))
      setFetched(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const overallStatus = criticals.length > 0 ? 'critical' :
    warningsOnly.length > 0 ? 'warning' :
    fetched ? 'clear' : 'idle'

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/smallRuminants" className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600 transition">←</Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white leading-none">🐐 Small Ruminants Early Warnings</h1>
            <p className="text-xs text-slate-400 mt-0.5">AI-powered heat, health & weight alerts</p>
          </div>
          {lastRun && <p className="text-xs text-slate-500">Last run: {lastRun}</p>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Status Banner */}
        {!fetched ? (
          <div className="bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl p-8 text-center">
            <p className="text-5xl mb-3">🤖</p>
            <p className="text-white font-bold text-lg">AI Early Warning System</p>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
              Analyses weight trends, breeding records, and health history for goats and sheep.
            </p>
          </div>
        ) : (
          <div className={`rounded-xl px-5 py-4 ${
            overallStatus === 'critical' ? 'bg-red-700' :
            overallStatus === 'warning'  ? 'bg-amber-600' : 'bg-green-700'
          }`}>
            <div className="flex items-center gap-4">
              <span className="text-4xl">
                {overallStatus === 'critical' ? '🚨' : overallStatus === 'warning' ? '⚠️' : '✅'}
              </span>
              <div>
                <p className="font-black text-white text-lg">
                  {overallStatus === 'critical' ? `${criticals.length} CRITICAL ALERT${criticals.length > 1 ? 'S' : ''}` :
                   overallStatus === 'warning'  ? `${warningsOnly.length} WARNING${warningsOnly.length > 1 ? 'S' : ''} DETECTED` :
                   'ALL CLEAR — Flock Healthy'}
                </p>
                <p className="text-white opacity-80 text-sm">
                  {analyzedCount} animals analysed · {warnings.length} total alert{warnings.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Heat Calendar Strip */}
        {heatAlerts.length > 0 && (
          <div className="bg-pink-950 border-2 border-pink-700 rounded-xl p-4">
            <p className="text-xs font-bold text-pink-300 uppercase tracking-widest mb-3">🔥 Predicted Estrus Windows</p>
            <div className="space-y-2">
              {heatAlerts.map((w, i) => (
                <div key={i} className="flex items-center justify-between bg-pink-900 rounded-lg px-3 py-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-white font-bold text-sm">{w.animalTag}</p>
                      <span className="text-[9px] font-bold px-1 rounded bg-pink-800 text-pink-200 uppercase">{w.species}</span>
                    </div>
                    <p className="text-pink-300 text-xs">{w.actionRequired}</p>
                  </div>
                  {w.predictedDate && (
                    <div className="text-right">
                      <p className="text-white font-black text-sm">
                        {new Date(w.predictedDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-pink-400 text-xs">Heat window</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Run Button */}
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="w-full bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-700 text-white font-black py-4 rounded-xl text-base flex items-center justify-center gap-2 transition"
        >
          {loading ? (
            <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Analysing flock with AI...</>
          ) : (
            <>{fetched ? '🔄 Re-run Analysis' : '🚀 Run AI Analysis Now'}</>
          )}
        </button>

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-3 text-sm text-red-300">
            ❌ {error}
          </div>
        )}

        {/* Warnings List */}
        {fetched && warnings.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">🌿</p>
            <p className="text-green-400 font-bold text-lg">All Clear!</p>
            <p className="text-slate-400 text-sm mt-1">No anomalies detected in your flock.</p>
          </div>
        )}

        {criticals.length > 0 && (
          <div>
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">🚨 Critical ({criticals.length})</p>
            <div className="space-y-3">{criticals.map((w, i) => <WarningCard key={i} w={w} />)}</div>
          </div>
        )}

        {warningsOnly.length > 0 && (
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">⚠️ Warnings ({warningsOnly.length})</p>
            <div className="space-y-3">{warningsOnly.map((w, i) => <WarningCard key={i} w={w} />)}</div>
          </div>
        )}

        {infos.length > 0 && (
          <div>
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">ℹ️ Reminders ({infos.length})</p>
            <div className="space-y-3">{infos.map((w, i) => <WarningCard key={i} w={w} />)}</div>
          </div>
        )}

        {/* Info Footer */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">How it works</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            <p>🔥 <span className="text-white">Estrus prediction</span> — Based on species-specific cycles (Goat 19d, Sheep 17d)</p>
            <p>⚖️ <span className="text-white">Weight loss</span> — Alerts for &gt;10% drop in 90 days (disease/parasite signal)</p>
            <p>🐐 <span className="text-white">Kidding alert</span> — Triggered 14 days before expected kidding</p>
            <p>🪱 <span className="text-white">Parasite risk</span> — Detected from weight loss + no recent deworming</p>
          </div>
        </div>
        <div className="h-6" />
      </div>
    </div>
  )
}

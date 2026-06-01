'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp,
  ArrowLeft, Loader2, CheckCircle2, RefreshCw, Brain,
} from 'lucide-react'

type Severity = 'info' | 'warning' | 'critical'
type WarningType =
  | 'heat_predicted' | 'milk_decline_anomaly' | 'calving_due'
  | 'health_check_overdue' | 'pregnancy_check_due' | 'mastitis_risk'

interface Warning {
  cowId: string
  cowTag: string
  warningType: WarningType
  severity: Severity
  title: string
  detail: string
  actionRequired: string
  predictedDate: string | null
  confidence: number
}

const SEV_STYLES: Record<Severity, {
  row: string; badge: string; dot: string; icon: React.ElementType
}> = {
  critical: {
    row:   'border-red-900/40 bg-red-950/20',
    badge: 'text-red-400 bg-red-950/50 border-red-900/40',
    dot:   'bg-red-500',
    icon:  AlertCircle,
  },
  warning: {
    row:   'border-amber-900/40 bg-amber-950/20',
    badge: 'text-amber-400 bg-amber-950/50 border-amber-900/40',
    dot:   'bg-amber-500',
    icon:  AlertTriangle,
  },
  info: {
    row:   'border-blue-900/40 bg-blue-950/20',
    badge: 'text-blue-400 bg-blue-950/50 border-blue-900/40',
    dot:   'bg-blue-400',
    icon:  Info,
  },
}

const WARNING_LABELS: Record<WarningType, string> = {
  heat_predicted:       'Heat predicted',
  milk_decline_anomaly: 'Milk decline',
  calving_due:          'Calving due',
  health_check_overdue: 'Health overdue',
  pregnancy_check_due:  'Pregnancy check',
  mastitis_risk:        'Mastitis risk',
}

const HOW_IT_WORKS = [
  { label: 'Heat prediction',    desc: '18–24 day cycle from last service date',      dot: 'bg-blue-400'   },
  { label: 'Milk anomaly',       desc: 'Flags sustained >15% drop outside dry-off',   dot: 'bg-amber-500'  },
  { label: 'Calving alert',      desc: 'Triggered 14 days before expected calving',    dot: 'bg-emerald-500' },
  { label: 'Mastitis risk',      desc: 'Uneven AM/PM ratio + declining trend',         dot: 'bg-red-500'    },
]

function WarningCard({ w }: { w: Warning }) {
  const [open, setOpen] = useState(false)
  const s = SEV_STYLES[w.severity]
  const SevIcon = s.icon
  return (
    <div className={`rounded-lg border ${s.row} overflow-hidden`}>
      <button className="w-full text-left px-4 py-3" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{w.cowTag}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${s.badge}`}>
                {w.severity}
              </span>
              <span className="text-[10px] text-[#6B7280] capitalize">
                {WARNING_LABELS[w.warningType] ?? w.warningType}
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{w.title}</p>
          </div>
          <SevIcon size={13} className="text-[#6B7280] flex-shrink-0" />
          {open
            ? <ChevronUp size={13} className="text-[#6B7280]" />
            : <ChevronDown size={13} className="text-[#6B7280]" />
          }
        </div>
      </button>

      {open && (
        <div className="border-t border-[#2A2D35] px-4 py-3 space-y-3">
          <p className="text-sm text-[#9CA3AF] leading-relaxed">{w.detail}</p>

          <div className="rounded-md border border-[#2A2D35] bg-[#0D0F14] px-3 py-2.5">
            <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-1">
              Action required
            </p>
            <p className="text-sm text-white">{w.actionRequired}</p>
          </div>

          {w.predictedDate && (
            <p className="text-xs text-[#6B7280]">
              Predicted date:{' '}
              <span className="text-[#9CA3AF]">
                {new Date(w.predictedDate).toLocaleDateString('en-KE', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
              {' '}· Confidence: <span className="text-[#9CA3AF]">{w.confidence}%</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function DairyWarningsPage() {
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading,  setLoading]  = useState(false)
  const [fetched,  setFetched]  = useState(false)
  const [analyzed, setAnalyzed] = useState(0)
  const [error,    setError]    = useState('')
  const [lastRun,  setLastRun]  = useState('')

  async function runAnalysis() {
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth/login'; return }

      const res = await fetch('/api/ai/livestock-warnings/dairy', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Analysis failed (${res.status})`)
      }
      const data = await res.json()
      setWarnings(data.warnings   ?? [])
      setAnalyzed(data.analyzedCount ?? 0)
      setLastRun(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }))
      setFetched(true)
    } catch (e: any) {
      setError(e.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const critical  = warnings.filter(w => w.severity === 'critical')
  const warningLv = warnings.filter(w => w.severity === 'warning')
  const infoLv    = warnings.filter(w => w.severity === 'info')

  return (
    <div className="min-h-screen bg-[#070809]">

      {/* Sub-nav */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            <Link
              href="/dashboard/dairy"
              className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors"
            >
              <ArrowLeft size={12} /> Dairy
            </Link>
            {lastRun && (
              <span className="text-[10px] text-[#4B5563]">Last run {lastRun}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={15} className="text-[#6B7280]" />
            <p className="text-xs font-medium text-[#4B5563]">AI Early Warnings</p>
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Dairy alerts</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Heat, mastitis, calving, and milk-decline predictions
          </p>
        </div>

        {/* Idle state */}
        {!fetched && !loading && (
          <div className="rounded-lg border border-dashed border-[#2A2D35] p-10 text-center">
            <Brain size={28} className="text-[#4B5563] mx-auto mb-3" />
            <p className="text-sm font-medium text-white mb-1">AI analysis not yet run</p>
            <p className="text-xs text-[#6B7280] max-w-xs mx-auto">
              Analyses milk trends, breeding records, and health history
              to surface actionable alerts before issues escalate.
            </p>
          </div>
        )}

        {/* Status banner (post-fetch) */}
        {fetched && (
          <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
            critical.length  > 0 ? 'border-red-900/40 bg-red-950/20'    :
            warningLv.length > 0 ? 'border-amber-900/40 bg-amber-950/20' :
                                   'border-emerald-900/40 bg-emerald-950/20'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              critical.length  > 0 ? 'bg-red-500'    :
              warningLv.length > 0 ? 'bg-amber-500'  : 'bg-emerald-500'
            }`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                {critical.length > 0
                  ? `${critical.length} critical alert${critical.length > 1 ? 's' : ''}`
                  : warningLv.length > 0
                  ? `${warningLv.length} warning${warningLv.length > 1 ? 's' : ''} detected`
                  : 'All clear — herd healthy'}
              </p>
              <p className="text-[11px] text-[#6B7280]">
                {analyzed} cows analysed · {warnings.length} total alert{warnings.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Run button */}
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> Analysing herd…</>
          ) : (
            <><RefreshCw size={14} /> {fetched ? 'Re-run analysis' : 'Run AI analysis'}</>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-red-900/40 bg-red-950/20">
            <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* No alerts */}
        {fetched && warnings.length === 0 && (
          <div className="flex items-center gap-2 p-4 rounded-md border border-emerald-900/40 bg-emerald-950/20">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">No anomalies detected. Your herd looks healthy.</p>
          </div>
        )}

        {/* Critical */}
        {critical.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">
              Critical ({critical.length})
            </p>
            {critical.map((w, i) => <WarningCard key={i} w={w} />)}
          </div>
        )}

        {/* Warnings */}
        {warningLv.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">
              Warnings ({warningLv.length})
            </p>
            {warningLv.map((w, i) => <WarningCard key={i} w={w} />)}
          </div>
        )}

        {/* Info */}
        {infoLv.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">
              Reminders ({infoLv.length})
            </p>
            {infoLv.map((w, i) => <WarningCard key={i} w={w} />)}
          </div>
        )}

        {/* How it works */}
        <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4 space-y-3">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">
            How alerts work
          </p>
          {HOW_IT_WORKS.map(({ label, desc, dot }) => (
            <div key={label} className="flex items-start gap-2.5">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
              <div>
                <span className="text-xs font-medium text-[#9CA3AF]">{label}</span>
                <span className="text-xs text-[#6B7280]"> — {desc}</span>
              </div>
            </div>
          ))}
        </section>

      </div>
    </div>
  )
}
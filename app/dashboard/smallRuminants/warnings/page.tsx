'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

type Severity = 'info' | 'warning' | 'critical'
type WarningType = 'estrus_predicted' | 'weight_loss_alert' | 'kidding_due' | 'health_gap_alert' | 'pregnancy_check_due' | 'disease_risk' | 'parasite_risk'

interface Warning {
  animalId: string; animalTag: string; species: 'goat' | 'sheep'
  warningType: WarningType; severity: Severity; title: string; detail: string
  actionRequired: string; predictedDate: string | null; confidence: number
}

const SEV_STYLES: Record<Severity, { row: string; badge: string; dot: string; icon: React.ElementType }> = {
  critical: { row: 'border-red-900/40 bg-red-950/20',    badge: 'text-red-400 bg-red-950/50 border-red-900/40',   dot: 'bg-red-500',   icon: AlertCircle   },
  warning:  { row: 'border-amber-900/40 bg-amber-950/20', badge: 'text-amber-400 bg-amber-950/50 border-amber-900/40', dot: 'bg-amber-500', icon: AlertTriangle },
  info:     { row: 'border-blue-900/40 bg-blue-950/20',   badge: 'text-blue-400 bg-blue-950/50 border-blue-900/40',  dot: 'bg-blue-400',  icon: Info          },
}

const WARNING_LABELS: Record<WarningType, string> = {
  estrus_predicted:     'Heat predicted',
  weight_loss_alert:    'Weight loss',
  kidding_due:          'Kidding due',
  health_gap_alert:     'Health gap',
  pregnancy_check_due:  'Pregnancy check',
  disease_risk:         'Disease risk',
  parasite_risk:        'Parasite risk',
}

function WarningCard({ w }: { w: Warning }) {
  const [expanded, setExpanded] = useState(false)
  const s = SEV_STYLES[w.severity]
  const SevIcon = s.icon
  return (
    <div className={`rounded-lg border ${s.row} overflow-hidden`}>
      <button className="w-full text-left px-4 py-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{w.animalTag}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${s.badge}`}>
                {w.severity}
              </span>
              <span className="text-[10px] text-[#6B7280] capitalize">{w.species}</span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{w.title}</p>
          </div>
          <SevIcon size={13} className="text-[#6B7280] flex-shrink-0" />
          {expanded ? <ChevronUp size={13} className="text-[#6B7280]" /> : <ChevronDown size={13} className="text-[#6B7280]" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[#2A2D35] px-4 py-3 space-y-3">
          <p className="text-sm text-[#9CA3AF] leading-relaxed">{w.detail}</p>
          <div className="rounded-md border border-[#2A2D35] bg-[#0D0F14] px-3 py-2.5">
            <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-1">Action required</p>
            <p className="text-sm text-white">{w.actionRequired}</p>
          </div>
          {w.predictedDate && (
            <p className="text-xs text-[#6B7280]">
              Predicted date: <span className="text-[#9CA3AF]">{new Date(w.predictedDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {' '}· Confidence: <span className="text-[#9CA3AF]">{w.confidence}%</span>
            </p>
          )}
          <Link href={`/dashboard/smallRuminants/animal/${w.animalId}`}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
            View animal →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function WarningsPage() {
  const [supabase] = useState(() => createClient())
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/ai/livestock-warnings/small-ruminants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({}),
        })
        if (!res.ok) throw new Error('Failed to load warnings')
        const data = await res.json()
        setWarnings(data.warnings || [])
      } catch (e: any) {
        setError(e.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const critical = warnings.filter(w => w.severity === 'critical')
  const warningL = warnings.filter(w => w.severity === 'warning')
  const infoL    = warnings.filter(w => w.severity === 'info')

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Link href="/dashboard/smallRuminants"
            className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors mb-4">
            <ArrowLeft size={13} /> Back to flock
          </Link>
          <h1 className="text-xl font-semibold text-white tracking-tight">Early warnings</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">AI-generated health and management alerts</p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-[#6B7280] py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /><span className="text-sm">Analysing flock data…</span>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-red-800/50 bg-red-950/20">
            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && warnings.length === 0 && (
          <div className="flex items-center gap-2 p-4 rounded-md border border-emerald-800/50 bg-emerald-950/20">
            <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">No active warnings. Your flock looks healthy.</p>
          </div>
        )}

        {critical.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Critical ({critical.length})</p>
            {critical.map((w, i) => <WarningCard key={i} w={w} />)}
          </div>
        )}
        {warningL.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Warnings ({warningL.length})</p>
            {warningL.map((w, i) => <WarningCard key={i} w={w} />)}
          </div>
        )}
        {infoL.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Information ({infoL.length})</p>
            {infoL.map((w, i) => <WarningCard key={i} w={w} />)}
          </div>
        )}

        {/* Legend */}
        {!loading && warnings.length > 0 && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4 space-y-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-3">How alerts work</p>
            {[
              { label: 'Kidding due',    desc: 'Triggered 14 days before expected kidding', dot: 'bg-blue-400' },
              { label: 'Heat predicted', desc: 'Based on 21-day cycle from last service',   dot: 'bg-blue-400' },
              { label: 'Weight loss',    desc: 'Detected from consecutive weight records',  dot: 'bg-amber-500' },
              { label: 'Disease risk',   desc: 'Seasonal or proximity-based risk model',    dot: 'bg-red-500'   },
            ].map(({ label, desc, dot }) => (
              <div key={label} className="flex items-start gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                <div>
                  <span className="text-xs font-medium text-[#9CA3AF]">{label}</span>
                  <span className="text-xs text-[#6B7280]"> — {desc}</span>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
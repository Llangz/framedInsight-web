'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, ChevronDown, ChevronUp, CheckCircle,
  AlertTriangle, AlertCircle, ShieldAlert, Eye, Search,
  FlaskConical, Clock,
} from 'lucide-react'

type AlertStatus    = 'resolved' | 'pending_action' | 'overdue' | 'action_required' | 'monitoring'
type AlertLevel     = 'none' | 'watch' | 'action_required' | 'emergency'
type SeverityLevel  = 'none' | 'light' | 'moderate' | 'severe'

interface ScoutingAlert {
  scouting_record_id: string
  farm_id: string
  farm_name: string
  plot_id: string
  plot_name: string
  scouting_date: string
  observation_type: string
  severity_level: SeverityLevel | null
  pest_count_per_tree: number | null
  threshold_breached: boolean
  alert_level: AlertLevel
  action_taken: string
  action_threshold: string | null
  action_count: number | null
  recommended_product: string | null
  application_notes: string | null
  days_since_detection: number
  status: AlertStatus
}

interface ScoutingRecord {
  id: string
  plot_id: string
  plot_name?: string
  scouting_date: string
  observation_type: string
  severity_level: SeverityLevel | null
  pest_count_per_tree: number | null
  threshold_breached: boolean
  alert_level: AlertLevel
  action_taken: string
  scouted_by: string | null
  notes: string | null
  created_at: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const OBSERVATION_LABELS: Record<string, string> = {
  cbd:          'Coffee Berry Disease',
  clr:          'Coffee Leaf Rust',
  antestia:     'Antestia Bug',
  thrips:       'Thrips',
  mealybugs:    'Mealybugs',
  stem_borer:   'White Stem Borer',
  leaf_miner:   'Leaf Miner',
  root_disease: 'Root Disease',
  other_pest:   'Other Pest',
  healthy:      'Healthy',
}

const ALERT_CONFIG: Record<AlertLevel, {
  label: string
  textColor: string
  bgColor: string
  borderColor: string
  icon: React.ElementType
}> = {
  emergency:        { label: 'Emergency',       textColor: 'text-red-400',    bgColor: 'bg-red-950/40',    borderColor: 'border-red-900/60',    icon: ShieldAlert },
  action_required:  { label: 'Action Required', textColor: 'text-amber-400',  bgColor: 'bg-amber-950/30',  borderColor: 'border-amber-900/50',  icon: AlertTriangle },
  watch:            { label: 'Watch',           textColor: 'text-yellow-400', bgColor: 'bg-yellow-950/20', borderColor: 'border-yellow-900/40', icon: Eye },
  none:             { label: 'Monitoring',      textColor: 'text-emerald-400',bgColor: 'bg-emerald-950/20',borderColor: 'border-emerald-900/40',icon: CheckCircle },
}

const STATUS_CONFIG: Record<AlertStatus, { label: string; textColor: string; dotColor: string }> = {
  resolved:        { label: 'Resolved',        textColor: 'text-emerald-400', dotColor: 'bg-emerald-500' },
  pending_action:  { label: 'Pending Action',  textColor: 'text-[#9CA3AF]',   dotColor: 'bg-[#6B7280]'   },
  overdue:         { label: 'Overdue',         textColor: 'text-red-400',     dotColor: 'bg-red-500'     },
  action_required: { label: 'Action Required', textColor: 'text-amber-400',   dotColor: 'bg-amber-500'   },
  monitoring:      { label: 'Monitoring',      textColor: 'text-[#6B7280]',   dotColor: 'bg-[#4B5563]'   },
}

const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  none:     'text-emerald-400',
  light:    'text-yellow-400',
  moderate: 'text-amber-400',
  severe:   'text-red-400',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysAgo(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: ScoutingAlert }) {
  const [expanded, setExpanded] = useState(false)
  const levelCfg  = ALERT_CONFIG[alert.alert_level]
  const statusCfg = STATUS_CONFIG[alert.status]
  const LevelIcon = levelCfg.icon

  return (
    <div className={`rounded-lg border ${levelCfg.borderColor} overflow-hidden`}>
      <button
        className={`w-full text-left px-4 py-4 ${levelCfg.bgColor} hover:brightness-110 transition-all`}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <LevelIcon size={15} className={`${levelCfg.textColor} flex-shrink-0 mt-0.5`} strokeWidth={1.5} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${levelCfg.bgColor} ${levelCfg.textColor} ${levelCfg.borderColor}`}>
                  {levelCfg.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                  <span className={`text-xs ${statusCfg.textColor}`}>{statusCfg.label}</span>
                </span>
              </div>
              <p className="text-sm font-medium text-white">
                {OBSERVATION_LABELS[alert.observation_type] ?? alert.observation_type}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {alert.plot_name} · {daysAgo(alert.days_since_detection)}
              </p>
            </div>
          </div>
          {expanded
            ? <ChevronUp size={14} className="text-[#4B5563] flex-shrink-0 mt-1" />
            : <ChevronDown size={14} className="text-[#4B5563] flex-shrink-0 mt-1" />}
        </div>

        <div className="flex items-center gap-4 mt-2 ml-6">
          {alert.severity_level && alert.severity_level !== 'none' && (
            <span className={`text-xs font-medium ${SEVERITY_COLOR[alert.severity_level]}`}>
              {alert.severity_level.charAt(0).toUpperCase() + alert.severity_level.slice(1)} severity
            </span>
          )}
          {alert.pest_count_per_tree != null && (
            <span className="text-xs text-[#6B7280] tabular-nums">
              {alert.pest_count_per_tree.toFixed(1)} bugs/tree
              {alert.action_count ? ` · threshold: ${alert.action_count}` : ''}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-3 bg-[#0D0F14] border-t border-[#1F2128]">
          {alert.recommended_product && (
            <div>
              <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">Recommended Treatment</p>
              <p className="text-sm font-medium text-white">{alert.recommended_product}</p>
            </div>
          )}
          {alert.application_notes && (
            <div>
              <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">Application Notes</p>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">{alert.application_notes}</p>
            </div>
          )}
          {alert.action_threshold && (
            <div>
              <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">Action Threshold</p>
              <p className="text-sm text-[#9CA3AF]">{alert.action_threshold}</p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Link
              href={`/dashboard/coffee/disease/scout?plot_id=${alert.plot_id}`}
              className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-md border border-[#2A2D35] bg-[#17191F] text-[#9CA3AF] hover:text-white transition-colors"
            >
              Scout Again
            </Link>
            <Link
              href={`/dashboard/coffee/activities/record?type=spraying&plot_id=${alert.plot_id}&trigger=disease&scouting_id=${alert.scouting_record_id}`}
              className={`flex-1 text-center text-xs font-medium py-2 px-3 rounded-md text-white transition-colors ${
                alert.alert_level === 'emergency'
                  ? 'bg-red-700 hover:bg-red-600'
                  : alert.alert_level === 'action_required'
                  ? 'bg-amber-700 hover:bg-amber-600'
                  : 'bg-emerald-700 hover:bg-emerald-600'
              }`}
            >
              Record Spray
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({ record }: { record: ScoutingRecord }) {
  const alertCfg = ALERT_CONFIG[record.alert_level]

  return (
    <div className="flex items-start gap-3 px-5 py-3.5 bg-[#0D0F14] hover:bg-[#111318] transition-colors">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
        record.alert_level === 'emergency' ? 'bg-red-500' :
        record.alert_level === 'action_required' ? 'bg-amber-500' :
        record.alert_level === 'watch' ? 'bg-yellow-400' : 'bg-[#4B5563]'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white truncate">
            {OBSERVATION_LABELS[record.observation_type] ?? record.observation_type}
          </p>
          {record.alert_level !== 'none' && (
            <span className={`text-[11px] font-medium flex-shrink-0 ${alertCfg.textColor}`}>
              {alertCfg.label}
            </span>
          )}
        </div>
        <p className="text-xs text-[#4B5563] mt-0.5">
          {record.plot_name ?? 'Plot'} · {fmtDate(record.scouting_date)}
          {record.scouted_by ? ` · ${record.scouted_by}` : ''}
        </p>
        {record.severity_level && record.severity_level !== 'none' && (
          <p className={`text-xs mt-0.5 ${SEVERITY_COLOR[record.severity_level]}`}>
            {record.severity_level.charAt(0).toUpperCase() + record.severity_level.slice(1)} severity
            {record.pest_count_per_tree != null ? ` · ${record.pest_count_per_tree.toFixed(1)} bugs/tree` : ''}
          </p>
        )}
        {record.notes && (
          <p className="text-xs text-[#4B5563] mt-0.5 truncate">{record.notes}</p>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DiseaseClient({
  initialAlerts,
  initialHistory,
}: {
  initialAlerts: ScoutingAlert[]
  initialHistory: ScoutingRecord[]
}) {
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts')

  const emergencyCount = initialAlerts.filter(a => a.alert_level === 'emergency').length
  const actionCount    = initialAlerts.filter(a => a.alert_level === 'action_required').length
  const watchCount     = initialAlerts.filter(a => a.alert_level === 'watch').length
  const overdueCount   = initialAlerts.filter(a => a.status === 'overdue').length

  const urgentAlerts   = initialAlerts.filter(a => ['emergency', 'action_required'].includes(a.alert_level))
  const watchAlerts    = initialAlerts.filter(a => a.alert_level === 'watch')
  const resolvedAlerts = initialAlerts.filter(a => a.status === 'resolved')

  // Group history by month
  const historyGroups: Record<string, ScoutingRecord[]> = {}
  initialHistory.forEach(r => {
    const key = new Date(r.scouting_date).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
    if (!historyGroups[key]) historyGroups[key] = []
    historyGroups[key].push(r)
  })

  return (
    <div className="min-h-screen bg-obsidian">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-obsidian/95 backdrop-blur border-b border-[#1F2128]">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/coffee"
                className="p-1.5 rounded-md text-[#6B7280] hover:text-white hover:bg-[#17191F] transition-colors"
              >
                <ArrowLeft size={15} strokeWidth={1.5} />
              </Link>
              <div>
                <h1 className="text-base font-semibold text-white leading-none">Disease & Pest</h1>
                <p className="text-xs text-[#6B7280] mt-0.5">Scouting logs and alerts</p>
              </div>
            </div>
            <Link
              href="/dashboard/coffee/disease/scout"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <Plus size={12} strokeWidth={2.5} />
              Scout
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">

        {/* Alert counts summary */}
        {(emergencyCount + actionCount + watchCount + overdueCount > 0) && (
          <div className="grid grid-cols-4 gap-px bg-[#1F2128] rounded-lg overflow-hidden border border-[#1F2128]">
            {[
              { count: emergencyCount, label: 'Emergency', text: 'text-red-400',    bg: 'bg-[#0D0F14]' },
              { count: overdueCount,   label: 'Overdue',   text: 'text-red-400',    bg: 'bg-[#0D0F14]' },
              { count: actionCount,    label: 'Action',    text: 'text-amber-400',  bg: 'bg-[#0D0F14]' },
              { count: watchCount,     label: 'Watch',     text: 'text-yellow-400', bg: 'bg-[#0D0F14]' },
            ].map(({ count, label, text, bg }) => (
              <div key={label} className={`${bg} px-3 py-4 text-center`}>
                <p className={`text-xl font-semibold tabular-nums ${count > 0 ? text : 'text-[#4B5563]'}`}>{count}</p>
                <p className="text-[11px] text-[#4B5563] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* All-clear */}
        {initialAlerts.length > 0 && urgentAlerts.length === 0 && overdueCount === 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20">
            <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-white">Farm looks healthy</p>
              <p className="text-xs text-emerald-600 mt-0.5">No urgent alerts in the last 30 days</p>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-px bg-[#1F2128] rounded-lg overflow-hidden border border-[#1F2128]">
          {(['alerts', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-medium py-2.5 transition-colors ${
                activeTab === tab
                  ? 'bg-[#17191F] text-white'
                  : 'bg-[#0D0F14] text-[#6B7280] hover:text-[#9CA3AF]'
              }`}
            >
              {tab === 'alerts' ? (
                <>
                  Alerts
                  {(emergencyCount + actionCount) > 0 && (
                    <span className="ml-2 text-xs bg-red-900/60 text-red-400 border border-red-900/60 px-1.5 py-0.5 rounded-md">
                      {emergencyCount + actionCount}
                    </span>
                  )}
                </>
              ) : 'History'}
            </button>
          ))}
        </div>

        {/* Alerts tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-5">
            {urgentAlerts.length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">Needs Action</p>
                {urgentAlerts.map(a => <AlertCard key={a.scouting_record_id} alert={a} />)}
              </section>
            )}
            {watchAlerts.length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">Monitoring</p>
                {watchAlerts.map(a => <AlertCard key={a.scouting_record_id} alert={a} />)}
              </section>
            )}
            {resolvedAlerts.length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">Resolved · Last 30 Days</p>
                {resolvedAlerts.map(a => <AlertCard key={a.scouting_record_id} alert={a} />)}
              </section>
            )}
            {initialAlerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-[#2A2D35] rounded-lg">
                <Search size={20} className="text-[#2A2D35]" strokeWidth={1} />
                <p className="text-sm text-[#4B5563]">No scouting records yet</p>
                <Link
                  href="/dashboard/coffee/disease/scout"
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Record first scouting →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div>
            {initialHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-[#2A2D35] rounded-lg">
                <Clock size={20} className="text-[#2A2D35]" strokeWidth={1} />
                <p className="text-sm text-[#4B5563]">No scouting history</p>
                <p className="text-xs text-[#4B5563]">Records from the last 90 days will appear here</p>
              </div>
            ) : (
              <div className="rounded-lg border border-[#2A2D35] overflow-hidden">
                {Object.entries(historyGroups).map(([month, records]) => (
                  <div key={month} className="divide-y divide-[#1F2128]">
                    <div className="px-5 py-2 bg-[#17191F] border-b border-[#1F2128]">
                      <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest">{month}</p>
                    </div>
                    {records.map(r => <HistoryRow key={r.id} record={r} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scouting tip */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
          <FlaskConical size={13} className="text-[#4B5563] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Scout weekly during the wet season (Apr–May, Oct–Nov). Check 10–20 trees per plot.
            For Antestia, count bugs on 5 trees and calculate average.
          </p>
        </div>

      </div>
    </div>
  )
}
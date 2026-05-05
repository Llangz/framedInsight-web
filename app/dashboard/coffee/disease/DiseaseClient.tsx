'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type AlertStatus = "resolved" | "pending_action" | "overdue" | "action_required" | "monitoring";
type AlertLevel  = "none" | "watch" | "action_required" | "emergency";
type SeverityLevel = "none" | "light" | "moderate" | "severe";

interface ScoutingAlert {
  scouting_record_id: string;
  farm_id: string;
  farm_name: string;
  plot_id: string;
  plot_name: string;
  scouting_date: string;
  observation_type: string;
  severity_level: SeverityLevel | null;
  pest_count_per_tree: number | null;
  threshold_breached: boolean;
  alert_level: AlertLevel;
  action_taken: string;
  action_threshold: string | null;
  action_count: number | null;
  recommended_product: string | null;
  application_notes: string | null;
  days_since_detection: number;
  status: AlertStatus;
}

interface ScoutingRecord {
  id: string;
  plot_id: string;
  plot_name?: string;
  scouting_date: string;
  observation_type: string;
  severity_level: SeverityLevel | null;
  pest_count_per_tree: number | null;
  threshold_breached: boolean;
  alert_level: AlertLevel;
  action_taken: string;
  scouted_by: string | null;
  notes: string | null;
  created_at: string;
}

interface FarmOption {
  id: string;
  farm_name: string;
}

const OBSERVATION_LABELS: Record<string, string> = {
  cbd:         "CBD (Coffee Berry Disease)",
  clr:         "Coffee Leaf Rust",
  antestia:    "Antestia Bug",
  thrips:      "Thrips",
  mealybugs:   "Mealybugs",
  stem_borer:  "White Stem Borer",
  leaf_miner:  "Leaf Miner",
  root_disease:"Root Disease",
  other_pest:  "Other Pest",
  healthy:     "Healthy (No Issues)",
};

const OBSERVATION_ICONS: Record<string, string> = {
  cbd:         "🟤",
  clr:         "🟡",
  antestia:    "🐛",
  thrips:      "🔴",
  mealybugs:   "⚪",
  stem_borer:  "🟠",
  leaf_miner:  "🍃",
  root_disease:"🟣",
  other_pest:  "❓",
  healthy:     "✅",
};

const ALERT_LEVEL_CONFIG: Record<AlertLevel, { label: string; color: string; bg: string; border: string }> = {
  emergency:       { label: "Emergency",       color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200" },
  action_required: { label: "Action Required", color: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200" },
  watch:           { label: "Watch",           color: "text-yellow-700", bg: "bg-yellow-50",  border: "border-yellow-200" },
  none:            { label: "Monitoring",      color: "text-green-700",  bg: "bg-green-50",   border: "border-green-200" },
};

const STATUS_CONFIG: Record<AlertStatus, { label: string; color: string; dot: string }> = {
  resolved:       { label: "Resolved",       color: "text-green-600",  dot: "bg-green-500"  },
  pending_action: { label: "Pending Action", color: "text-blue-600",   dot: "bg-blue-500"   },
  overdue:        { label: "Overdue",        color: "text-red-600",    dot: "bg-red-500"    },
  action_required:{ label: "Action Required",color: "text-orange-600", dot: "bg-orange-500" },
  monitoring:     { label: "Monitoring",     color: "text-slate-500",  dot: "bg-slate-400"  },
};

const SEVERITY_CONFIG: Record<SeverityLevel, { label: string; color: string }> = {
  none:     { label: "None",     color: "text-green-600" },
  light:    { label: "Light",    color: "text-yellow-600" },
  moderate: { label: "Moderate", color: "text-orange-600" },
  severe:   { label: "Severe",   color: "text-red-600" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function daysAgoLabel(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function AlertCard({ alert }: { alert: ScoutingAlert }) {
  const [expanded, setExpanded] = useState(false);
  const levelCfg = ALERT_LEVEL_CONFIG[alert.alert_level];
  const statusCfg = STATUS_CONFIG[alert.status];

  return (
    <div className={`rounded-xl border ${levelCfg.border} ${levelCfg.bg} overflow-hidden transition-all`}>
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0 mt-0.5">
              {OBSERVATION_ICONS[alert.observation_type] ?? "❓"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${levelCfg.color} ${levelCfg.bg} border ${levelCfg.border}`}>
                  {levelCfg.label}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                  <span className={statusCfg.color}>{statusCfg.label}</span>
                </span>
              </div>
              <p className="font-semibold text-slate-800 mt-1 text-sm">
                {OBSERVATION_LABELS[alert.observation_type] ?? alert.observation_type}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {alert.plot_name} · {daysAgoLabel(alert.days_since_detection)}
              </p>
            </div>
          </div>
          <span className="text-slate-400 flex-shrink-0 text-xs mt-1">
            {expanded ? "▲" : "▼"}
          </span>
        </div>

        {(alert.severity_level && alert.severity_level !== "none") && (
          <div className="mt-2 ml-9">
            <span className={`text-xs font-medium ${SEVERITY_CONFIG[alert.severity_level].color}`}>
              Severity: {SEVERITY_CONFIG[alert.severity_level].label}
            </span>
          </div>
        )}
        {alert.pest_count_per_tree != null && (
          <div className="mt-2 ml-9">
            <span className="text-xs font-medium text-slate-700">
              {alert.pest_count_per_tree.toFixed(1)} bugs/tree
              {alert.action_count && (
                <span className="text-slate-400"> · threshold: {alert.action_count}</span>
              )}
            </span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-current/10 pt-3">
          {alert.recommended_product && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Recommended Treatment</p>
              <p className="text-sm text-slate-800 font-medium">{alert.recommended_product}</p>
            </div>
          )}
          {alert.application_notes && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Application Notes</p>
              <p className="text-sm text-slate-700 leading-relaxed">{alert.application_notes}</p>
            </div>
          )}
          {alert.action_threshold && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Action Threshold</p>
              <p className="text-sm text-slate-700">{alert.action_threshold}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Link
              href={`/dashboard/coffee/disease/scout?plot_id=${alert.plot_id}`}
              className="flex-1 text-center text-xs font-semibold py-2 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Scout Again
            </Link>
            <Link
              href={`/dashboard/coffee/activities/record?type=spraying&plot_id=${alert.plot_id}&trigger=disease&scouting_id=${alert.scouting_record_id}`}
              className={`flex-1 text-center text-xs font-semibold py-2 px-3 rounded-lg text-white transition-colors ${
                alert.alert_level === "emergency"
                  ? "bg-red-600 hover:bg-red-700"
                  : alert.alert_level === "action_required"
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              Record Spray
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ record }: { record: ScoutingRecord }) {
  const alertCfg = ALERT_LEVEL_CONFIG[record.alert_level];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="text-xl flex-shrink-0 mt-0.5">
        {OBSERVATION_ICONS[record.observation_type] ?? "❓"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {OBSERVATION_LABELS[record.observation_type] ?? record.observation_type}
          </p>
          {record.alert_level !== "none" && (
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${alertCfg.color} ${alertCfg.bg}`}>
              {alertCfg.label}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {record.plot_name ?? "Plot"} · {formatDate(record.scouting_date)}
          {record.scouted_by && <> · {record.scouted_by}</>}
        </p>
        {record.severity_level && record.severity_level !== "none" && (
          <p className={`text-xs mt-0.5 ${SEVERITY_CONFIG[record.severity_level].color}`}>
            {SEVERITY_CONFIG[record.severity_level].label} severity
            {record.pest_count_per_tree != null && ` · ${record.pest_count_per_tree.toFixed(1)} bugs/tree`}
          </p>
        )}
        {record.notes && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{record.notes}</p>
        )}
      </div>
    </div>
  );
}

export default function DiseaseClient({
  initialAlerts,
  initialHistory,
}: {
  initialAlerts: ScoutingAlert[];
  initialHistory: ScoutingRecord[];
}) {
  const [activeTab, setActiveTab] = useState<"alerts" | "history">("alerts");

  const emergencyCount = initialAlerts.filter(a => a.alert_level === "emergency").length;
  const actionCount = initialAlerts.filter(a => a.alert_level === "action_required").length;
  const watchCount = initialAlerts.filter(a => a.alert_level === "watch").length;
  const overdueCount = initialAlerts.filter(a => a.status === "overdue").length;

  const urgentAlerts = initialAlerts.filter(a => ["emergency", "action_required"].includes(a.alert_level));
  const watchAlerts = initialAlerts.filter(a => a.alert_level === "watch");
  const resolvedAlerts = initialAlerts.filter(a => a.status === "resolved");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/coffee"
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                ←
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Disease & Pest Monitoring</h1>
                <p className="text-xs text-slate-500 mt-0.5">Scouting logs and action alerts</p>
              </div>
            </div>
            <Link
              href="/dashboard/coffee/disease/scout"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <span>+</span>
              <span>Scout</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {(emergencyCount + actionCount + watchCount + overdueCount > 0) && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { count: emergencyCount,  label: "Emergency",  color: "bg-red-50 border-red-200 text-red-700" },
              { count: overdueCount,    label: "Overdue",    color: "bg-red-50 border-red-200 text-red-600" },
              { count: actionCount,     label: "Action",     color: "bg-orange-50 border-orange-200 text-orange-700" },
              { count: watchCount,      label: "Watch",      color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
            ].map(({ count, label, color }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${color}`}>
                <p className="text-xl font-bold leading-none">{count}</p>
                <p className="text-xs mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        )}

        {initialAlerts.length > 0 && urgentAlerts.length === 0 && overdueCount === 0 && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Farm looks healthy</p>
              <p className="text-xs text-emerald-600">No urgent alerts in the last 30 days</p>
            </div>
          </div>
        )}

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(["alerts", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "alerts" ? (
                <>
                  Alerts
                  {(emergencyCount + actionCount) > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {emergencyCount + actionCount}
                    </span>
                  )}
                </>
              ) : "History"}
            </button>
          ))}
        </div>

        {activeTab === "alerts" && (
          <div className="space-y-4">
            {urgentAlerts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Needs Action Now
                </h2>
                <div className="space-y-2">
                  {urgentAlerts.map(a => (
                    <AlertCard key={a.scouting_record_id} alert={a} />
                  ))}
                </div>
              </section>
            )}

            {watchAlerts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Monitoring
                </h2>
                <div className="space-y-2">
                  {watchAlerts.map(a => (
                    <AlertCard key={a.scouting_record_id} alert={a} />
                  ))}
                </div>
              </section>
            )}

            {resolvedAlerts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Resolved (Last 30 Days)
                </h2>
                <div className="space-y-2">
                  {resolvedAlerts.map(a => (
                    <AlertCard key={a.scouting_record_id} alert={a} />
                  ))}
                </div>
              </section>
            )}

            {initialAlerts.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-slate-700">No scouting records yet</p>
                <p className="text-sm text-slate-500 mt-1 mb-4">
                  Start scouting your plots to track disease pressure
                </p>
                <Link
                  href="/dashboard/coffee/disease/scout"
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Record First Scouting
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div>
            {initialHistory.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-semibold text-slate-700">No scouting history</p>
                <p className="text-sm text-slate-500 mt-1">Records from the last 90 days will appear here</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {(() => {
                  const groups: Record<string, ScoutingRecord[]> = {};
                  initialHistory.forEach((r: ScoutingRecord) => {
                    const d = new Date(r.scouting_date);
                    const key = d.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(r);
                  });

                  return Object.entries(groups).map(([month, records]) => (
                    <div key={month}>
                      <div className="px-4 py-2 bg-slate-50 sticky top-[73px]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{month}</p>
                      </div>
                      <div className="px-4">
                        {records.map(r => (
                          <HistoryRow key={r.id} record={r} />
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">📅 Scouting Tip</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Scout weekly during the wet season (Apr–May, Oct–Nov). Check 10–20 trees per plot. 
            For Antestia, count bugs on 5 trees and calculate average.
          </p>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}

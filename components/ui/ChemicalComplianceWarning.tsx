'use client'

// 📁 FILE PATH: components/ui/ChemicalComplianceWarning.tsx
// ============================================================================
// ChemicalComplianceWarning — inline warning block shown under product inputs
// Renders critical (red), warning (amber), or caution (blue) banners
// with regulatory context and recommended alternatives.
// ============================================================================

import { ChemicalWarning } from '@/hooks/useChemicalCheck'

interface Props {
  warning: ChemicalWarning
  /** Show compact one-line version (e.g. inside a dropdown option) */
  compact?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  banned_kenya: 'Banned in Kenya',
  restricted_kenya: 'Restricted in Kenya',
  under_review: 'Under PCPB Review',
  banned_eu_export: 'EU Export Risk',
  ok: 'Caution',
}

export function ChemicalComplianceWarning({ warning, compact = false }: Props) {
  const isCritical = warning.severity === 'critical'
  const isWarning = warning.severity === 'warning'

  // ── colour tokens ──────────────────────────────────────────────────────────
  const bg      = isCritical ? 'bg-red-50'     : isWarning ? 'bg-amber-50'  : 'bg-blue-50'
  const border  = isCritical ? 'border-red-300' : isWarning ? 'border-amber-300' : 'border-blue-300'
  const title   = isCritical ? 'text-red-800'  : isWarning ? 'text-amber-800' : 'text-blue-800'
  const body    = isCritical ? 'text-red-700'  : isWarning ? 'text-amber-700' : 'text-blue-700'
  const badge   = isCritical
    ? 'bg-red-100 text-red-800 border border-red-300'
    : isWarning
    ? 'bg-amber-100 text-amber-800 border border-amber-300'
    : 'bg-blue-100 text-blue-800 border border-blue-300'
  const icon = isCritical ? '🚫' : isWarning ? '⚠️' : 'ℹ️'

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 text-xs ${body} mt-1`}>
        <span>{icon}</span>
        <span className="font-medium">{STATUS_LABELS[warning.kenyaStatus]}</span>
        <span>— {warning.reason.split('.')[0]}.</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border-2 ${border} ${bg} p-4 mt-3 space-y-2.5`}
      role="alert"
      aria-live="assertive"
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none mt-0.5" aria-hidden="true">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className={`font-semibold text-sm ${title}`}>
              {isCritical ? 'Compliance Violation' : isWarning ? 'Regulatory Warning' : 'Use Caution'}
            </p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
              {STATUS_LABELS[warning.kenyaStatus]}
            </span>
            {warning.euExportRisk && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                EU Export Risk
              </span>
            )}
          </div>
          <p className={`text-sm ${body} leading-snug`}>
            <span className="font-medium">{warning.activeIngredient}</span> — {warning.reason}
          </p>
        </div>
      </div>

      {/* Allowed use note (for restricted chemicals) */}
      {warning.allowedUseOnly && (
        <div className={`text-xs ${body} bg-white/60 rounded-lg px-3 py-2 border ${border}`}>
          <span className="font-semibold">Allowed only for: </span>
          {warning.allowedUseOnly}
        </div>
      )}

      {/* Alternatives */}
      {warning.alternatives.length > 0 && (
        <div>
          <p className={`text-xs font-semibold ${title} mb-1`}>Recommended alternatives:</p>
          <div className="flex flex-wrap gap-1.5">
            {warning.alternatives.map(alt => (
              <span
                key={alt}
                className="text-xs px-2.5 py-1 rounded-full bg-white/80 border border-current/20 font-medium text-emerald-700"
              >
                {alt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Regulatory note */}
      {warning.regulatoryNote && (
        <p className={`text-xs ${body} opacity-80 italic`}>
          📋 {warning.regulatoryNote}
        </p>
      )}

      {/* Submission blocker message */}
      {warning.blocksSubmission && (
        <div className={`rounded-lg bg-red-100 border border-red-300 px-3 py-2`}>
          <p className="text-xs font-semibold text-red-800">
            ⛔ This product cannot be recorded. Please select a compliant alternative before saving this activity.
          </p>
        </div>
      )}
    </div>
  )
}
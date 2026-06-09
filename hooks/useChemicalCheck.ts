'use client'

// 📁 FILE PATH: hooks/useChemicalCheck.ts
// ============================================================================
// useChemicalCheck — debounced agrochemical compliance hook
// Fires on product_name input change, returns warning state for UI rendering
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import {
  checkChemicalCompliance,
  getComplianceSeverity,
  ChemicalEntry,
  EnterpriseType,
} from '@/lib/agrochemical-compliance'

export interface ChemicalWarning {
  severity: 'critical' | 'warning' | 'caution'
  activeIngredient: string
  kenyaStatus: string
  euExportRisk: boolean
  reason: string
  alternatives: string[]
  allowedUseOnly?: string
  regulatoryNote?: string
  /** true if the restriction is specific to this enterprise (e.g. 2,4-D on coffee) */
  enterpriseSpecific: boolean
  /** Block form submission on critical, warn on warning/caution */
  blocksSubmission: boolean
}

interface UseChemicalCheckOptions {
  enterprise?: EnterpriseType
  /** Debounce delay in ms. Default: 300 */
  debounceMs?: number
}

interface UseChemicalCheckResult {
  warning: ChemicalWarning | null
  isChecking: boolean
  /** Call this to manually clear the warning (e.g. when product field is cleared) */
  clearWarning: () => void
}

export function useChemicalCheck(
  productName: string | undefined,
  options: UseChemicalCheckOptions = {}
): UseChemicalCheckResult {
  const { enterprise = 'coffee', debounceMs = 300 } = options
  const [warning, setWarning] = useState<ChemicalWarning | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const clearWarning = useCallback(() => setWarning(null), [])

  useEffect(() => {
    if (!productName || productName === 'Other' || productName.trim().length < 2) {
      setWarning(null)
      return
    }

    setIsChecking(true)
    const timer = setTimeout(() => {
      const result = checkChemicalCompliance(productName, enterprise)
      if (!result) {
        setWarning(null)
      } else {
        const { entry, enterpriseSpecific } = result
        const severity = getComplianceSeverity(entry, enterprise)
        setWarning({
          severity,
          activeIngredient: entry.activeIngredient,
          kenyaStatus: entry.kenyaStatus,
          euExportRisk: entry.euExportRisk,
          reason: entry.reason,
          alternatives: entry.alternatives ?? [],
          allowedUseOnly: entry.allowedUseOnly,
          regulatoryNote: entry.regulatoryNote,
          enterpriseSpecific,
          // Block submission for fully banned or enterprise-specific restrictions
          blocksSubmission: severity === 'critical',
        })
      }
      setIsChecking(false)
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      setIsChecking(false)
    }
  }, [productName, enterprise, debounceMs])

  return { warning, isChecking, clearWarning }
}
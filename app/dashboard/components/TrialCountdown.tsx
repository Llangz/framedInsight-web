'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Timer, AlertCircle } from 'lucide-react'

interface TrialCountdownProps {
  signupDate: string
}

export default function TrialCountdown({ signupDate }: TrialCountdownProps) {
  const [trialInfo, setTrialInfo] = useState<{
    daysRemaining: number
    isActive: boolean
    hasExpired: boolean
  } | null>(null)

  useEffect(() => {
    if (!signupDate) return
    const signup   = new Date(signupDate)
    const trialEnd = new Date(signup.getTime() + 14 * 24 * 60 * 60 * 1000)
    const diffMs   = trialEnd.getTime() - Date.now()
    const days     = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

    setTrialInfo({
      daysRemaining: Math.max(0, days),
      isActive:      days > 0,
      hasExpired:    days <= 0,
    })
  }, [signupDate])

  if (!trialInfo) return null

  if (trialInfo.hasExpired) {
    return (
      <div className="flex items-center gap-2">
        <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
        <span className="text-xs font-medium text-red-400">Trial expired</span>
        <Link
          href="/dashboard/billing"
          className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-400 transition-colors"
        >
          Upgrade
        </Link>
      </div>
    )
  }

  const isLow = trialInfo.daysRemaining <= 3

  return (
    <div className="flex items-center gap-2">
      <Timer
        size={12}
        className={`flex-shrink-0 ${isLow ? 'text-amber-400' : 'text-emerald-500'}`}
      />
      <div className="flex flex-col leading-none">
        <span className={`text-xs font-semibold ${isLow ? 'text-amber-400' : 'text-emerald-500'}`}>
          {trialInfo.daysRemaining}d left
        </span>
        <span className="text-[9px] font-medium text-zinc-600 uppercase tracking-widest">
          Pro trial
        </span>
      </div>
    </div>
  )
}

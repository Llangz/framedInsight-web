'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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
    const signup = new Date(signupDate)
    const now = new Date()
    const trialEnd = new Date(signup.getTime() + 14 * 24 * 60 * 60 * 1000)
    const diffMs = trialEnd.getTime() - now.getTime()
    const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

    setTrialInfo({
      daysRemaining: Math.max(0, daysRemaining),
      isActive: daysRemaining > 0,
      hasExpired: daysRemaining <= 0
    })
  }, [signupDate])

  if (!trialInfo) return null

  if (trialInfo.hasExpired) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-crimson-alert/10 border border-crimson-alert/20 rounded-xl text-crimson-alert">
        <span className="text-sm font-bold">Pro Expired</span>
        <Link href="/dashboard/billing" className="text-[10px] font-black uppercase tracking-widest bg-crimson-alert text-white px-2 py-1 rounded-lg hover:scale-105 transition-transform">
          Upgrade
        </Link>
      </div>
    )
  }

  const isLow = trialInfo.daysRemaining <= 3;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${isLow ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
      <span className="text-xl animate-pulse">🎁</span>
      <div className="flex flex-col">
        <span className="text-xs font-bold leading-none">{trialInfo.daysRemaining} Days Remaining</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pro Access</span>
      </div>
    </div>
  )
}

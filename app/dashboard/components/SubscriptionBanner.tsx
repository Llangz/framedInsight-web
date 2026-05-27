// Server component — rendered inside layout, shown conditionally
'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, X } from 'lucide-react'
import { useState } from 'react'
import type { SubscriptionInfo } from '@/lib/subscription'

interface Props {
  subInfo: SubscriptionInfo
}

export default function SubscriptionBanner({ subInfo }: Props) {
  const [dismissed, setDismissed] = useState(false)

  // Nothing to show for active or free tiers with plenty of time
  if (subInfo.status === 'active' && subInfo.daysRemaining > 7) return null
  if (subInfo.status === 'free') return null
  if (dismissed) return null

  if (subInfo.status === 'trial') {
    if (subInfo.trialDaysRemaining > 7) return null
    return (
      <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3 text-sm">
        <Clock size={15} className="text-amber-400 shrink-0" />
        <p className="flex-1 text-amber-200">
          <strong className="font-semibold">{subInfo.trialDaysRemaining} day{subInfo.trialDaysRemaining !== 1 ? 's' : ''} left</strong> on your free trial.{' '}
          <Link href="/dashboard/billing" className="underline underline-offset-2 hover:text-amber-100">Subscribe now</Link> to keep your AI features.
        </p>
        <button onClick={() => setDismissed(true)} className="text-amber-500/50 hover:text-amber-400 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  if (subInfo.status === 'grace') {
    return (
      <div className="mx-4 mt-4 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 flex items-center gap-3 text-sm">
        <AlertTriangle size={15} className="text-orange-400 shrink-0" />
        <p className="flex-1 text-orange-200">
          <strong className="font-semibold">Grace period active.</strong> Your subscription expired.{' '}
          <Link href="/dashboard/billing" className="underline underline-offset-2 hover:text-orange-100">Renew today</Link> to avoid losing access.
        </p>
      </div>
    )
  }

  if (subInfo.status === 'active' && subInfo.daysRemaining <= 7) {
    return (
      <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3 text-sm">
        <Clock size={15} className="text-amber-400 shrink-0" />
        <p className="flex-1 text-amber-200">
          Subscription expires in <strong className="font-semibold">{subInfo.daysRemaining} day{subInfo.daysRemaining !== 1 ? 's' : ''}</strong>.{' '}
          <Link href="/dashboard/billing" className="underline underline-offset-2 hover:text-amber-100">Renew early</Link> to avoid interruption.
        </p>
        <button onClick={() => setDismissed(true)} className="text-amber-500/50 hover:text-amber-400 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  return null
}
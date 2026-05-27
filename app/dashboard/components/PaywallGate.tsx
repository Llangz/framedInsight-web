// Hard paywall — replaces page content when subscription is expired
'use client'

import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'

interface Props {
  farmName: string
}

export default function PaywallGate({ farmName }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="h-16 w-16 rounded-2xl border border-zinc-700 bg-zinc-900 flex items-center justify-center mb-6">
        <Lock size={28} className="text-zinc-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Subscription expired</h2>
      <p className="text-zinc-400 text-sm max-w-sm mb-8">
        {farmName}&apos;s subscription has expired. Renew to continue tracking livestock, coffee plots, and accessing AI features.
      </p>
      <Link
        href="/dashboard/billing"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
      >
        <Zap size={16} />
        Renew subscription
      </Link>
      <p className="text-xs text-zinc-600 mt-4">Starting at KES 500/month · M-Pesa accepted</p>
    </div>
  )
}
'use client'

import { getTierName, getTierColor, type TierLevel } from '@/lib/tiers'

interface TierBadgeProps {
  tier: TierLevel
  showPrice?: boolean
  price?: number
  className?: string
}

export function TierBadge({ tier, showPrice = false, price, className = '' }: TierBadgeProps) {
  const tierName = getTierName(tier)
  const colorClasses = getTierColor(tier)

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colorClasses} ${className}`}>
      {tierName}
      {showPrice && price != null && price > 0 && (
        <span className="ml-2 text-xs opacity-75">
          KES {price.toLocaleString()}/mo
        </span>
      )}
    </span>
  )
}

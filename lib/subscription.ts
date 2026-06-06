// ============================================================================
// framedInsight Subscription Access Control
// Single source of truth — used by server components, API routes, and layout
// ============================================================================

export type SubscriptionStatus =
  | 'active'      // paid, end_date in future
  | 'trial'       // within 14-day trial window
  | 'expired'     // trial elapsed, no paid sub
  | 'grace'       // payment failed but within 3-day grace period
  | 'free'        // explicitly on free/smallholder forever

export interface SubscriptionInfo {
  status: SubscriptionStatus
  tier: string
  endDate: Date | null
  trialEndDate: Date | null
  daysRemaining: number       // days until expiry (0 if expired)
  trialDaysRemaining: number  // days left in trial (0 if not in trial)
  hasProAccess: boolean       // true if AI/satellite features unlocked
  canAccessDashboard: boolean // true unless hard-expired with no grace
}

const TRIAL_DAYS = 14
const GRACE_DAYS = 3

export function getSubscriptionInfo(farm: {
  subscription_tier: string | null
  subscription_end_date: string | null
  created_at: string | null
}): SubscriptionInfo {
  const now = new Date()
  const tier = farm.subscription_tier ?? 'smallholder'

  const createdAt = new Date(farm.created_at ?? Date.now())
  const trialEnd = new Date(createdAt)
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  const trialMsLeft = trialEnd.getTime() - now.getTime()
  const trialDaysRemaining = Math.max(0, Math.ceil(trialMsLeft / 86_400_000))
  const inTrial = trialDaysRemaining > 0

  const endDate = farm.subscription_end_date ? new Date(farm.subscription_end_date) : null
  const subMsLeft = endDate ? endDate.getTime() - now.getTime() : -1
  const daysRemaining = endDate ? Math.max(0, Math.ceil(subMsLeft / 86_400_000)) : 0
  const subActive = endDate !== null && daysRemaining > 0

  // Grace period: subscription expired in last GRACE_DAYS days
  const graceActive = endDate !== null
    && daysRemaining === 0
    && (now.getTime() - endDate.getTime()) < GRACE_DAYS * 86_400_000

  let status: SubscriptionStatus
  if (subActive) {
    status = 'active'
  } else if (inTrial) {
    status = 'trial'
  } else if (graceActive) {
    status = 'grace'
  } else if (tier === 'smallholder') {
    status = 'free'
  } else {
    status = 'expired'
  }

  const hasProAccess = status === 'active' || status === 'trial' || status === 'grace'
  const canAccessDashboard = status !== 'expired' // expired = paywall

  return {
    status,
    tier,
    endDate,
    trialEndDate: trialEnd,
    daysRemaining: subActive ? daysRemaining : 0,
    trialDaysRemaining,
    hasProAccess,
    canAccessDashboard,
  }
}

// Human-readable label for the billing UI
export function subscriptionStatusLabel(info: SubscriptionInfo): string {
  switch (info.status) {
    case 'active':  return `Active — ${info.daysRemaining} day${info.daysRemaining !== 1 ? 's' : ''} remaining`
    case 'trial':   return `Free trial — ${info.trialDaysRemaining} day${info.trialDaysRemaining !== 1 ? 's' : ''} remaining`
    case 'grace':   return 'Grace period — please renew today'
    case 'expired': return 'Subscription expired'
    case 'free':    return 'Free tier (Smallholder)'
  }
}

// Maps tier → human name
export const TIER_NAMES: Record<string, string> = {
  smallholder:    'Smallholder (Free)',
  commercial:     'Commercial',
  enterprise:     'Enterprise',
  enterprise_plus:'Enterprise Plus',
}

// Monthly prices in KES — single source across the app
export const TIER_MONTHLY_PRICES: Record<string, number> = {
  smallholder:    0,
  commercial:   799,
  enterprise:  2999,
  enterprise_plus: 5000,
}
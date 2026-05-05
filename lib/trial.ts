// ============================================================================
// framedInsight Trial Management System
// ============================================================================
// Handles 14-day Pro trial for all new signups

export interface TrialInfo {
  isActive: boolean
  daysRemaining: number
  startDate: Date
  endDate: Date
  hasExpired: boolean
  featuresUnlocked: boolean
}

const TRIAL_DURATION_DAYS = 14

// ============================================================================
// TRIAL CALCULATION
// ============================================================================

export function calculateTrialInfo(signupDate: Date | string): TrialInfo {
  const start = new Date(signupDate)
  const end = new Date(start)
  end.setDate(end.getDate() + TRIAL_DURATION_DAYS)
  
  const now = new Date()
  const msRemaining = end.getTime() - now.getTime()
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  
  const isActive = daysRemaining > 0
  const hasExpired = daysRemaining <= 0
  
  return {
    isActive,
    daysRemaining: Math.max(0, daysRemaining),
    startDate: start,
    endDate: end,
    hasExpired,
    featuresUnlocked: isActive, // During trial, all features unlocked
  }
}

// ============================================================================
// TRIAL REMINDER SCHEDULE
// ============================================================================

export interface TrialReminder {
  day: number
  type: 'welcome' | 'encouragement' | 'urgency' | 'final_warning' | 'expired'
  title: string
  message: string
  showCTA: boolean
}

export function getTrialReminder(daysRemaining: number): TrialReminder | null {
  // Day 1: Welcome
  if (daysRemaining === 14) {
    return {
      day: 1,
      type: 'welcome',
      title: '🎉 Welcome to framedInsight Pro!',
      message: 'You have 14 days of Pro features FREE. Explore AI insights, satellite monitoring, and EUDR compliance tools!',
      showCTA: false,
    }
  }
  
  // Day 7: Halfway point
  if (daysRemaining === 7) {
    return {
      day: 7,
      type: 'encouragement',
      title: '📊 You\'re halfway through your Pro trial!',
      message: 'Great progress! You still have 7 days to explore all Pro features. Keep going!',
      showCTA: false,
    }
  }
  
  // Day 12: 2 days left
  if (daysRemaining === 2) {
    return {
      day: 12,
      type: 'urgency',
      title: '⏰ 2 days left in your Pro trial',
      message: 'Your Pro trial ends in 2 days. Subscribe now to continue enjoying AI insights and satellite monitoring!',
      showCTA: true,
    }
  }
  
  // Day 13: 1 day left
  if (daysRemaining === 1) {
    return {
      day: 13,
      type: 'final_warning',
      title: '⏰ TOMORROW your Pro trial ends',
      message: 'Don\'t lose access to AI disease detection, satellite NDVI monitoring, and EUDR compliance tools!',
      showCTA: true,
    }
  }
  
  // Day 15: Expired
  if (daysRemaining === 0) {
    return {
      day: 15,
      type: 'expired',
      title: 'Your Pro trial has ended',
      message: 'Subscribe to continue using Pro features, or continue with our FREE Smallholder tier.',
      showCTA: true,
    }
  }
  
  return null
}

// ============================================================================
// FEATURE ACCESS CONTROL
// ============================================================================

export interface FeatureAccess {
  canUseAI: boolean
  canUseSatellite: boolean
  canUseEUDR: boolean
  canUseAnalytics: boolean
  canExportData: boolean
  reason: string
}

export function checkFeatureAccess(
  currentTier: string,
  trialInfo: TrialInfo
): FeatureAccess {
  // During trial, everyone gets Pro features
  if (trialInfo.isActive) {
    return {
      canUseAI: true,
      canUseSatellite: true,
      canUseEUDR: true,
      canUseAnalytics: true,
      canExportData: true,
      reason: 'Pro trial active',
    }
  }
  
  // After trial, depends on tier
  const isPaidTier = currentTier === 'commercial' || currentTier === 'enterprise' || currentTier === 'enterprise_plus'
  
  if (isPaidTier) {
    return {
      canUseAI: true,
      canUseSatellite: true,
      canUseEUDR: true,
      canUseAnalytics: true,
      canExportData: true,
      reason: 'Paid subscription',
    }
  }
  
  // Smallholder after trial
  return {
    canUseAI: false,
    canUseSatellite: false,
    canUseEUDR: false,
    canUseAnalytics: false,
    canExportData: false,
    reason: 'Upgrade to unlock Pro features',
  }
}

// ============================================================================
// TRIAL STATISTICS
// ============================================================================

export interface TrialStats {
  aiPredictionsGenerated: number
  satelliteScansCompleted: number
  eudrPDFsCreated: number
  estimatedSavings: number // in KES
}

export function formatTrialStats(stats: TrialStats): string {
  const items: string[] = []
  
  if (stats.aiPredictionsGenerated > 0) {
    items.push(`${stats.aiPredictionsGenerated} AI predictions generated`)
  }
  
  if (stats.satelliteScansCompleted > 0) {
    items.push(`${stats.satelliteScansCompleted} satellite health scans`)
  }
  
  if (stats.eudrPDFsCreated > 0) {
    items.push(`${stats.eudrPDFsCreated} EUDR PDFs created`)
  }
  
  if (stats.estimatedSavings > 0) {
    items.push(`Saved ~KES ${stats.estimatedSavings.toLocaleString()} in vet costs`)
  }
  
  return items.join(', ')
}

// ============================================================================
// TRIAL COUNTDOWN DISPLAY
// ============================================================================

export function getTrialCountdownText(daysRemaining: number): string {
  if (daysRemaining === 0) {
    return 'Trial ended'
  }
  
  if (daysRemaining === 1) {
    return '1 day remaining'
  }
  
  return `${daysRemaining} days remaining`
}

export function getTrialCountdownColor(daysRemaining: number): string {
  if (daysRemaining <= 1) {
    return 'bg-red-500 text-white' // Urgent
  }
  
  if (daysRemaining <= 3) {
    return 'bg-orange-500 text-white' // Warning
  }
  
  if (daysRemaining <= 7) {
    return 'bg-yellow-500 text-white' // Caution
  }
  
  return 'bg-green-500 text-white' // Good
}

// ============================================================================
// TRIAL UPGRADE MESSAGING
// ============================================================================

export function getTrialUpgradeMessage(
  currentTier: string,
  trialInfo: TrialInfo,
  farmName: string
): { title: string; message: string; cta: string } {
  if (currentTier === 'smallholder' && trialInfo.hasExpired) {
    return {
      title: 'Your trial has ended',
      message: `Continue using framedInsight FREE! You can still record all your farm data. Upgrade to Pro (KES 500/month) anytime to unlock AI insights and satellite monitoring.`,
      cta: 'Continue with Free Tier',
    }
  }
  
  if ((currentTier === 'commercial' || currentTier === 'enterprise') && trialInfo.hasExpired) {
    return {
      title: 'Your Pro trial has ended',
      message: `${farmName} qualifies for ${currentTier === 'commercial' ? 'Commercial' : 'Enterprise'} tier. Subscribe now to continue using AI insights, satellite monitoring, and EUDR compliance tools.`,
      cta: 'Subscribe Now',
    }
  }
  
  return {
    title: 'Enjoying Pro features?',
    message: `You have ${trialInfo.daysRemaining} days left in your trial. Subscribe now to ensure uninterrupted access to AI insights and satellite monitoring.`,
    cta: 'Subscribe Early',
  }
}

// ============================================================================
// GRACE PERIOD (30 days after tier upgrade)
// ============================================================================

export interface GracePeriodInfo {
  isActive: boolean
  daysRemaining: number
  reason: string
}

export function calculateGracePeriod(
  tierUpgradeDate: Date | string | null
): GracePeriodInfo {
  if (!tierUpgradeDate) {
    return {
      isActive: false,
      daysRemaining: 0,
      reason: 'No tier upgrade',
    }
  }
  
  const upgradeDate = new Date(tierUpgradeDate)
  const gracePeriodEnd = new Date(upgradeDate)
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30)
  
  const now = new Date()
  const msRemaining = gracePeriodEnd.getTime() - now.getTime()
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  
  const isActive = daysRemaining > 0
  
  return {
    isActive,
    daysRemaining: Math.max(0, daysRemaining),
    reason: isActive
      ? `Grace period active (${daysRemaining} days to upgrade)`
      : 'Grace period expired',
  }
}

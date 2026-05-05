// ============================================================================
// framedInsight Tier Calculation System
// ============================================================================
// Implements "Highest Tier Wins" + Multi-Enterprise Discounts
// Handles dairy, coffee, and sheep/goat enterprises

export type TierLevel = 'smallholder' | 'commercial' | 'enterprise' | 'enterprise_plus'

export interface TierInfo {
  tier: TierLevel
  level: number
  price: number
  originalPrice: number
  discount: number
  enterpriseCount: number
  enterprises: EnterpriseTier[]
  drivingEnterprise: string
  features: string[]
}

export interface EnterpriseTier {
  enterprise: 'dairy' | 'coffee' | 'small_ruminants'
  tier: TierLevel
  level: number
  details: string
}

// ============================================================================
// TIER PRICING
// ============================================================================

const TIER_PRICES: Record<TierLevel, number> = {
  smallholder: 0,
  commercial: 500,
  enterprise: 2500,
  enterprise_plus: 5000, // For cooperatives
}

const TIER_LEVELS: Record<TierLevel, number> = {
  smallholder: 1,
  commercial: 2,
  enterprise: 3,
  enterprise_plus: 4,
}

// ============================================================================
// DAIRY TIER CALCULATION
// ============================================================================

export interface DairyStats {
  totalCows: number
  producingCows: number
}

export function getDairyTier(stats: DairyStats): EnterpriseTier {
  const { totalCows, producingCows } = stats

  if (totalCows === 0) {
    return {
      enterprise: 'dairy',
      tier: 'smallholder',
      level: 0,
      details: 'No cows registered',
    }
  }

  // Smallholder: ≤5 cows OR ≤3 producing
  if (totalCows <= 5 || producingCows <= 3) {
    return {
      enterprise: 'dairy',
      tier: 'smallholder',
      level: 1,
      details: `${totalCows} cows (${producingCows} producing)`,
    }
  }

  // Commercial: 6-30 cows OR 4-15 producing
  if (totalCows <= 30 || producingCows <= 15) {
    return {
      enterprise: 'dairy',
      tier: 'commercial',
      level: 2,
      details: `${totalCows} cows (${producingCows} producing)`,
    }
  }

  // Enterprise: 31-100 cows OR 16-50 producing
  if (totalCows <= 100 || producingCows <= 50) {
    return {
      enterprise: 'dairy',
      tier: 'enterprise',
      level: 3,
      details: `${totalCows} cows (${producingCows} producing)`,
    }
  }

  // Enterprise Plus: 101+ cows OR 51+ producing
  return {
    enterprise: 'dairy',
    tier: 'enterprise_plus',
    level: 4,
    details: `${totalCows} cows (${producingCows} producing)`,
  }
}

// ============================================================================
// COFFEE TIER CALCULATION
// ============================================================================

export interface CoffeeStats {
  totalAcreage: number
  totalTrees: number
  matureAcreage: number // Only count mature coffee (3+ years)
}

export function getCoffeeTier(stats: CoffeeStats): EnterpriseTier {
  const { matureAcreage, totalTrees } = stats

  if (matureAcreage === 0 && totalTrees === 0) {
    return {
      enterprise: 'coffee',
      tier: 'smallholder',
      level: 0,
      details: 'No coffee registered',
    }
  }

  // Smallholder: ≤2 acres OR ≤1000 trees (mature only)
  if (matureAcreage <= 2 || totalTrees <= 1000) {
    return {
      enterprise: 'coffee',
      tier: 'smallholder',
      level: 1,
      details: `${matureAcreage.toFixed(1)} acres mature (${totalTrees} trees)`,
    }
  }

  // Commercial: 2.1-10 acres OR 1001-5000 trees
  if (matureAcreage <= 10 || totalTrees <= 5000) {
    return {
      enterprise: 'coffee',
      tier: 'commercial',
      level: 2,
      details: `${matureAcreage.toFixed(1)} acres mature (${totalTrees} trees)`,
    }
  }

  // Enterprise: 10.1-50 acres OR 5001-25000 trees
  if (matureAcreage <= 50 || totalTrees <= 25000) {
    return {
      enterprise: 'coffee',
      tier: 'enterprise',
      level: 3,
      details: `${matureAcreage.toFixed(1)} acres mature (${totalTrees} trees)`,
    }
  }

  // Enterprise Plus: 50+ acres OR 25000+ trees
  return {
    enterprise: 'coffee',
    tier: 'enterprise_plus',
    level: 4,
    details: `${matureAcreage.toFixed(1)} acres mature (${totalTrees} trees)`,
  }
}

// ============================================================================
// SHEEP/GOAT TIER CALCULATION
// ============================================================================

export interface SmallRuminantStats {
  totalAnimals: number
  goats: number
  sheep: number
}

export function getSmallRuminantTier(stats: SmallRuminantStats): EnterpriseTier {
  const { totalAnimals, goats, sheep } = stats

  if (totalAnimals === 0) {
    return {
      enterprise: 'small_ruminants',
      tier: 'smallholder',
      level: 0,
      details: 'No sheep/goats registered',
    }
  }

  // Smallholder: ≤10 animals
  if (totalAnimals <= 10) {
    return {
      enterprise: 'small_ruminants',
      tier: 'smallholder',
      level: 1,
      details: `${totalAnimals} animals (${goats} goats, ${sheep} sheep)`,
    }
  }

  // Commercial: 11-70 animals
  if (totalAnimals <= 70) {
    return {
      enterprise: 'small_ruminants',
      tier: 'commercial',
      level: 2,
      details: `${totalAnimals} animals (${goats} goats, ${sheep} sheep)`,
    }
  }

  // Enterprise: 71-300 animals
  if (totalAnimals <= 300) {
    return {
      enterprise: 'small_ruminants',
      tier: 'enterprise',
      level: 3,
      details: `${totalAnimals} animals (${goats} goats, ${sheep} sheep)`,
    }
  }

  // Enterprise Plus: 301+ animals
  return {
    enterprise: 'small_ruminants',
    tier: 'enterprise_plus',
    level: 4,
    details: `${totalAnimals} animals (${goats} goats, ${sheep} sheep)`,
  }
}

// ============================================================================
// MULTI-ENTERPRISE DISCOUNT
// ============================================================================

function calculateDiscount(enterpriseCount: number): number {
  if (enterpriseCount === 1) return 0      // No discount
  if (enterpriseCount === 2) return 0.1    // 10% off
  if (enterpriseCount >= 3) return 0.2     // 20% off
  return 0
}

// ============================================================================
// MAIN TIER CALCULATION (HIGHEST TIER WINS)
// ============================================================================

export interface FarmStats {
  dairy?: DairyStats
  coffee?: CoffeeStats
  smallRuminants?: SmallRuminantStats
}

export function calculateFarmTier(stats: FarmStats): TierInfo {
  const tiers: EnterpriseTier[] = []

  // Calculate tier for each enterprise
  if (stats.dairy && stats.dairy.totalCows > 0) {
    tiers.push(getDairyTier(stats.dairy))
  }

  if (stats.coffee && (stats.coffee.matureAcreage > 0 || stats.coffee.totalTrees > 0)) {
    tiers.push(getCoffeeTier(stats.coffee))
  }

  if (stats.smallRuminants && stats.smallRuminants.totalAnimals > 0) {
    tiers.push(getSmallRuminantTier(stats.smallRuminants))
  }

  // Filter out enterprises with level 0 (not registered)
  const activeTiers = tiers.filter(t => t.level > 0)

  // Default to smallholder if no enterprises
  if (activeTiers.length === 0) {
    return {
      tier: 'smallholder',
      level: 1,
      price: 0,
      originalPrice: 0,
      discount: 0,
      enterpriseCount: 0,
      enterprises: [],
      drivingEnterprise: 'None',
      features: getSmallholderFeatures(),
    }
  }

  // Find highest tier (Highest Tier Wins rule)
  const highestTier = activeTiers.reduce((max, current) =>
    current.level > max.level ? current : max
  )

  // Calculate pricing with multi-enterprise discount
  const enterpriseCount = activeTiers.length
  const originalPrice = TIER_PRICES[highestTier.tier]
  const discountRate = calculateDiscount(enterpriseCount)
  const finalPrice = Math.round(originalPrice * (1 - discountRate))

  return {
    tier: highestTier.tier,
    level: highestTier.level,
    price: finalPrice,
    originalPrice,
    discount: discountRate * 100,
    enterpriseCount,
    enterprises: activeTiers,
    drivingEnterprise: formatEnterpriseName(highestTier.enterprise),
    features: getTierFeatures(highestTier.tier),
  }
}

// ============================================================================
// TIER FEATURES
// ============================================================================

function getSmallholderFeatures(): string[] {
  return [
    'Unlimited records',
    'WhatsApp recording',
    'GPS field mapping',
    'Basic charts (7 days)',
    'Basic alerts',
  ]
}

function getTierFeatures(tier: TierLevel): string[] {
  const features = getSmallholderFeatures()

  if (tier === 'commercial' || tier === 'enterprise' || tier === 'enterprise_plus') {
    features.push(
      'AI disease detection',
      'AI breeding predictions',
      'Satellite NDVI monitoring',
      'Financial analytics',
      'EUDR compliance PDF',
      'Unlimited history',
      'CSV/PDF export',
      'Priority support'
    )
  }

  if (tier === 'enterprise' || tier === 'enterprise_plus') {
    features.push(
      'Multi-farm management (up to 3)',
      'Team accounts (5 users)',
      'API access',
      'Monthly reports'
    )
  }

  if (tier === 'enterprise_plus') {
    features.push(
      'Unlimited farms',
      'Unlimited team accounts',
      'Custom integrations',
      'Dedicated support',
      'On-farm training'
    )
  }

  return features
}

// ============================================================================
// HELPERS
// ============================================================================

function formatEnterpriseName(enterprise: string): string {
  const names: Record<string, string> = {
    dairy: 'Dairy',
    coffee: 'Coffee',
    small_ruminants: 'Sheep/Goats',
  }
  return names[enterprise] || enterprise
}

export function getTierName(tier: TierLevel): string {
  const names: Record<TierLevel, string> = {
    smallholder: 'Smallholder',
    commercial: 'Commercial',
    enterprise: 'Enterprise',
    enterprise_plus: 'Enterprise Plus',
  }
  return names[tier]
}

export function getTierColor(tier: TierLevel): string {
  const colors: Record<TierLevel, string> = {
    smallholder: 'bg-gray-100 text-gray-800 border-gray-300',
    commercial: 'bg-blue-100 text-blue-800 border-blue-300',
    enterprise: 'bg-primary-100 text-primary-800 border-primary-300',
    enterprise_plus: 'bg-purple-100 text-purple-800 border-purple-300',
  }
  return colors[tier]
}

// ============================================================================
// CALCULATE MATURE COFFEE ACREAGE
// ============================================================================

export function calculateMatureCoffeeAcreage(plots: any[]): number {
  const currentDate = new Date()
  
  return plots.reduce((total, plot) => {
    const plantingDate = new Date(plot.planting_date)
    const yearsOld = (currentDate.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    
    // Coffee is productive after 3 years
    if (yearsOld >= 3) {
      return total + (plot.acreage || 0)
    }
    return total
  }, 0)
}

// ============================================================================
// NEXT TIER MILESTONE
// ============================================================================

export function getNextMilestone(currentTier: TierInfo): string | null {
  const { tier, enterprises } = currentTier

  if (tier === 'enterprise_plus') {
    return null // Already at highest tier
  }

  const suggestions: string[] = []

  // Check each enterprise for upgrade paths
  enterprises.forEach(ent => {
    if (ent.enterprise === 'dairy') {
      if (ent.tier === 'smallholder') {
        suggestions.push('Add 4 more cows to reach Commercial tier')
      } else if (ent.tier === 'commercial') {
        suggestions.push('Grow to 31+ cows for Enterprise tier')
      }
    }

    if (ent.enterprise === 'coffee') {
      if (ent.tier === 'smallholder') {
        suggestions.push('Expand coffee to 2.1+ acres for Commercial tier')
      } else if (ent.tier === 'commercial') {
        suggestions.push('Expand coffee to 10.1+ acres for Enterprise tier')
      }
    }

    if (ent.enterprise === 'small_ruminants') {
      if (ent.tier === 'smallholder') {
        suggestions.push('Add 6 more sheep/goats to reach Commercial tier')
      } else if (ent.tier === 'commercial') {
        suggestions.push('Grow to 71+ sheep/goats for Enterprise tier')
      }
    }
  })

  return suggestions[0] || null
}

const PRODUCT_RULES = [
  // 🔴 Restricted / Banned (Immediate danger or legal prohibition in Kenya)
  {
    match: ['paraquat', 'gramoxone', 'diquat'],
    risk: 'restricted',
    message: 'Highly toxic and banned/restricted in Kenya. Use safer alternatives like glyphosate with care.',
  },
  {
    match: ['chlorpyrifos', 'dursban', 'terminator'],
    risk: 'restricted',
    message: 'Banned for use on coffee. Now restricted to termite control in non-crop areas only.',
  },
  {
    match: ['2,4-d amine', 'agromine'],
    risk: 'restricted',
    message: 'Newly restricted in Kenya (2024/25); specifically prohibited for use in coffee plantations.',
  },
  {
    match: ['dimethoate', 'danadim', 'rogor'],
    risk: 'restricted',
    message: 'Restricted use. Highly toxic to pollinators and hazardous for coffee workers.',
  },
  {
    match: ['endosulfan', 'thiodan'],
    risk: 'restricted',
    message: 'Globally banned persistent organic pollutant. Prohibited on all Kenyan coffee farms.',
  },

  // 🟠 Export risk (EU/International residue limits - "Make or Break" for exporters)
  {
    match: ['imidacloprid', 'confidor', 'thunder'],
    risk: 'high',
    message: 'High export risk. EU has severely lowered MRLs; restricted to greenhouses/non-edibles.',
  },
  {
    match: ['chlorothalonil', 'daconil', 'bravo'],
    risk: 'high',
    message: 'Banned in the EU. Using this may lead to rejection of coffee shipments at the border.',
  },
  {
    match: ['mancozeb', 'oshothane', 'milthane'],
    risk: 'high',
    message: 'Under heavy review/ban in EU (2025). High risk of exceeding residue limits in exports.',
  },
  {
    match: ['iprodione', 'rovral'],
    risk: 'high',
    message: 'EU approval withdrawn. Residue limits lowered to detection level (LOD). Do not use.',
  },
  {
    match: ['acetamiprid', 'mospilan', 'growprid'],
    risk: 'high',
    message: 'New EU MRL tightened (effective Aug 2025). Use strictly according to Pre-Harvest Intervals.',
  },

  // 🟡 Moderate (Standard use but requires specific safety protocols)
  {
    match: ['glyphosate', 'roundup', 'kausha', 'twigasate'],
    risk: 'moderate',
    message: 'Safe if used carefully. Avoid contact with coffee stems to prevent bark injury.',
  },
  {
    match: ['copper oxychloride', 'nordox', 'isacop'],
    risk: 'moderate',
    message: 'Ensure correct dosage to avoid soil heavy metal accumulation over long periods.',
  },

  // 🧠 Resistance warning (Rotation required)
  {
    match: ['cabrio', 'amistar', 'score', 'tebuconazole', 'azoxystrobin'],
    risk: 'low',
    message: 'Targeted fungicide. Must be rotated with multi-site copper to prevent CBD resistance.',
  },
  {
    match: ['cypermethrin', 'alphacypermethrin', 'deltamethrin'],
    risk: 'low',
    message: 'Pyrethroid resistance risk. Limit use to avoid flare-ups of secondary pests like mites.',
  },
]
export interface AgronomyAdvice {
  warnings: string[]
  recommendations: string[]
  bestpractices: string[]
}

export async function generateAgronomyAdvice(productName: string, activityType: string): Promise<AgronomyAdvice> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const bestpractices: string[] = []

  if (!productName || productName.trim() === '') {
    return { warnings, recommendations, bestpractices }
  }

  const lower = productName.toLowerCase()

  // Check against product rules
  for (const rule of PRODUCT_RULES) {
    for (const keyword of rule.match) {
      if (lower.includes(keyword)) {
        warnings.push(`[${rule.risk.toUpperCase()}] ${rule.message}`)
        break
      }
    }
  }

  // Activity-specific advice
  if (activityType === 'spraying') {
    bestpractices.push('Apply early morning or late afternoon to avoid leaf burn.')
    bestpractices.push('Use full PPE: gloves, mask, and eye protection.')
    bestpractices.push('Do not spray during rain or windy conditions.')
    bestpractices.push('Maintain 14-day pre-harvest interval minimum.')
  }

  if (activityType === 'fertilizer') {
    bestpractices.push('Apply before main rains for best uptake.')
    bestpractices.push('Split applications for better nutrient management.')
    bestpractices.push('Avoid direct contact with stems to prevent burn.')
  }

  return { warnings, recommendations, bestpractices }
}
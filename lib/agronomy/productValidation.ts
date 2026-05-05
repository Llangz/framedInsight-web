/**
 * Product Validation for Coffee Activities
 * Validates fertilizer, pesticide, and herbicide products against known agronomic data
 */

export interface ProductValidation {
  valid: boolean
  warnings: string[]
  recommendations: string[]
  safetyNotes: string[]
}

// Known Kenyan coffee fertilizers & their characteristics
const KNOWN_FERTILIZERS: Record<string, any> = {
  'CAN': { 
    name: 'Calcium Ammonium Nitrate',
    nitrogen: 26,
    safeTiming: 'Before flowering',
    safeRateKgHa: '200-250',
  },
  'NPK 17:17:17': { 
    name: 'NPK 17:17:17',
    nitrogen: 17,
    phosphorus: 17,
    potassium: 17,
    safeTiming: 'Main crop season',
    safeRateKgHa: '250-300',
  },
  'DAP': { 
    name: 'Diammonium Phosphate',
    nitrogen: 18,
    phosphorus: 46,
    safeTiming: 'Vegetative growth',
    safeRateKgHa: '150-200',
  },
}

// Known coffee pesticides/fungicides
const KNOWN_PESTICIDES: Record<string, any> = {
  'Copper Oxychloride': {
    activeIngredient: 'Copper',
    targetDisease: 'CBD, CLR',
    dilution: '50g per 20L water',
    withHoldingPeriod: '21 days',
  },
  'Mancozeb': {
    activeIngredient: 'Mancozeb',
    targetDisease: 'Fungal diseases',
    dilution: '25g per 20L water',
    withHoldingPeriod: '14 days',
  },
}

export async function validateProduct(
  productName: string,
  activityType: string,
  quantity?: number,
): Promise<ProductValidation> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const safetyNotes: string[] = []
  let valid = true

  if (!productName || productName.trim() === '') {
    return { valid: true, warnings: [], recommendations: [], safetyNotes: [] }
  }

  // Check if product is in known database
  const asLower = productName.toLowerCase()
  
  if (activityType === 'fertilizer') {
    const known = Object.entries(KNOWN_FERTILIZERS).find(
      ([key]) => key.toLowerCase().includes(asLower) || asLower.includes(key.toLowerCase())
    )
    
    if (!known) {
      warnings.push(`"${productName}" not in known fertilizer database. Verify safety before applying.`)
    }
    
    if (quantity && quantity > 500) {
      warnings.push(`High application rate (${quantity}kg). Verify dosage to avoid over-fertilization.`)
    }
  }

  if (activityType === 'spraying') {
    const known = Object.entries(KNOWN_PESTICIDES).find(
      ([key]) => key.toLowerCase().includes(asLower) || asLower.includes(key.toLowerCase())
    )
    
    if (!known) {
      warnings.push(`"${productName}" not in known fungicide database. Consult extension officer.`)
    } else {
      safetyNotes.push(`Use PPE: gloves, mask, eye protection. Avoid applying during rain.`)
    }
  }

  return { valid, warnings, recommendations, safetyNotes }
}

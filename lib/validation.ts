// ============================================================================
// framedInsight Validation Utilities
// ============================================================================
// Phone validation, email validation, and Kenyan-specific formatters

// ============================================================================
// KENYAN PHONE NUMBER VALIDATION
// ============================================================================

export interface PhoneValidationResult {
  isValid: boolean
  formatted: string
  carrier: string | null
  error: string | null
}

// Kenyan mobile carriers and their prefixes
const KENYAN_CARRIERS = {
  safaricom: [
    // 07XX series
    '0700', '0701', '0702', '0703', '0704', '0705', '0706', '0707', '0708', '0709',
    '0710', '0711', '0712', '0713', '0714', '0715', '0716', '0717', '0718', '0719',
    '0720', '0721', '0722', '0723', '0724', '0725', '0726', '0727', '0728', '0729',
    '0740', '0741', '0742', '0743', '0745', '0746', '0748',
    '0757', '0758', '0759',
    '0768', '0769',
    '0790', '0791', '0792', '0793', '0794', '0795', '0796', '0797', '0798', '0799',
    // 011X series (2019+)
    '0110', '0111', '0112', '0113', '0114', '0115', '0116', '0117',
  ],
  airtel: [
    // 07XX series
    '0730', '0731', '0732', '0733', '0734', '0735', '0736', '0737', '0738', '0739',
    '0750', '0751', '0752', '0753', '0754', '0755', '0756',
    '0762',
    '0780', '0781', '0782', '0783', '0784', '0785', '0786', '0787', '0788', '0789',
    // 010X series (2019+)
    '0100', '0101', '0102', '0103', '0104', '0105', '0106', '0107', '0108',
  ],
  telkom: [
    '0770', '0771', '0772', '0773', '0774', '0775', '0776', '0777', '0778', '0779',
  ],
  equitel: [
    '0763', '0764', '0765', '0766',
  ],
  faiba: [
    '0747',
  ],
  mvno: [
    '0744', // Homelands Media
    '0760', // Mobile Pay
    '0761', // Eferio
    '0767', // Sema Mobile
  ],
}

export function validateKenyanPhone(phone: string): PhoneValidationResult {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')

  let normalized = cleaned
  if (cleaned.startsWith('+254')) {
    normalized = cleaned.slice(4)
  } else if (cleaned.startsWith('254')) {
    normalized = cleaned.slice(3)
  } else if (cleaned.startsWith('0')) {
    normalized = cleaned.slice(1)
  }

  if (normalized.length !== 9) {
    return {
      isValid: false,
      formatted: phone,
      carrier: null,
      error: 'Kenyan phone numbers must be 9 digits (e.g., 0712345678)',
    }
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      isValid: false,
      formatted: phone,
      carrier: null,
      error: 'Phone number must contain only digits',
    }
  }

  // Check against 4-digit prefix (most specific)
  const prefix4 = '0' + normalized.slice(0, 3)
  let carrier: string | null = null

  for (const [carrierName, prefixes] of Object.entries(KENYAN_CARRIERS)) {
    if (prefixes.includes(prefix4)) {
      carrier = carrierName
      break
    }
  }

  if (!carrier) {
    // Accept any valid 07XX or 01XX format number due to MNP
    // A prefix may have been ported or newly allocated
    if (/^[71]\d{8}$/.test(normalized)) {
      carrier = 'unknown'
    } else {
      return {
        isValid: false,
        formatted: phone,
        carrier: null,
        error: 'Not a recognized Kenyan mobile number (must start with 07XX or 01XX)',
      }
    }
  }

  return {
    isValid: true,
    formatted: `+254${normalized}`,
    carrier,
    error: null,
  }
}

// ============================================================================
// PHONE FORMATTING FOR DISPLAY
// ============================================================================

export function formatPhoneForDisplay(phone: string): string {
  const validation = validateKenyanPhone(phone)
  if (!validation.isValid) return phone
  
  // Format as: +254 712 345 678
  const normalized = validation.formatted.slice(4) // Remove +254
  return `+254 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

export function validateEmail(email: string): { isValid: boolean; error: string | null } {
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!email) {
    return { isValid: true, error: null } // Email is optional
  }
  
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address',
    }
  }
  
  return { isValid: true, error: null }
}

// ============================================================================
// NAME VALIDATION
// ============================================================================

export function validateName(name: string): { isValid: boolean; error: string | null } {
  if (!name || name.trim().length < 2) {
    return {
      isValid: false,
      error: 'Name must be at least 2 characters',
    }
  }
  
  if (name.trim().length > 100) {
    return {
      isValid: false,
      error: 'Name must be less than 100 characters',
    }
  }
  
  // Allow letters, spaces, hyphens, apostrophes (for names like O'Brien, Mary-Ann)
  const nameRegex = /^[a-zA-Z\s\-']+$/
  
  if (!nameRegex.test(name)) {
    return {
      isValid: false,
      error: 'Name can only contain letters, spaces, hyphens, and apostrophes',
    }
  }
  
  return { isValid: true, error: null }
}

// ============================================================================
// FARM NAME VALIDATION
// ============================================================================

export function validateFarmName(name: string): { isValid: boolean; error: string | null } {
  if (!name || name.trim().length < 2) {
    return {
      isValid: false,
      error: 'Farm name must be at least 2 characters',
    }
  }
  
  if (name.trim().length > 100) {
    return {
      isValid: false,
      error: 'Farm name must be less than 100 characters',
    }
  }
  
  return { isValid: true, error: null }
}

// ============================================================================
// KENYAN COUNTY VALIDATION
// ============================================================================

export const KENYAN_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos',
  'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang\'a',
  'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia',
  'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
]

export function validateCounty(county: string): { isValid: boolean; error: string | null } {
  if (!county) {
    return {
      isValid: false,
      error: 'Please select a county',
    }
  }
  
  if (!KENYAN_COUNTIES.includes(county)) {
    return {
      isValid: false,
      error: 'Please select a valid Kenyan county',
    }
  }
  
  return { isValid: true, error: null }
}

// ============================================================================
// GPS COORDINATES VALIDATION
// ============================================================================

export function validateGPSCoordinates(
  latitude: number,
  longitude: number
): { isValid: boolean; error: string | null } {
  // Kenya bounds (approximate)
  const KENYA_BOUNDS = {
    minLat: -4.7,
    maxLat: 5.5,
    minLng: 33.9,
    maxLng: 41.9,
  }
  
  if (latitude < KENYA_BOUNDS.minLat || latitude > KENYA_BOUNDS.maxLat) {
    return {
      isValid: false,
      error: 'Latitude must be within Kenya bounds',
    }
  }
  
  if (longitude < KENYA_BOUNDS.minLng || longitude > KENYA_BOUNDS.maxLng) {
    return {
      isValid: false,
      error: 'Longitude must be within Kenya bounds',
    }
  }
  
  return { isValid: true, error: null }
}

// ============================================================================
// ACREAGE CALCULATION FROM GPS POLYGON
// ============================================================================

export function calculateAcreageFromGPS(coordinates: [number, number][]): number {
  if (coordinates.length < 3) return 0
  
  // Use Shoelace formula to calculate area
  let area = 0
  const n = coordinates.length
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += coordinates[i][0] * coordinates[j][1]
    area -= coordinates[j][0] * coordinates[i][1]
  }
  
  area = Math.abs(area) / 2
  
  // Convert from square degrees to square meters (approximate)
  // 1 degree ≈ 111,000 meters at equator
  const sqMeters = area * 111000 * 111000
  
  // Convert to acres (1 acre = 4046.86 square meters)
  const acres = sqMeters / 4046.86
  return parseFloat(acres.toFixed(2))
}

// ============================================================================
// SECURITY & SANITIZATION (HARDENING)
// ============================================================================

/**
 * Basic XSS prevention - strips HTML tags and potentially dangerous chars
 */
export function sanitizeString(val: string): string {
  if (typeof val !== 'string') return val
  return val
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[&<>"']/g, (m) => {
      const entities: any = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }
      return entities[m]
    })
    .trim()
}

/**
 * Recursively sanitizes all strings in an object
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj
  
  const sanitized: any = Array.isArray(obj) ? [] : {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized as T
}

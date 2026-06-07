"// ============================================================================
// framedInsight Security Utilities
// ============================================================================
// Centralized security: rate limiting, CSRF, input validation, audit logging
// ============================================================================

import { z } from 'zod'

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

export const PoultryBatchSchema = z.object({
  batch_name: z.string().min(1).max(100).trim(),
  bird_type: z.enum(['layer', 'broiler', 'kienyeji', 'dual_purpose']),
  breed: z.string().max(100).nullable().optional(),
  current_count: z.number().int().positive(),
  date_of_placement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  house_number: z.string().max(50).nullable().optional(),
  status: z.enum(['active', 'sold', 'culled']).optional().default('active'),
  notes: z.string().max(2000).nullable().optional(),
})

export const PoultryMortalitySchema = z.object({
  batch_id: z.string().uuid(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count_dead: z.number().int().positive(),
  cause: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export const PoultryHealthSchema = z.object({
  batch_id: z.string().uuid(),
  event_type: z.string().max(100),
  vaccine_name: z.string().max(200).nullable().optional(),
  drug_name: z.string().max(200).nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export const PoultryFeedSchema = z.object({
  batch_id: z.string().uuid(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  feed_type: z.string().max(200),
  quantity_kg: z.number().nonnegative(),
  cost: z.number().nonnegative().nullable().optional(),
  days_remaining: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const PoultrySaleSchema = z.object({
  batch_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  price_per_unit: z.number().nonnegative(),
  sale_type: z.enum(['eggs', 'birds']),
  buyer_name: z.string().max(200).nullable().optional(),
  buyer_phone: z.string().max(20).nullable().optional(),
  payment_method: z.string().max(50).nullable().optional(),
  sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).nullable().optional(),
})

// ============================================================================
// RATE LIMITING (In-Memory Fallback)
// For production, use Redis or Supabase-based rate limiting
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt < now) rateLimitStore.delete(key)
    }
  }, 5 * 60 * 1000)
}

/**
 * Simple in-memory rate limiter
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false

  entry.count++
  return true
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export interface AuditLogEntry {
  action: string
  actorId: string | null
  farmId: string | null
  resource: string
  resourceId: string | null
  details: Record<string, any>
  ip: string | null
  timestamp?: string
}

/**
 * Log security-relevant events
 */
export function auditLog(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const log = {
    ...entry,
    timestamp: new Date().toISOString(),
  }

  // Redact sensitive fields
  if (log.details?.password) log.details.password = '[REDACTED]'
  if (log.details?.otp) log.details.otp = '[REDACTED]'
  if (log.details?.token) log.details.token = '[REDACTED]'

  console.log('[AUDIT]', JSON.stringify(log))
}

// ============================================================================
// CSRF TOKEN GENERATION & VALIDATION
// ============================================================================

import crypto from 'crypto'

export function generateCsrfToken(sessionId: string): string {
  const secret = process.env.CSRF_SECRET || 'change-me-in-production'
  const payload = `${sessionId}:${Date.now()}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64')}.${hmac}`
}

export function validateCsrfToken(token: string, sessionId: string): boolean {
  try {
    const [encodedPayload, signature] = token.split('.')
    const payload = Buffer.from(encodedPayload, 'base64').toString()
    const [sid] = payload.split(':')
    
    if (sid !== sessionId) return false
    
    const secret = process.env.CSRF_SECRET || 'change-me-in-production'
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  } catch {
    return false
  }
}

// ============================================================================
// SQL INJECTION PREVENTION HELPERS
// ============================================================================

/**
 * Recursively strip dangerous keys from objects before DB operations
 * Only removes keys that could be used for privilege escalation
 */
export function stripDangerousKeys<T extends Record<string, any>>(obj: T): T {
  const dangerousPatterns = [
    'role', 'is_admin', 'is_superuser', 'password', 'password_hash', 
    'service_role', 'supabase_secret', 'api_key', 'secret',
  ]
  
  const sanitized = { ...obj }
  for (const key of Object.keys(sanitized)) {
    const keyLower = key.toLowerCase()
    if (dangerousPatterns.some(pattern => keyLower.includes(pattern))) {
      delete sanitized[key as keyof T]
    }
    // Recursively sanitize nested objects (but not arrays)
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = stripDangerousKeys(sanitized[key] as Record<string, any>) as any
    }
  }
  return sanitized
}"

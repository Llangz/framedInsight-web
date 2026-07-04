// ============================================================================
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
// RATE LIMITING (Vercel KV / Upstash Redis with In-Memory Fallback)
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt < now) rateLimitStore.delete(key)
    }
  }, 5 * 60 * 1000)
}

function checkRateLimitInMemory(key: string, maxRequests: number, windowMs: number): boolean {
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

export async function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // Graceful fallback to memory if KV is not configured
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }

  try {
    // Vercel KV REST API via Upstash Pipeline
    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['PTTL', key]
      ])
    })
    
    if (!response.ok) return true; // fail open

    const results = await response.json();
    const count = results[0]?.result;
    const ttl = results[1]?.result;

    // If there's no expiration set (-1 or -2)
    if (ttl === -1 || ttl === -2) {
      await fetch(`${url}/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['PEXPIRE', key, windowMs])
      });
    }

    return count <= maxRequests;
  } catch (error) {
    console.warn('[Rate Limit] KV error, falling back to memory:', error)
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }
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

// Lazily-created service-role client. Audit writes must never be blocked by
// (or block on) a user's own RLS-scoped session — many audited events
// (OTP_RATE_LIMITED, failed logins) happen before there's an authenticated
// user at all — so this always goes through the service-role key, same
// pattern as lib/passport/buyer-access.service.ts's createAdminClient().
let _auditClient: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null

async function getAuditClient() {
  if (_auditClient) return _auditClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const { createClient } = await import('@supabase/supabase-js')
  _auditClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _auditClient
}

/**
 * Writes a structured audit entry to the persistent `audit_log` table
 * (supabase/migrations/20260704a_audit_log.sql) and mirrors it to
 * console.log for real-time log tailing during an incident.
 *
 * Fire-and-forget by design: callers do not (and should not have to)
 * `await` this — auditing a request must never be the reason a request
 * fails or is delayed. Internally, though, we never let a DB write
 * failure disappear silently: if the DB write fails, the console log
 * line is what's left, and it's still emitted either way.
 *
 * Returns a Promise so callers who *do* want to await it (e.g. before
 * responding, on a path where the audit trail is the whole point) can.
 */
export async function auditLog(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  const log = {
    ...entry,
    timestamp: new Date().toISOString(),
  }

  if (log.details?.password) log.details.password = '[REDACTED]'
  if (log.details?.otp) log.details.otp = '[REDACTED]'
  if (log.details?.token) log.details.token = '[REDACTED]'

  // Always emit to console — cheap, immediate, and the only record we have
  // if the DB write below fails or Supabase env vars aren't configured.
  console.log('[AUDIT]', JSON.stringify(log))

  try {
    const client = await getAuditClient()
    if (!client) {
      console.warn('[AUDIT] SUPABASE_SERVICE_ROLE_KEY not set — audit entry only written to console.log')
      return
    }

    // Cast: `audit_log` isn't in lib/database.types.ts yet (generated types
    // haven't been regenerated since this migration was added). Regenerate
    // with `supabase gen types` after applying the migration and this cast
    // can be dropped.
    const { error } = await (client.from('audit_log') as any).insert({
      action: log.action,
      actor_id: log.actorId,
      farm_id: log.farmId,
      resource: log.resource,
      resource_id: log.resourceId,
      details: log.details ?? {},
      ip: log.ip,
      created_at: log.timestamp,
    })

    if (error) {
      console.error('[AUDIT] Failed to persist audit entry to database:', error.message)
    }
  } catch (err: any) {
    // Never let an audit-logging failure surface as a request failure.
    console.error('[AUDIT] Unexpected error writing audit entry:', err?.message ?? err)
  }
}

// ============================================================================
// CSRF TOKEN GENERATION & VALIDATION
// ============================================================================

import crypto from 'crypto'

// 🔴 CRITICAL: Assert CSRF_SECRET is set
if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET === 'change-me-in-production') {
  throw new Error('CSRF_SECRET must be set in environment variables.')
}

export function generateCsrfToken(sessionId: string): string {
  const secret = process.env.CSRF_SECRET!
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
    
    const secret = process.env.CSRF_SECRET!
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

export function stripDangerousKeys<T extends Record<string, any>>(obj: T): T {
  const dangerousPatterns = [
    'role', 'is_admin', 'is_superuser', 'password', 'password_hash', 
    'service_role', 'supabase_secret', 'api_key', 'secret',
  ]
  
  // Cast to mutable Record to allow property assignment
  const sanitized = { ...obj } as Record<string, any>
  
  for (const key of Object.keys(sanitized)) {
    const keyLower = key.toLowerCase()
    if (dangerousPatterns.some(pattern => keyLower.includes(pattern))) {
      delete sanitized[key]
    }
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = stripDangerousKeys(sanitized[key])
    }
  }
  
  return sanitized as T
}
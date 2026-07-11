// ============================================================================
// framedInsight Security Utilities
// ============================================================================
// Centralized security: rate limiting, CSRF, input validation, audit logging
// ============================================================================

import { z } from 'zod'

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

// ============================================================================
// 20260708 hardening pass — corrections vs. lib/database.types.ts and the
// actual insert payloads sent by each *Client.tsx form. Two classes of bug
// fixed here:
//   1. Fields that don't exist as DB columns (silently dropped every write,
//      no error ever surfaced) — removed.
//   2. Fields with the wrong name (buyer_phone vs. the real buyer_contact
//      column) — renamed to match.
// All five schemas now also call .strict() so a payload with an unexpected
// key is rejected with a visible 400 instead of Zod quietly stripping it —
// the same silent-drop pattern that caused the original "Failed to update
// farm" bug (see app/api/farms/route.ts's PatchFarmSchema comment).
// ============================================================================

export const PoultryBatchSchema = z.object({
  batch_name: z.string().min(1).max(100).trim(),
  bird_type: z.enum(['layer', 'broiler', 'kienyeji', 'dual_purpose']),
  // ⚠️ breed / house_number: present in this schema and in both
  // AddBatchClient.tsx's and EditBatchClient.tsx's forms, but
  // AddBatchClient.tsx's actual .insert() call drops both before writing —
  // so even the "working" add flow doesn't persist them today. Confirm
  // these are real columns (`SELECT column_name FROM information_schema
  // .columns WHERE table_name = 'poultry_batches'` in the Supabase SQL
  // editor) before trusting data written through them.
  breed: z.string().max(100).nullable().optional(),
  current_count: z.number().int().positive(),
  date_of_placement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  house_number: z.string().max(50).nullable().optional(),
  status: z.enum(['active', 'sold', 'culled']).optional().default('active'),
  notes: z.string().max(2000).nullable().optional(),
}).strict()

export const PoultryMortalitySchema = z.object({
  batch_id: z.string().uuid(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count_dead: z.number().int().positive(),
  // Added 20260709 migration — see supabase/migrations/20260709_add_poultry_health_mortality_fields.sql
  cause: z.string().max(500).nullable().optional(),
  symptoms: z.string().max(1000).nullable().optional(),
  culling_reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).strict()

export const PoultryHealthSchema = z.object({
  batch_id: z.string().uuid(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_type: z.enum(['vaccination', 'treatment', 'deworming', 'vitamin_supplement', 'biosecurity_check', 'other']),
  // Added 20260709 migration — see supabase/migrations/20260709_add_poultry_health_mortality_fields.sql
  vaccine_name: z.string().max(200).nullable().optional(),
  disease: z.string().max(200).nullable().optional(),
  drug_name: z.string().max(200).nullable().optional(),
  dosage: z.string().max(200).nullable().optional(),
  vet_name: z.string().max(200).nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict()

export const PoultryFeedSchema = z.object({
  batch_id: z.string().uuid(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  feed_type: z.string().max(200),
  quantity_kg: z.number().nonnegative(),
  // `cost` removed — not a column on poultry_feed_records; FeedClient.tsx
  // computes cost_per_kg/total_cost for on-screen display only.
  days_remaining: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict()

export const PoultrySaleSchema = z.object({
  batch_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit: z.string().max(20).nullable().optional(),
  price_per_unit: z.number().nonnegative(),
  total_price: z.number().nonnegative().nullable().optional(),
  sale_type: z.enum(['eggs', 'eggs_loose', 'live_birds', 'dressed', 'day_old_chicks', 'manure']),
  buyer_name: z.string().max(200).nullable().optional(),
  // Renamed from buyer_phone — the real column is buyer_contact.
  buyer_contact: z.string().max(50).nullable().optional(),
  market: z.string().max(200).nullable().optional(),
  payment_method: z.string().max(50).nullable().optional(),
  sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).nullable().optional(),
}).strict()

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

// ============================================================================
// PUBLIC PAGE RATE LIMITING (buyer data room, public trace lookup)
// ============================================================================
// app/buyer/[token]/** and app/trace/[passportCode]/** are unauthenticated
// and reached by a guessable-adjacent path segment (a token or passport
// code, not a login). RLS and the PII-scoping already done on those routes
// stop a guessed/leaked value from returning anything sensitive, but
// nothing previously stopped high-volume guessing or scraping of the
// lookup path itself. This adds that missing layer, reusing the same
// Redis-backed `checkRateLimit` used for OTP/login.

import { headers } from 'next/headers'

/**
 * Rate-limits a public, unauthenticated page or route by client IP.
 * Returns `true` if the request should proceed, `false` if it should be
 * rejected. `scope` namespaces the limit per route (e.g. 'buyer-page',
 * 'trace-geojson') so one endpoint being hammered doesn't lock out another.
 */
export async function checkPublicPageRateLimit(
  scope: string,
  maxRequests = 30,
  windowMs = 60_000
): Promise<boolean> {
  try {
    const h = await headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      'unknown'
    return await checkRateLimit(`public:${scope}:${ip}`, maxRequests, windowMs)
  } catch (err) {
    // Fail open — a rate-limiter outage should never take down a public,
    // trust-critical page (a buyer opening a shared link, a QR-code scan).
    console.error(`checkPublicPageRateLimit(${scope}) error:`, err)
    return true
  }
}
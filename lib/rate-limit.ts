// ============================================================================
// framedInsight Rate Limiting (No External Dependencies)
// ============================================================================
// Simple in-memory rate limiter using Map with TTL
// For production with multiple instances, use Redis/Upstash instead
// ============================================================================

interface RateLimitEntry {
  count: number
  firstAttempt: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private readonly windowMs: number
  private readonly maxAttempts: number

  constructor(windowMs: number = 15 * 60 * 1000, maxAttempts: number = 5) {
    this.windowMs = windowMs // 15 minutes default
    this.maxAttempts = maxAttempts // 5 attempts default
  }

  /**
   * Check if request is rate limited
   * @param key - Unique identifier (e.g., IP address, phone number)
   * @returns { allowed: boolean, remaining: number, resetAt: number }
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    // No entry yet - allow request
    if (!entry) {
      this.store.set(key, { count: 1, firstAttempt: now })
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
        resetAt: now + this.windowMs,
      }
    }

    // Check if window has expired
    if (now - entry.firstAttempt > this.windowMs) {
      // Reset window
      this.store.set(key, { count: 1, firstAttempt: now })
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
        resetAt: now + this.windowMs,
      }
    }

    // Window still active - check count
    if (entry.count >= this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.firstAttempt + this.windowMs,
      }
    }

    // Increment count
    entry.count++
    this.store.set(key, entry)

    return {
      allowed: true,
      remaining: this.maxAttempts - entry.count,
      resetAt: entry.firstAttempt + this.windowMs,
    }
  }

  /**
   * Reset rate limit for a key (e.g., after successful OTP)
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clean up old entries (call periodically in production)
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.firstAttempt > this.windowMs) {
        this.store.delete(key)
      }
    }
  }
}

// ============================================================================
// Pre-configured limiters for different use cases
// ============================================================================

// OTP requests: 5 attempts per 15 minutes per phone
export const otpLimiter = new RateLimiter(15 * 60 * 1000, 5)

// Login attempts: 5 attempts per 15 minutes per IP
export const loginLimiter = new RateLimiter(15 * 60 * 1000, 5)

// API calls: 100 requests per minute per IP (general purpose)
export const apiLimiter = new RateLimiter(60 * 1000, 100)

// Payment requests: 3 attempts per 10 minutes per farm
export const paymentLimiter = new RateLimiter(10 * 60 * 1000, 3)

// ============================================================================
// Helper to get client IP (works with Vercel proxy)
// ============================================================================

export function getClientIP(headers: Headers): string {
  // Check for Vercel/Cloudflare forwarded headers
  const forwardedFor = headers.get('x-forwarded-for')
  const realIP = headers.get('x-real-ip')
  const cfConnectingIP = headers.get('cf-connecting-ip')

  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback (may not work in all environments)
  return 'unknown'
}

// ============================================================================
// Cleanup interval (prevent memory leaks)
// ============================================================================

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    otpLimiter.cleanup()
    loginLimiter.cleanup()
    apiLimiter.cleanup()
    paymentLimiter.cleanup()
  }, 5 * 60 * 1000)
}
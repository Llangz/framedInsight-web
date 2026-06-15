/**
 * CSRF Protection Helper
 * Validates CSRF tokens for state-changing API requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCsrfToken } from './security'

/**
 * Validates CSRF token from request headers
 * Returns 403 response if invalid, null if valid
 */
export function validateCsrfRequest(request: NextRequest, sessionId: string): NextResponse | null {
  const csrfToken = request.headers.get('x-csrf-token') ?? ''
  
  if (!csrfToken) {
    return NextResponse.json(
      { error: 'CSRF token missing' },
      { status: 403 }
    )
  }
  
  if (!validateCsrfToken(csrfToken, sessionId)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }
  
  return null // Valid - proceed with handler
}

/**
 * Extract session ID from request (customize based on your auth implementation)
 */
export function getSessionId(request: NextRequest): string {
  return request.cookies.get('session-id')?.value 
    ?? request.headers.get('x-session-id') 
    ?? ''
}

/**
 * Mask phone number for safe logging (shows first 7 chars + ***)
 */
export function maskPhone(phone: string): string {
  if (!phone) return 'unknown'
  return phone.slice(0, 7) + '***'
}
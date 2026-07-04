import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auditLog } from '@/lib/security'

/**
 * Normalise to E.164 format WITH the leading +.
 * RLS policy on phone_otp_codes requires: phone_number ~ '^\+[0-9]+$'
 */
function normalisePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) {
    digits = '254' + digits.slice(1)
  }
  if (!digits.startsWith('254')) {
    throw new Error('Invalid Kenyan phone number')
  }
  return '+' + digits
}

function generateOTP(): string {
  // Use crypto.randomInt for cryptographically secure random numbers
  const { randomInt } = require('crypto')
  return String(randomInt(100000, 999999))
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const { phone, metadata } = await req.json()

  // Get client IP for rate limiting and audit
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'

  if (!phone) {
    return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
  }

  let normalisedPhone: string
  try {
    normalisedPhone = normalisePhone(phone)
  } catch {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
  }

  // Use raw supabase-js client for service role to ensure RLS bypass.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  try {
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Check rate limit before proceeding
    const { data: withinLimit, error: rateLimitError } = await supabaseAdmin.rpc(
      'check_otp_rate_limit',
      { p_phone: normalisedPhone }
    )

    if (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError)
      // Fail open — don't block user if rate limit check itself errors
    } else if (!withinLimit) {
      auditLog({
        action: 'OTP_RATE_LIMITED',
        actorId: null,
        farmId: null,
        resource: 'phone_otp_codes',
        resourceId: normalisedPhone.slice(0, 7) + '***',
        details: { ip, userAgent },
        ip,
      })
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait an hour before trying again.' },
        { status: 429 }
      )
    }

    // Clear any existing OTP for this phone first
    await supabaseAdmin
      .from('phone_otp_codes')
      .delete()
      .eq('phone_number', normalisedPhone)

    // Store new OTP — phone stored as +254... to satisfy RLS policy
    const { error: dbError } = await supabaseAdmin
      .from('phone_otp_codes')
      .insert({
        phone_number: normalisedPhone,
        otp_code: otp,
        expires_at: expiresAt,
        metadata: metadata,
        created_at: new Date().toISOString(),
      })

    if (dbError) {
      console.error('Error storing OTP:', dbError)
      return NextResponse.json(
        { error: `Failed to generate verification code. Please try again.` },
        { status: 500 }
      )
    }

    // Call Supabase Edge Function to send SMS via Tiara Connect
    // Use INTERNAL_API_SECRET instead of the public anon key for cross-service auth
    const internalSecret = process.env.INTERNAL_API_SECRET
    if (!internalSecret) {
      console.error('INTERNAL_API_SECRET not configured')
      // Still consider OTP "sent" since it's stored — SMS is best-effort
      console.log('✅ OTP STORED for:', normalisedPhone.slice(0, 7) + '***')
      return NextResponse.json({ 
        success: true, 
        warning: 'SMS delivery currently unavailable, but OTP is stored. Contact support.'
      })
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-otp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalSecret,
        },
        body: JSON.stringify({ phone: normalisedPhone, otp }),
      }
    )

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      // Clean up OTP record if SMS failed
      await supabaseAdmin
        .from('phone_otp_codes')
        .delete()
        .eq('phone_number', normalisedPhone)

      let errorMessage = 'We couldn’t deliver the verification code. Please try again in a minute or contact support if it keeps failing.'
      if (response.status === 429) {
        errorMessage = 'SMS service rate limit reached. Please try again in a few moments.'
      } else if (response.status >= 500) {
        errorMessage = 'SMS service is temporarily unavailable. Please try again shortly.'
      } else if (data.error?.includes('Invalid phone')) {
        errorMessage = 'Invalid phone number format. Please check and try again.'
      } else if (data.error) {
        errorMessage = data.error
      }

      auditLog({
        action: 'OTP_SEND_FAILED',
        actorId: null,
        farmId: null,
        resource: 'sms',
        resourceId: normalisedPhone.slice(0, 7) + '***',
        details: { error: errorMessage, statusCode: response.status, ip, userAgent },
        ip,
      })

      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    auditLog({
      action: 'OTP_SENT',
      actorId: null,
      farmId: null,
      resource: 'phone_otp_codes',
      resourceId: normalisedPhone.slice(0, 7) + '***',
      details: { ip, userAgent },
      ip,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error in send-otp route:', error)
    auditLog({
      action: 'OTP_SEND_ERROR',
      actorId: null,
      farmId: null,
      resource: 'phone_otp_codes',
      resourceId: normalisedPhone?.slice(0, 7) + '***' || 'unknown',
      details: { error: error.message, ip, userAgent },
      ip,
    })
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}

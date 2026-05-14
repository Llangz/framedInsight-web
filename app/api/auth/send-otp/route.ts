import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const { phone, metadata } = await req.json()

  // ADD THIS DEBUG BLOCK
  console.log('🔧 Environment Check:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'MISSING'
  })

  if (!phone) {
    return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
  }

  let normalisedPhone: string
  try {
    normalisedPhone = normalisePhone(phone)
  } catch {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
  }

  // Use SERVICE ROLE KEY to bypass RLS and ensure DB writes succeed
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
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
        { error: `Failed to generate OTP: ${dbError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ OTP STORED:', {
      phone_number: normalisedPhone,
      otp_code: otp,
      expires_at: expiresAt,
      timestamp: new Date().toISOString()
    })

    // Call Supabase Edge Function to send SMS via Tiara Connect
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-otp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
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

      let errorMessage = 'Failed to send verification code'
      if (response.status === 429) {
        errorMessage = 'SMS service rate limit reached. Please try again in a few moments.'
      } else if (response.status >= 500) {
        errorMessage = 'SMS service temporarily unavailable. Please try again shortly.'
      } else if (data.error?.includes('Invalid phone')) {
        errorMessage = 'Invalid phone number format. Please check and try again.'
      } else if (data.error) {
        errorMessage = data.error
      }

      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error in send-otp route:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}

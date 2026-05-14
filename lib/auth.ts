// lib/auth.ts
// Custom phone OTP authentication via Supabase Edge Function → Tiara Connect (Meliora Technologies)

import { supabase } from './supabase'

interface SendOTPResult {
  success: boolean
  error?: string
}

interface VerifyOTPResult {
  success: boolean
  session?: any
  user?: any
  error?: string
}

/**
 * Normalise a phone number to standard format (international without +)
 * Examples: 0712345678 → 254712345678, +254712345678 → 254712345678
 */
function normalisePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) {
    digits = '254' + digits.slice(1)
  }
  return digits
}

// ============================================================================
// GENERATE OTP
// ============================================================================

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ============================================================================
// SEND OTP
// ============================================================================

export async function sendPhoneOTP(
  phone: string,
  metadata?: any
): Promise<SendOTPResult> {
  try {
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // ✅ Normalize phone FIRST
    const normalisedPhone = normalisePhone(phone)

    // Check rate limit before proceeding
    const { data: withinLimit, error: rateLimitError } = await (supabase as any)
      .rpc('check_otp_rate_limit', { p_phone: normalisedPhone })

    if (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError)
      // Fail open — don't block user if rate limit check itself errors
    } else if (!withinLimit) {
      return {
        success: false,
        error: 'Too many OTP requests. Please wait an hour before trying again.',
      }
    }

    // Clear any existing OTP for this phone first
    await supabase
      .from('phone_otp_codes')
      .delete()
      .eq('phone_number', normalisedPhone)

    // Store new OTP with normalized phone
    const { error: dbError } = await supabase
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
      return { success: false, error: `Failed to generate OTP: ${dbError.message}` }
    }

    // Call Supabase Edge Function to send SMS via Tiara Connect (Meliora Technologies)
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

    const data = await response.json()

    if (!response.ok) {
      // Privacy-aware logging: mask phone number
      const phonePartial = normalisedPhone.substring(0, 6) + '***'
      console.error('Error sending SMS:', {
        status: response.status,
        error: data.error,
        phone: phonePartial,
        timestamp: new Date().toISOString(),
      })
      
      // Clean up OTP record if SMS failed
      await supabase
        .from('phone_otp_codes')
        .delete()
        .eq('phone_number', normalisedPhone)
      
      // Return more specific error messages based on response status
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
      
      return { success: false, error: errorMessage }
    }

    return { success: true }

  } catch (error) {
    console.error('Unexpected error in sendPhoneOTP:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// VERIFY OTP
// ============================================================================
export async function verifyPhoneOTP(
  phone: string,
  otp: string
): Promise<VerifyOTPResult> {
  try {
    // ✅ Normalize phone for consistency
    const normalisedPhone = normalisePhone(phone)
    
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: normalisedPhone, otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to verify OTP' };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error) {
    console.error('Unexpected error in verifyPhoneOTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// RESEND OTP
// ============================================================================

export async function resendPhoneOTP(phone: string): Promise<SendOTPResult> {
  // ✅ Normalize phone FIRST
  const normalisedPhone = normalisePhone(phone)
  
  // Delete existing OTP first — sendPhoneOTP also does this
  // but being explicit here for clarity
  await supabase
    .from('phone_otp_codes')
    .delete()
    .eq('phone_number', normalisedPhone)

  return sendPhoneOTP(phone)
}

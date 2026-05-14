// lib/auth.ts
// Custom phone OTP authentication — all OTP operations run server-side via API routes

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

// ============================================================================
// SEND OTP
// All OTP generation and storage now happens server-side (/api/auth/send-otp)
// using the SERVICE ROLE KEY. This eliminates RLS ambiguity and silent failures
// that occurred when the anon client tried to INSERT directly from the browser.
// ============================================================================

export async function sendPhoneOTP(
  phone: string,
  metadata?: any
): Promise<SendOTPResult> {
  try {
    const response = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, metadata }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to send verification code' }
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
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to verify OTP' }
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    }
  } catch (error) {
    console.error('Unexpected error in verifyPhoneOTP:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// RESEND OTP — just re-calls sendPhoneOTP (the server route handles cleanup)
// ============================================================================

export async function resendPhoneOTP(phone: string): Promise<SendOTPResult> {
  return sendPhoneOTP(phone)
}

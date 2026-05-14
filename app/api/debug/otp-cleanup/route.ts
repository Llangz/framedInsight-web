import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DEBUG ENDPOINT: Clean up stale OTP records
 * Usage: DELETE /api/debug/otp-cleanup?phone=%2B254116298433
 */
export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const phoneParam = searchParams.get('phone')

  if (!phoneParam) {
    return NextResponse.json(
      { error: 'phone parameter is required' },
      { status: 400 }
    )
  }

  try {
    const cookieStore = await cookies()
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Delete all records with this exact phone number (in any format)
    const { error: deleteError, data: deletedCount } = await supabaseAdmin
      .from('phone_otp_codes')
      .delete()
      .eq('phone_number', phoneParam)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    // Also try deleting with normalized format
    function normalisePhone(phone: string): string {
      let digits = phone.replace(/\D/g, '')
      if (digits.startsWith('0')) {
        digits = '254' + digits.slice(1)
      }
      return digits
    }

    const normalized = normalisePhone(phoneParam)
    if (normalized !== phoneParam) {
      const { error: deleteError2 } = await supabaseAdmin
        .from('phone_otp_codes')
        .delete()
        .eq('phone_number', normalized)

      if (deleteError2) {
        console.warn('Second delete failed:', deleteError2.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up OTP records for ${phoneParam} (normalized: ${normalized})`,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to clean up OTP records',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

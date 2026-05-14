import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DEBUG ENDPOINT: Check OTP records in database
 * Usage: /api/debug/otp-records?phone=%2B254116298433 (URL-encoded phone)
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const phoneParam = searchParams.get('phone')

  if (!phoneParam) {
    return NextResponse.json(
      { error: 'phone parameter is required' },
      { status: 400 }
    )
  }

  // Normalize phone like the application does
  function normalisePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '')
    if (digits.startsWith('0')) {
      digits = '254' + digits.slice(1)
    }
    return digits
  }

  const normalisedPhone = normalisePhone(phoneParam)

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

    // Query all records matching the normalized phone
    const { data: recordsNormalized, error: errorNormalized } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', normalisedPhone)

    // Also try querying with the original format (for debugging)
    const { data: recordsOriginal, error: errorOriginal } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', phoneParam)

    // Get all records with similar prefixes
    const { data: allRecords, error: allError } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('phone_number, otp_code, expires_at, created_at')
      .ilike('phone_number', `%${normalisedPhone.slice(-7)}%`)
      .limit(10)

    return NextResponse.json({
      debug: {
        phoneParam,
        normalisedPhone,
        timestamp: new Date().toISOString(),
      },
      recordsWithNormalizedPhone: {
        count: recordsNormalized?.length || 0,
        records: recordsNormalized || [],
        error: errorNormalized?.message,
      },
      recordsWithOriginalFormat: {
        count: recordsOriginal?.length || 0,
        records: recordsOriginal || [],
        error: errorOriginal?.message,
      },
      recordsWithSimilarPrefix: {
        count: allRecords?.length || 0,
        records: allRecords || [],
        error: allError?.message,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fetch OTP records',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

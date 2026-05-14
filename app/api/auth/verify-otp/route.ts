import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Normalize phone numbers to consistent Kenya format:
 * 0712345678  -> 254712345678
 * +254712345678 -> 254712345678
 * 254712345678  -> 254712345678
 */
function normalisePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) {
    digits = '254' + digits.slice(1)
  }
  if (!digits.startsWith('254')) {
    throw new Error('Invalid Kenyan phone number')
  }
  return digits
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const { phone, otp } = await req.json()

  if (!phone || !otp) {
    return NextResponse.json(
      { error: 'Phone and OTP are required' },
      { status: 400 }
    )
  }

  let normalisedPhone: string
  try {
    normalisedPhone = normalisePhone(phone)
  } catch {
    return NextResponse.json(
      { error: 'Invalid phone number format' },
      { status: 400 }
    )
  }

  const phonePartial = normalisedPhone.substring(0, 6) + '***'

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Look up the OTP record FIRST.
    //
    // BUG FIX: The original code incremented attempt count BEFORE checking the
    // OTP, which meant even a correct code consumed an attempt. After 5 tries
    // (correct or not) the trigger deleted the record, causing "Invalid OTP"
    // for legitimate users.  We now only increment on a FAILED lookup.
    // ─────────────────────────────────────────────────────────────────────────
    const { data: otpRecord } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', normalisedPhone)
      .eq('otp_code', otp)
      .single()

    if (!otpRecord) {
      // Wrong code — increment the failure counter for brute-force protection.
      const { data: attempts, error: attemptsError } = await supabaseAdmin.rpc(
        'increment_otp_attempts',
        { p_phone: normalisedPhone }
      )

      if (attemptsError) {
        console.error('Attempts increment failed:', { phone: phonePartial, error: attemptsError.message })
      } else if (attempts >= 5) {
        console.warn('Brute force protection triggered:', { phone: phonePartial })
        return NextResponse.json(
          { error: 'Too many failed attempts. Please request a new OTP.' },
          { status: 429 }
        )
      }

      console.warn('Invalid OTP attempt:', { phone: phonePartial, timestamp: new Date().toISOString() })
      return NextResponse.json(
        { error: 'Invalid OTP code. Please check and try again.' },
        { status: 401 }
      )
    }

    // Step 2: Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.warn('Expired OTP used:', { phone: phonePartial })
      await supabaseAdmin.from('phone_otp_codes').delete().eq('phone_number', normalisedPhone)
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 401 }
      )
    }

    // Step 3: Auth mapping — resolve or create Supabase user
    const metadata = otpRecord.metadata || {}
    const ghostEmail = metadata.email || `user-${normalisedPhone}@framedinsight.app`
    const randomPassword = crypto.randomBytes(32).toString('hex')

    let userId: string

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const existingUser = users.find(
      (u) => u.email === ghostEmail || u.user_metadata?.phone_number === normalisedPhone
    )

    if (existingUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password: randomPassword }
      )
      if (updateError) throw updateError
      userId = existingUser.id
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ghostEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          ...metadata,
          phone_number: normalisedPhone,
          auth_method: 'phone_otp',
        },
      })
      if (createError) throw createError
      userId = newUser.user.id
    }

    // Step 4: Create session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    )

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: ghostEmail,
      password: randomPassword,
    })

    if (signInError || !signInData.session) {
      throw signInError || new Error('Failed to create session')
    }

    // Step 5: Delete used OTP
    await supabaseAdmin.from('phone_otp_codes').delete().eq('phone_number', normalisedPhone)

    console.log('OTP verification successful:', { phone: phonePartial, userId, timestamp: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      user: { id: userId, phone: phonePartial },
      session: signInData.session,
    })

  } catch (error: any) {
    console.error('OTP Verification Error:', { phone: phonePartial, error: error.message, timestamp: new Date().toISOString() })
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    )
  }
}
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const { phone, otp } = await req.json()

  if (!phone || !otp) {
    return NextResponse.json({ error: 'Phone and OTP are required' }, { status: 400 })
  }

  // Create an admin client for sensitive operations
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
    // Step 1: Check attempts (RPC should be defined in Supabase)
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .rpc('increment_otp_attempts', { p_phone: phone })

    const phonePartial = phone.substring(0, 6) + '***'
    
    if (attemptsError) {
      console.error('Attempts increment failed:', {
        phone: phonePartial,
        error: attemptsError.message,
      })
    } else if (attempts >= 5) {
      console.warn('Brute force protection triggered:', { phone: phonePartial })
      return NextResponse.json({ error: 'Too many failed attempts. Please request a new OTP.' }, { status: 429 })
    }

    // Step 2: Look up OTP record
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', phone)
      .eq('otp_code', otp)
      .single()

    if (fetchError || !otpRecord) {
      console.warn('Invalid OTP attempt:', {
        phone: phonePartial,
        hasRecord: !!otpRecord,
        error: fetchError?.message,
      })
      return NextResponse.json({ error: 'Invalid OTP code' }, { status: 401 })
    }

    // Step 3: Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.warn('Expired OTP used:', { phone: phonePartial })
      await supabaseAdmin.from('phone_otp_codes').delete().eq('phone_number', phone)
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 401 })
    }

    // Step 4: Auth mapping (Ghost Email strategy)
    const metadata = otpRecord.metadata || {}
    const ghostEmail = metadata.email || `user-${phone.replace(/\D/g, '')}@framedinsight.app`
    const randomPassword = crypto.randomBytes(32).toString('hex')

    let userId: string

    // Use admin API to manage user
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const existingUser = users.find(u => u.email === ghostEmail || u.user_metadata?.phone_number === phone)

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
          phone_number: phone,
          auth_method: 'phone_otp',
        }
      })
      if (createError) throw createError
      userId = newUser.user.id
    }

    // Step 5: Sign in with the random password using the SSR client (to set cookies)
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

    // Step 6: Delete used OTP
    await supabaseAdmin.from('phone_otp_codes').delete().eq('phone_number', phone)

    // Log successful verification (with partial phone number)
    console.log('OTP verification successful:', {
      phone: phonePartial,
      userId,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      user: { id: userId, phone: phonePartial },
      session: signInData.session,
    })

  } catch (error: any) {
    const phonePartial = phone ? phone.substring(0, 6) + '***' : 'unknown'
    console.error('OTP Verification Error:', {
      phone: phonePartial,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}


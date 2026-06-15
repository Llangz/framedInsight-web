import { checkRateLimit } from '@/lib/security'

// The rest of imports remain
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function normalisePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '254' + digits.slice(1)
  if (!digits.startsWith('254')) throw new Error('Invalid Kenyan phone number')
  return '+' + digits
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('[verify-otp] Missing env vars')
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  // admin: raw supabase-js client with service role — for DB + auth.admin operations
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ssrClient: @supabase/ssr client with anon key — for setting browser session cookies
  const cookieStore = await cookies()
  const ssrClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { phone, otp } = body

  if (!phone || !otp) {
    return NextResponse.json({ error: 'Phone and OTP are required.' }, { status: 400 })
  }

  // Validate OTP format (must be exactly 6 digits)
  if (!/^\d{6}$/.test(String(otp).trim())) {
    return NextResponse.json(
      { error: 'Invalid OTP format. Please enter a 6-digit code.' },
      { status: 400 }
    )
  }

  let normalisedPhone: string
  try { normalisedPhone = normalisePhone(phone) }
  catch { return NextResponse.json({ error: 'Invalid phone number format.' }, { status: 400 }) }

  // ---- RATE LIMIT CHECK ----
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  
  // Per-phone limit: 10 attempts per minute
  const phoneAllowed = await checkRateLimit(`verify:phone:${normalisedPhone}`, 10, 60_000)
  // Global IP limit: 30 attempts per minute
  const ipAllowed = await checkRateLimit(`verify:ip:${ip}`, 30, 60_000)

  if (!phoneAllowed || !ipAllowed) {
    console.warn('[verify-otp] Rate limited:', normalisedPhone.slice(0, 7) + '***', 'IP:', ip)
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment before trying again.' },
      { status: 429 }
    )
  }

  const phoneTag = normalisedPhone.slice(0, 7) + '***'

  try {
    // ── 1. Fetch the OTP record ───────────────────────────────────────────────
    const { data: record, error: fetchErr } = await admin
      .from('phone_otp_codes')
      .select('*')
      .eq('phone_number', normalisedPhone)
      .single()

    if (fetchErr || !record) {
      console.warn('[verify-otp] No record found for:', phoneTag)
      return NextResponse.json(
        { error: 'No active code found for this number. Please request a new one.' },
        { status: 401 }
      )
    }

    // ── 2. Check expiry ───────────────────────────────────────────────────────
    if (new Date(record.expires_at) < new Date()) {
      await admin.from('phone_otp_codes').delete().eq('phone_number', normalisedPhone)
      return NextResponse.json(
        { error: 'Your code has expired. Please request a new one.' },
        { status: 401 }
      )
    }

    // ── 3. Validate the code (timing-safe comparison) ─────────────────────────
    const submittedOtp = String(otp).trim()
    const storedOtp = String(record.otp_code).trim()
    
    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(submittedOtp),
      Buffer.from(storedOtp)
    )

    if (!isValid) {
      // Increment failed attempts
      const { data: attempts } = await admin.rpc('increment_otp_attempts', { p_phone: normalisedPhone })
      console.warn('[verify-otp] Wrong code for:', phoneTag, '| attempts:', attempts)
      
      if (attempts && attempts >= 5) {
        // Delete the OTP record after 5 failed attempts
        await admin.from('phone_otp_codes').delete().eq('phone_number', normalisedPhone)
        return NextResponse.json(
          { error: 'Too many failed attempts. Please request a new code.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: 'Incorrect code. Please check and try again.' },
        { status: 401 }
      )
    }

    // ── OTP verified ── proceed to create/retrieve auth user ─────────────────
    const metadata = record.metadata || {}
    const ghostEmail = metadata.email
      || `user${normalisedPhone.replace(/\D/g, '')}@framedinsight.app`
    const randomPassword = crypto.randomBytes(32).toString('hex')

    // ── 4. Find or create auth user ───────────────────────────────────────────
    let userId: string

    const { data: newUserData, error: createErr } = await admin.auth.admin.createUser({
      email: ghostEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        ...metadata,
        phone_number: normalisedPhone,
        auth_method: 'phone_otp',
      },
    })

    if (createErr) {
      if (createErr.message.includes('already') || createErr.message.includes('exists')) {
        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({
          page: 1, perPage: 1000,
        })

        if (listErr) {
          console.error('[verify-otp] listUsers failed:', listErr.message)
          return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
        }

        const existing = users.find(
          (u) => u.email === ghostEmail || u.user_metadata?.phone_number === normalisedPhone
        )

        if (!existing) {
          console.error('[verify-otp] createUser said duplicate but listUsers found nothing for:', phoneTag)
          return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
        }

        const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
          password: randomPassword,
          email_confirm: true,
        })
        if (updErr) {
          console.error('[verify-otp] updateUserById failed:', updErr.message)
          return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
        }

        userId = existing.id
      } else {
        console.error('[verify-otp] createUser error:', createErr.message)
        return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
      }
    } else {
      userId = newUserData.user.id
    }

    // ── 5. Sign in to create a browser session ────────────────────────────────
    const { data: signInData, error: signInErr } = await ssrClient.auth.signInWithPassword({
      email: ghostEmail,
      password: randomPassword,
    })

    if (signInErr || !signInData.session) {
      console.error('[verify-otp] signInWithPassword failed:', signInErr?.message)
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
    }

    // ── 6. Delete the used OTP ────────────────────────────────────────────────
    await admin.from('phone_otp_codes').delete().eq('phone_number', normalisedPhone)

    // ── 7. Audit log ──────────────────────────────────────────────────────────
    try {
      await admin.from('audit_logs').insert({
        action: 'USER_VERIFIED_OTP',
        actor_id: userId,
        resource: 'auth',
        resource_id: userId,
        details: {
          method: 'phone_otp',
          phone_masked: phoneTag,
        },
        ip_address: ip,
        created_at: new Date().toISOString(),
      })
    } catch (auditErr) {
      // Non-critical: audit logging failure shouldn't break the auth flow
      console.warn('[verify-otp] Audit log failure:', auditErr)
    }

    console.log('[verify-otp] Success:', phoneTag, 'userId:', userId)

    return NextResponse.json({
      success: true,
      user: { id: userId, phone: phoneTag },
      session: signInData.session,
    })

  } catch (err: any) {
    console.error('[verify-otp] Error for:', phoneTag, '|', err.message)
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}
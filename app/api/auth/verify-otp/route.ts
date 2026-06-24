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
  const submittedOtp = String(otp).trim()
  if (!/^\d{6}$/.test(submittedOtp)) {
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
    const storedOtp = String(record.otp_code).trim()
    
    // CRITICAL FIX: timingSafeEqual requires buffers of identical length
    let isValid = false
    if (submittedOtp.length === storedOtp.length) {
      isValid = crypto.timingSafeEqual(
        Buffer.from(submittedOtp),
        Buffer.from(storedOtp)
      )
    }

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
    // Identity key is ALWAYS derived purely from the phone number
    const ghostEmail = `user${normalisedPhone.replace(/\D/g, '')}@framedinsight.app`

    // ── Ghost password derivation (Issue #10) ─────────────────────────────────
    // Previously: SHA256(ghostEmail + SERVICE_ROLE_KEY) — every user's auth
    // credential was deterministically derivable from one shared, high-value
    // secret, and could never be rotated without invalidating every account.
    //
    // Now: HMAC-SHA256 keyed by a per-phone random salt stored in
    // auth_phone_salts. New logins mint a salt up front. Existing users are
    // migrated lazily, on their next successful login, with no bulk backfill
    // job and no forced re-auth:
    //   1. Salt exists for this phone → already migrated, sign in directly.
    //   2. No salt, but the OLD scheme password still works → pre-migration
    //      user. Sign them in on the old scheme, then rotate their Supabase
    //      Auth password to the new scheme server-side and record the salt,
    //      using the session we already have (no second sign-in needed).
    //   3. Neither → genuinely new user, create on the new scheme directly.
    function deriveSaltedPassword(salt: string): string {
      return `A1!_${crypto.createHmac('sha256', salt).update(ghostEmail).digest('hex')}`
    }
    function deriveLegacyPassword(): string {
      return `A1!_${crypto.createHash('sha256').update(ghostEmail + serviceKey).digest('hex')}`
    }

    let userId: string
    let session: { access_token: string; refresh_token: string; [key: string]: any }

    const { data: saltRow } = await admin
      .from('auth_phone_salts')
      .select('salt')
      .eq('phone_number', normalisedPhone)
      .maybeSingle()

    if (saltRow?.salt) {
      // ── Case 1: already migrated — sign in on the salted scheme ──────────
      const { data: signInAttempt, error: signInErr } = await ssrClient.auth.signInWithPassword({
        email: ghostEmail,
        password: deriveSaltedPassword(saltRow.salt),
      })

      if (signInErr || !signInAttempt.session) {
        console.error('[verify-otp] Sign-in failed for already-migrated phone:', signInErr?.message)
        return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
      }
      userId = signInAttempt.user.id
      session = signInAttempt.session
    } else {
      // ── No salt on file yet — try the legacy scheme first ────────────────
      const { data: legacyAttempt, error: legacyErr } = await ssrClient.auth.signInWithPassword({
        email: ghostEmail,
        password: deriveLegacyPassword(),
      })

      if (!legacyErr && legacyAttempt.session) {
        // ── Case 2: pre-migration user — rotate them to the salted scheme ──
        const newSalt = crypto.randomUUID()
        const { error: updateErr } = await admin.auth.admin.updateUserById(legacyAttempt.user.id, {
          password: deriveSaltedPassword(newSalt),
        })

        if (updateErr) {
          // Non-fatal: this login still succeeds on the old scheme; we just
          // retry the migration on their next login instead.
          console.warn('[verify-otp] Could not rotate ghost password, will retry next login:', updateErr.message)
        } else {
          await admin.from('auth_phone_salts').upsert({
            phone_number: normalisedPhone,
            salt: newSalt,
            migrated_at: new Date().toISOString(),
          })
          console.log('[verify-otp] Migrated ghost password to salted scheme for:', phoneTag)
        }

        userId = legacyAttempt.user.id
        session = legacyAttempt.session
      } else {
        // ── Case 3: genuinely new user — create on the salted scheme ───────
        const newSalt = crypto.randomUUID()
        const newPassword = deriveSaltedPassword(newSalt)

        const { data: newUserData, error: createErr } = await admin.auth.admin.createUser({
          email: ghostEmail,
          password: newPassword,
          email_confirm: true,
          user_metadata: {
            phone_number: normalisedPhone,
            auth_method: 'phone_otp',
          },
        })

        if (createErr || !newUserData?.user) {
          console.error('[verify-otp] createUser error:', createErr?.message)
          return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
        }
        userId = newUserData.user.id

        await admin.from('auth_phone_salts').upsert({
          phone_number: normalisedPhone,
          salt: newSalt,
          migrated_at: new Date().toISOString(),
        })

        const { data: signInData, error: signInErr } = await ssrClient.auth.signInWithPassword({
          email: ghostEmail,
          password: newPassword,
        })

        if (signInErr || !signInData.session) {
          console.error('[verify-otp] signInWithPassword failed after createUser:', signInErr?.message)
          return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
        }
        session = signInData.session
      }
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
      session,
    })

  } catch (err: any) {
    console.error('[verify-otp] Error for:', phoneTag, '|', err?.message || err)
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}
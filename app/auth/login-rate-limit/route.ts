// app/api/auth/login-rate-limit/route.ts
//
// Password login (app/auth/login/page.tsx) previously called
// supabase.auth.signInWithPassword() directly from the client with no
// application-level throttling — unlike send-otp/verify-otp, which are
// both rate-limited server-side. Because the account identity is a
// deterministic, guessable "ghost email" (user<phone-digits>@framedinsight.app),
// an attacker who knows a target's phone number has a fixed, known
// username to run password guesses against. This endpoint is called as a
// pre-flight check before every password sign-in attempt.
//
// Uses the existing checkRateLimit() from lib/security.ts, which already
// supports durable storage via Vercel KV / Upstash Redis (with a graceful
// in-memory fallback for local dev) — see the KV_REST_API_URL /
// UPSTASH_REDIS_REST_URL env vars. No new infra required, just make sure
// those are set in the production environment.

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { phone } = body
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  // Tighter than OTP verify (10/min) since a password guess is a single
  // request with no SMS cost to the attacker. 8 attempts per 5 minutes
  // per phone, 20 per 5 minutes per IP (covers an attacker rotating phones
  // from one IP, or one phone number being hit from many IPs).
  const phoneAllowed = await checkRateLimit(`login:phone:${phone}`, 8, 5 * 60_000)
  const ipAllowed = await checkRateLimit(`login:ip:${ip}`, 20, 5 * 60_000)

  if (!phoneAllowed || !ipAllowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait a few minutes and try again, or use SMS OTP instead.' },
      { status: 429 }
    )
  }

  return NextResponse.json({ ok: true })
}
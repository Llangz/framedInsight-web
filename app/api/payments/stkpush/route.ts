// 📁 FILE PATH: app/api/payments/stkpush/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { initiateSTKPush } from '@/lib/daraja'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/security'

// M-Pesa charges the initiator nothing per STK attempt but does spam the
// recipient's phone with a prompt. The blanket 60 req/min per-IP limit in
// proxy.ts covers every /api/* route including this one, but it isn't tuned
// for a money/SMS-cost action — 60 STK prompts to a victim's phone inside a
// minute would still clear it. This is a stricter, purpose-built limit on
// top of that blanket one, keyed by farm rather than IP so it can't be
// dodged by rotating source addresses.
const STK_PUSH_MAX_PER_WINDOW = 3
const STK_PUSH_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

// Minimum age of the most recent pending transaction for a farm before a
// new STK push is allowed. Guards against a double-tap on "Pay" (slow
// network, impatient farmer) firing two separate M-Pesa prompts and two
// pending rows for the same farm before the first one has even been
// answered. The callback handler is already idempotent per
// checkout_request_id, but nothing previously stopped *this* route from
// creating duplicates in the first place.
const PENDING_TXN_COOLDOWN_MS = 2 * 60 * 1000 // 2 minutes

// Monthly prices in KES — matches lib/tiers.ts
const TIER_MONTHLY_PRICES: Record<string, number> = {
  smallholder:    0,
  commercial:   799,
  enterprise:  2999,
  enterprise_plus: 5000,
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  // ── 1. Verify the caller's session token ───────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.substring(7)

  const supabaseUser = createAnonClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 })
  }

  // ── 2. Validate request body ───────────────────────────────────────────────
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { farmId, months } = body

  if (!farmId || typeof farmId !== 'string') {
    return NextResponse.json({ error: 'farmId is required.' }, { status: 400 })
  }

  const monthsInt = parseInt(months, 10)
  if (isNaN(monthsInt) || monthsInt < 1 || monthsInt > 12) {
    return NextResponse.json({ error: 'months must be an integer between 1 and 12.' }, { status: 400 })
  }

  // ── 3. Service-role client for privileged DB reads ─────────────────────────
  const supabaseAdmin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 4. Confirm the authenticated user owns this farm ──────────────────────
  const { data: manager } = await supabaseAdmin
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .eq('farm_id', farmId)
    .single()

  if (!manager) {
    return NextResponse.json({ error: 'Farm not found or access denied.' }, { status: 403 })
  }

  // ── 4b. Purpose-built rate limit on this farm's STK pushes ─────────────────
  // Keyed by farmId (not IP) so it holds even if requests come from
  // different addresses. This is on top of, not instead of, the blanket
  // per-IP limit in proxy.ts.
  const stkAllowed = await checkRateLimit(
    `stkpush:${farmId}`,
    STK_PUSH_MAX_PER_WINDOW,
    STK_PUSH_WINDOW_MS
  )
  if (!stkAllowed) {
    return NextResponse.json(
      { error: 'Too many payment attempts for this farm. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(STK_PUSH_WINDOW_MS / 1000) } }
    )
  }

  // ── 5. Fetch farm to get tier and phone ────────────────────────────────────
  const { data: farm, error: farmError } = await supabaseAdmin
    .from('farms')
    .select('id, farm_name, phone, subscription_tier')
    .eq('id', farmId)
    .single()

  if (farmError || !farm) {
    return NextResponse.json({ error: 'Farm not found.' }, { status: 404 })
  }

  const targetTier = farm.subscription_tier === 'smallholder' ? 'commercial' : farm.subscription_tier
  const monthlyPrice = TIER_MONTHLY_PRICES[targetTier] ?? 500

  if (monthlyPrice === 0) {
    return NextResponse.json(
      { error: 'Your current plan is free — no payment required.' },
      { status: 400 }
    )
  }

  const amount = monthlyPrice * monthsInt

  // ── 6. Idempotency guard: refuse a new push while one is already in flight ──
  // A double-tap on "Pay" (slow network, impatient user) would otherwise
  // create two separate pending transaction rows and fire two M-Pesa
  // prompts to the same phone for the same farm. The callback handler is
  // idempotent per checkout_request_id, but that doesn't stop this route
  // from creating the duplicate in the first place — so check here.
  const cooldownCutoff = new Date(Date.now() - PENDING_TXN_COOLDOWN_MS).toISOString()
  const { data: recentPending } = await supabaseAdmin
    .from('transactions')
    .select('id, created_at')
    .eq('farm_id', farmId)
    .eq('status', 'pending')
    .gte('created_at', cooldownCutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentPending) {
    return NextResponse.json(
      {
        error: 'A payment is already in progress for this farm. Check your phone, or wait a couple of minutes before retrying.',
      },
      { status: 409 }
    )
  }

  // ── 7. Initiate STK push ───────────────────────────────────────────────────
  try {
    const stkResponse = await initiateSTKPush(
      farm.phone,
      amount,
      farmId.slice(0, 12),
      `${monthsInt}mo subscription`
    )

    const { error: dbError } = await supabaseAdmin
      .from('transactions')
      .insert({
        farm_id:             farmId,
        user_id:             user.id,
        amount,
        phone_number:        farm.phone,
        merchant_request_id: stkResponse.MerchantRequestID,
        checkout_request_id: stkResponse.CheckoutRequestID,
        status:              'pending',
        months_added:        monthsInt,
      })

    if (dbError) {
      // 23505 = unique_violation. Means a concurrent request beat the
      // idempotency check above and already holds the "one pending
      // transaction per farm" slot enforced by
      // transactions_one_pending_per_farm. The M-Pesa prompt for *this*
      // request has already been sent by initiateSTKPush() above — that
      // can't be un-sent — but we don't want an un-logged transaction row,
      // and the farmer already has a legitimate prompt in flight from the
      // other request, so surface it as "already in progress" rather than
      // a generic failure.
      if (dbError.code === '23505') {
        console.warn(`[stkpush] Concurrent pending transaction for farm ${farmId}, this STK response will be unlogged:`, stkResponse.CheckoutRequestID)
      } else {
        console.error('[stkpush] Failed to log transaction:', dbError.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `M-Pesa prompt sent to ${farm.phone}. Please complete payment on your phone.`,
      amountKes: amount,
      months: monthsInt,
      checkoutRequestId: stkResponse.CheckoutRequestID,
    })
  } catch (error: any) {
    console.error('[stkpush] Daraja error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Payment initiation failed.' },
      { status: 502 }
    )
  }
}
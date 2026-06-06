import { NextRequest, NextResponse } from 'next/server'
import { initiateSTKPush } from '@/lib/daraja'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Monthly prices in KES — matches lib/tiers.ts
const TIER_MONTHLY_PRICES: Record<string, number> = {
  smallholder:    0,
  commercial:   500,
  enterprise:  2500,
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

  // Use anon client with the user's JWT so auth.getUser() validates it properly
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

  // ── 5. Fetch farm to get tier and phone — never trust client-supplied amount
  const { data: farm, error: farmError } = await supabaseAdmin
    .from('farms')
    .select('id, farm_name, phone, subscription_tier')
    .eq('id', farmId)
    .single()

  if (farmError || !farm) {
    return NextResponse.json({ error: 'Farm not found.' }, { status: 404 })
  }

  // If they are on smallholder, they are upgrading to commercial
  const targetTier = farm.subscription_tier === 'smallholder' ? 'commercial' : farm.subscription_tier
  const monthlyPrice = TIER_MONTHLY_PRICES[targetTier] ?? 500

  if (monthlyPrice === 0) {
    return NextResponse.json(
      { error: 'Your current plan is free — no payment required.' },
      { status: 400 }
    )
  }

  // Server-side amount — client has no say in this value
  const amount = monthlyPrice * monthsInt

  // ── 6. Initiate STK push ───────────────────────────────────────────────────
  try {
    const stkResponse = await initiateSTKPush(
      farm.phone,
      amount,
      farmId.slice(0, 12),                      // AccountReference max 12 chars
      `${monthsInt}mo subscription`             // TransactionDesc max 13 chars
    )

    // ── 7. Log pending transaction ─────────────────────────────────────────
    const { error: dbError } = await supabaseAdmin
      .from('transactions')
      .insert({
        farm_id:             farmId,
        user_id:             user.id,            // from verified session, not body
        amount,
        phone_number:        farm.phone,          // from DB, not body
        merchant_request_id: stkResponse.MerchantRequestID,
        checkout_request_id: stkResponse.CheckoutRequestID,
        status:              'pending',
        months_added:        monthsInt,
      })

    if (dbError) {
      // STK push already sent — log but don't fail the response
      console.error('[stkpush] Failed to log transaction:', dbError.message)
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
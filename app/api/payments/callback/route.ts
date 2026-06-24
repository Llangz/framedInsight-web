// ============================================================================
// M-Pesa Daraja STK Callback — framedInsight
// POST /api/payments/callback
//
// Safaricom calls this URL after the farmer completes (or cancels) the M-Pesa
// prompt.  We MUST return HTTP 200 quickly; Safaricom retries on any other
// status and will hammer the endpoint.
//
// Security: Safaricom does not sign callbacks, so we validate by matching
// CheckoutRequestID against a pending row we inserted at STK push time.
// The service-role key is only used server-side and never exposed to clients.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Always acknowledge to Safaricom — never return non-200
const ACK = () => NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })

// ── Safaricom IP origin check (defense-in-depth) ─────────────────────────
// These ranges are the commonly-cited Safaricom Daraja callback ranges, but
// Safaricom does not publish them as a guaranteed, versioned allowlist the
// way Meta/AWS do for their own services — they can change without notice.
// Given that, this is intentionally a SOFT check: we log a warning and flag
// the transaction when the origin doesn't match, but we still process it.
// The real security boundary here is unchanged and remains the existing
// idempotency check below (matching CheckoutRequestID against a row we
// ourselves inserted at STK push time, and skipping anything not 'pending').
// An attacker spoofing this IP range still can't forge a payment without
// also guessing a live, unconsumed CheckoutRequestID.
// If you'd rather hard-block, flip RETURN_403_ON_MISMATCH to true below —
// just be aware that does risk silently dropping genuine Safaricom callbacks
// if their egress ranges ever shift.
const SAFARICOM_CIDRS = ['196.201.214.0/24', '196.201.213.0/24', '127.0.0.1/32']
const RETURN_403_ON_MISMATCH = false

function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    n = (n << 8) + octet
  }
  return n >>> 0
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  const bits = parseInt(bitsStr, 10)
  const ipInt = ipToInt(ip)
  const rangeInt = ipToInt(range)
  if (ipInt === null || rangeInt === null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
}

function isSafaricomIp(ip: string): boolean {
  return SAFARICOM_CIDRS.some(cidr => isIpInCidr(ip, cidr))
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service config missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  if (!isSafaricomIp(ip)) {
    console.warn(`[mpesa-callback] Origin IP ${ip} is outside the known Safaricom ranges — processing anyway (soft check), but flagging for review`)
    if (RETURN_403_ON_MISMATCH) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Forbidden' }, { status: 403 })
    }
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    // Malformed JSON — still ACK so Safaricom doesn't retry
    console.error('[mpesa-callback] Could not parse body')
    return ACK()
  }

  // ── 1. Extract the callback envelope ────────────────────────────────────
  const callback = body?.Body?.stkCallback
  if (!callback) {
    console.error('[mpesa-callback] Missing stkCallback in body:', JSON.stringify(body))
    return ACK()
  }

  const {
    CheckoutRequestID,
    MerchantRequestID,
    ResultCode,
    ResultDesc,
    CallbackMetadata,
  } = callback

  const success = ResultCode === 0
  const maskedId = CheckoutRequestID?.slice(-8) ?? 'unknown'
  console.log(`[mpesa-callback] ${maskedId} ResultCode=${ResultCode} "${ResultDesc}"`)

  const supabase = adminClient()

  // ── 2. Look up the pending transaction ──────────────────────────────────
  const { data: txn, error: txnErr } = await supabase
    .from('transactions')
    .select('id, farm_id, user_id, months_added, amount, status')
    .eq('checkout_request_id', CheckoutRequestID)
    .single()

  if (txnErr || !txn) {
    console.error(`[mpesa-callback] No transaction for CheckoutRequestID ${maskedId}:`, txnErr?.message)
    return ACK()
  }

  // ── 3. Guard against duplicate callbacks (Safaricom retries) ────────────
  if (txn.status !== 'pending') {
    console.log(`[mpesa-callback] Already processed (status=${txn.status}), skipping`)
    return ACK()
  }

  // ── 4a. Payment FAILED or CANCELLED ─────────────────────────────────────
  if (!success) {
    await supabase
      .from('transactions')
      .update({ status: 'failed', result_desc: ResultDesc, updated_at: new Date().toISOString() })
      .eq('id', txn.id)

    console.log(`[mpesa-callback] Payment failed for farm ${txn.farm_id}: ${ResultDesc}`)
    return ACK()
  }

  // ── 4b. Payment SUCCESSFUL ───────────────────────────────────────────────
  // Extract the M-Pesa receipt number from metadata items
  const items: { Name: string; Value: any }[] = CallbackMetadata?.Item ?? []
  const get = (name: string) => items.find(i => i.Name === name)?.Value ?? null
  const receiptNumber = get('MpesaReceiptNumber')
  const paidAmount    = get('Amount')
  const paidPhone     = get('PhoneNumber')

  console.log(`[mpesa-callback] ✅ Payment confirmed. Receipt=${receiptNumber} Amount=${paidAmount} Phone=${String(paidPhone).slice(0, 6)}***`)

  // ── 5. Determine the correct tier from the amount paid ──────────────────
  // Compare paid amount to monthly prices to infer tier.
  // months_added was stored at STK push time — use that to derive monthly rate.
  const monthlyRate = Math.round(txn.amount / txn.months_added)
  const newTier = inferTierFromMonthlyRate(monthlyRate)

  // ── 6. Update transaction to completed ──────────────────────────────────
  const { error: txnUpdateErr } = await supabase
    .from('transactions')
    .update({
      status:               'completed',
      mpesa_receipt_number: receiptNumber,
      result_desc:          ResultDesc,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', txn.id)

  if (txnUpdateErr) {
    console.error('[mpesa-callback] Failed to update transaction:', txnUpdateErr.message)
    // Don't return — still try to activate the subscription
  }

  // ── 7. Fetch current farm subscription state ─────────────────────────────
  const { data: farm, error: farmErr } = await supabase
    .from('farms')
    .select('id, subscription_tier, subscription_end_date')
    .eq('id', txn.farm_id)
    .single()

  if (farmErr || !farm) {
    console.error('[mpesa-callback] Farm not found:', txn.farm_id)
    return ACK()
  }

  // ── 8. Calculate new subscription end date (stacking logic) ─────────────
  const now = new Date()
  const currentEnd = farm.subscription_end_date
    ? new Date(farm.subscription_end_date)
    : null

  // If current subscription is still active, stack on top of it.
  // Otherwise start from today.
  const startFrom = currentEnd && currentEnd > now ? currentEnd : now
  const newEndDate = new Date(startFrom)
  newEndDate.setMonth(newEndDate.getMonth() + txn.months_added)

  // ── 9. Activate / extend the subscription ───────────────────────────────
  const { error: farmUpdateErr } = await supabase
    .from('farms')
    .update({
      subscription_tier:       newTier,
      subscription_end_date:   newEndDate.toISOString(),
      subscription_start_date: now.toISOString(),
      is_active:               true,
      updated_at:              now.toISOString(),
    })
    .eq('id', txn.farm_id)

  if (farmUpdateErr) {
    console.error('[mpesa-callback] CRITICAL: Failed to activate subscription:', farmUpdateErr.message)
    // TODO: Add to a dead-letter queue / alert — farmer paid but sub not activated
  } else {
    console.log(
      `[mpesa-callback] ✅ Subscription activated: farm=${txn.farm_id} tier=${newTier} ` +
      `months=${txn.months_added} end=${newEndDate.toISOString().split('T')[0]}`
    )
  }

  return ACK()
}

// ── Helper: derive tier from monthly KES rate ────────────────────────────────
// Valid DB tiers: 'smallholder' | 'commercial' | 'enterprise'
// enterprise_plus is handled via manual sales flow, not M-Pesa self-serve
function inferTierFromMonthlyRate(monthlyKes: number): string {
  if (monthlyKes >= 2000) return 'enterprise'
  if (monthlyKes >= 400)  return 'commercial'
  return 'smallholder'
}
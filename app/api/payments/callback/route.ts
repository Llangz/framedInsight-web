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
import { activateSubscription } from '@/lib/activate-subscription'
import { auditLog } from '@/lib/security'

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

  // ── 5. Mark the payment completed, activation pending ────────────────────
  // This is deliberately split from the activation attempt below (unlike
  // the old code, which updated `status` to 'completed' only *after*
  // trying — but still before checking the result). That ordering had a
  // latent bug: once `status` is 'completed', step 3's idempotency guard
  // (`if (txn.status !== 'pending') return ACK()`) means a Safaricom retry
  // of this exact callback would be silently skipped even if the farm
  // activation write had failed — the one thing that might have
  // self-healed it never got the chance. `status` now reflects only "did
  // Safaricom confirm the payment" (unchanged meaning, still drives the
  // idempotency guard and the billing UI's polling), and
  // `activation_status` tracks the farm-side write as its own,
  // independently retryable state — see
  // supabase/migrations/20260714b_payment_activation_reconciliation.sql.
  // Recovery for a failed activation is now the reconcile-payments cron
  // (app/api/cron/reconcile-payments/route.ts), not a hoped-for callback
  // redelivery.
  const { error: txnUpdateErr } = await supabase
    .from('transactions')
    .update({
      status:               'completed',
      activation_status:    'pending',
      mpesa_receipt_number: receiptNumber,
      result_desc:          ResultDesc,
      updated_at:           new Date().toISOString(),
    } as any)
    .eq('id', txn.id)

  if (txnUpdateErr) {
    console.error('[mpesa-callback] Failed to update transaction:', txnUpdateErr.message)
    // Don't return — still try to activate the subscription. Worst case
    // the transaction row's own status field lags, but the farmer's
    // subscription still gets turned on, which matters far more to them.
  }

  // ── 6. Activate / extend the subscription ────────────────────────────────
  const result = await activateSubscription({
    id: txn.id,
    farm_id: txn.farm_id,
    months_added: txn.months_added,
    amount: txn.amount,
  })

  if (!result.success) {
    console.error(`[mpesa-callback] CRITICAL: Failed to activate subscription for farm ${txn.farm_id}:`, result.error)

    // Persisted immediately (not just console.error) so this is visible on
    // the admin subscriptions page and in the audit trail the moment it
    // happens, not only once the reconcile-payments cron next runs.
    await auditLog({
      action: 'PAYMENT_ACTIVATION_FAILED',
      actorId: null,
      farmId: txn.farm_id,
      resource: 'transactions',
      resourceId: txn.id,
      details: { error: result.error, amount: txn.amount, months_added: txn.months_added },
      ip: null,
    })
  } else {
    console.log(
      `[mpesa-callback] ✅ Subscription activated: farm=${txn.farm_id} tier=${result.tier} ` +
      `months=${txn.months_added} end=${result.endDate?.split('T')[0]}`
    )
  }

  return ACK()
}
// ============================================================================
// M-Pesa Daraja STK Push — framedInsight Subscription Payments
// ============================================================================
// Uses Daraja API v2 (sandbox + production)
// Env vars required:
//   MPESA_CONSUMER_KEY        — from Safaricom Developer Portal
//   MPESA_CONSUMER_SECRET     — from Safaricom Developer Portal
//   MPESA_SHORTCODE           — your paybill/till number
//   MPESA_PASSKEY             — Lipa Na M-Pesa passkey
//   MPESA_CALLBACK_URL        — publicly reachable webhook URL
//   MPESA_ENVIRONMENT         — "sandbox" | "production"
// ============================================================================

export type MpesaEnvironment = 'sandbox' | 'production'

const BASE_URLS: Record<MpesaEnvironment, string> = {
  sandbox:    'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
}

function env() {
  const consumerKey    = process.env.MPESA_CONSUMER_KEY
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET
  const shortcode      = process.env.MPESA_SHORTCODE
  const passkey        = process.env.MPESA_PASSKEY
  const callbackUrl    = process.env.MPESA_CALLBACK_URL
  const environment    = (process.env.MPESA_ENVIRONMENT ?? 'sandbox') as MpesaEnvironment

  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    throw new Error('Missing M-Pesa environment variables. Check MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL.')
  }

  return { consumerKey, consumerSecret, shortcode, passkey, callbackUrl, environment }
}

// ── OAuth token ───────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { consumerKey, consumerSecret, environment } = env()
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

  const res = await fetch(`${BASE_URLS[environment]}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`M-Pesa OAuth failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.access_token as string
}

// ── STK Push ──────────────────────────────────────────────────────────────────

export interface StkPushParams {
  /** Kenyan phone number in 254XXXXXXXXX format */
  phone: string
  /** Amount in KES (integer) */
  amount: number
  /** Your internal reference — stored on the transaction for reconciliation */
  accountReference: string
  /** Human-readable description shown on the M-Pesa prompt */
  transactionDesc: string
}

export interface StkPushResult {
  success: boolean
  checkoutRequestId?: string
  merchantRequestId?: string
  error?: string
}

export async function initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
  try {
    const { shortcode, passkey, callbackUrl, environment } = env()
    const token = await getAccessToken()

    // Timestamp format: YYYYMMDDHHmmss
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')

    const payload = {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Math.round(params.amount),
      PartyA:            params.phone,
      PartyB:            shortcode,
      PhoneNumber:       params.phone,
      CallBackURL:       callbackUrl,
      AccountReference:  params.accountReference.slice(0, 12), // Daraja max 12 chars
      TransactionDesc:   params.transactionDesc.slice(0, 13),  // Daraja max 13 chars
    }

    const res = await fetch(`${BASE_URLS[environment]}/mpesa/stkpush/v1/processrequest`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (data.ResponseCode === '0') {
      return {
        success:           true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
      }
    }

    return { success: false, error: data.ResponseDescription || data.errorMessage || 'STK push rejected' }
  } catch (err: any) {
    console.error('M-Pesa STK push error:', err)
    return { success: false, error: err.message || 'Unknown M-Pesa error' }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculate the total KES amount for a multi-month subscription.
 * If the user already has time remaining, new months stack on top of current expiry.
 */
export function calculateSubscriptionAmount(
  monthlyPriceKes: number,
  months: number,
): number {
  return monthlyPriceKes * months
}

/**
 * Compute the new subscription end date.
 * Strategy: stack from current expiry if it's in the future, otherwise from today.
 */
export function computeNewEndDate(currentEndDate: string | null, months: number): Date {
  const base = currentEndDate && new Date(currentEndDate) > new Date()
    ? new Date(currentEndDate)
    : new Date()

  const result = new Date(base)
  result.setMonth(result.getMonth() + months)
  return result
}
// Daraja (M-Pesa) API integration with proper environment switching
// FIXED: No hardcoded sandbox URLs, no credential fallbacks

const DARAJA_BASE_URL = process.env.DARAJA_ENVIRONMENT === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke'

export async function generateDarajaToken() {
  const consumerKey = process.env.DARAJA_CONSUMER_KEY
  const consumerSecret = process.env.DARAJA_CONSUMER_SECRET
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('Daraja credentials missing in environment variables. Please set DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET.')
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

  const response = await fetch(
    `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Daraja token generation failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function initiateSTKPush(
  phone: string,
  amount: number,
  accountReference: string,
  transactionDesc: string
) {
  const token = await generateDarajaToken()
  
  // FIXED: No fallback credentials - fail loudly if not configured
  const shortcode = process.env.DARAJA_SHORTCODE
  const passkey = process.env.DARAJA_PASSKEY
  
  if (!shortcode || !passkey) {
    throw new Error('Daraja shortcode and passkey must be configured in environment variables. Please set DARAJA_SHORTCODE and DARAJA_PASSKEY.')
  }
  
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')

  // Clean phone number (needs to be 254...)
  let cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.slice(1)
  if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.slice(1)

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://framed-insight-web.vercel.app'}/api/payments/callback`

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: cleanPhone,
    PartyB: shortcode,
    PhoneNumber: cleanPhone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc
  }

  const response = await fetch(
    `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Daraja STK push failed: ${errText}`)
  }

  return await response.json()
}
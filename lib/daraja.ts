export async function generateDarajaToken() {
  const consumerKey = process.env.DARAJA_CONSUMER_KEY
  const consumerSecret = process.env.DARAJA_CONSUMER_SECRET
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('Daraja credentials missing in environment')
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`
    }
  })

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
  
  const shortcode = process.env.DARAJA_SHORTCODE || '174379'
  const passkey = process.env.DARAJA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
  
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

  const response = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Daraja STK push failed: ${errText}`)
  }

  return await response.json()
}

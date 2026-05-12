import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Tiara Connect (Meliora Technologies) credentials
const TIARA_API_KEY = Deno.env.get('TIARA_API_KEY')!
const TIARA_SENDER_ID = Deno.env.get('TIARA_SENDER_ID') || 'CONNECT'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Normalise a phone number to Tiara Connect's expected format:
 * international digits only, no leading '+' (e.g. 254712345678)
 */
function normalisePhone(phone: string): string {
  // Strip everything except digits
  let digits = phone.replace(/\D/g, '')
  // If it starts with a leading '0', replace with Kenya country code
  if (digits.startsWith('0')) {
    digits = '254' + digits.slice(1)
  }
  return digits
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: 'Phone and OTP are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        }
      )
    }

    const normalisedPhone = normalisePhone(phone)
    const refId = crypto.randomUUID()
    const message = `Your framedInsight verification code is: ${otp}. Valid for 15 minutes. Do not share this code.`

    // Send SMS via Tiara Connect (Meliora Technologies)
    const smsResponse = await fetch('https://api.tiaraconnect.io/api/messaging/sendbatch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TIARA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          from: TIARA_SENDER_ID,
          to: normalisedPhone,
          message,
          refId,
        },
      ]),
    })

    const smsData = await smsResponse.json()
    console.log('Tiara Connect response:', JSON.stringify(smsData))

    if (!smsResponse.ok) {
      throw new Error(`Tiara Connect API error (${smsResponse.status}): ${JSON.stringify(smsData)}`)
    }

    // Tiara returns an array of results — check the first item
    const result = Array.isArray(smsData) ? smsData[0] : smsData
    const messageId = result?.messageId || result?.id || refId

    return new Response(
      JSON.stringify({ success: true, messageId }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    )
  } catch (error: any) {
    console.error('SMS sending error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send SMS' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    )
  }
})

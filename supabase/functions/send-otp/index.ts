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

/**
 * Send SMS via Tiara Connect with retry logic and comprehensive error handling
 */
async function sendSmsWithRetry(
  normalisedPhone: string,
  message: string,
  refId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const smsResponse = await fetch('https://api2.tiaraconnect.io/api/messaging/sendsms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TIARA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: TIARA_SENDER_ID,
          to: normalisedPhone,
          message,
          refId,
        }),
      })

      const smsData = await smsResponse.json()

      // Log attempt (privacy-aware: only log partial phone number)
      const phonePartial = normalisedPhone.substring(0, 6) + '***'
      console.log(`[SMS Attempt ${attempt}/${maxRetries}]`, {
        phone: phonePartial,
        statusCode: smsResponse.status,
        tiaraStatus: smsData.status || smsData.statusCode,
        msgId: smsData.msgId,
        timestamp: new Date().toISOString(),
      })

      // Check for API-level errors
      if (!smsResponse.ok) {
        lastError = new Error(
          `Tiara API Error ${smsResponse.status}: ${smsData.desc || smsData.error || 'Unknown error'}`
        )
        
        // Don't retry on 4xx client errors (except rate limit)
        if (smsResponse.status >= 400 && smsResponse.status < 500 && smsResponse.status !== 429) {
          throw lastError
        }

        // Wait before retry (exponential backoff: 1s, 2s, 4s)
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt - 1)
          console.log(`Retrying in ${delayMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
        throw lastError
      }

      // Check Tiara response status (statusCode: 0 = SUCCESS, otherwise check status field)
      const isSuccess = smsData.statusCode === '0' || smsData.statusCode === 0 || smsData.status === 'SUCCESS'
      if (!isSuccess) {
        lastError = new Error(
          `Tiara indicates failure: ${smsData.desc || smsData.status} (statusCode: ${smsData.statusCode})`
        )
        
        // Don't retry on validation errors
        if (smsData.statusCode === '1001' || smsData.statusCode === 1001) {
          throw lastError
        }

        // Retry on other failures
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
        throw lastError
      }

      // Success! Extract messageId from Tiara response
      const messageId = smsData.msgId || smsData.id || refId
      console.log(`SMS sent successfully (attempt ${attempt}):`, {
        phone: phonePartial,
        msgId: messageId,
        balance: smsData.balance,
        cost: smsData.cost,
      })

      return { success: true, messageId }

    } catch (error: any) {
      lastError = error
      console.error(`SMS attempt ${attempt} failed:`, {
        phone: normalisedPhone.substring(0, 6) + '***',
        attempt,
        maxRetries,
        error: error.message,
      })

      if (attempt === maxRetries) {
        break // Stop retrying after max attempts
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Failed to send SMS after multiple attempts',
  }
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
    if (!normalisedPhone || normalisedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        }
      )
    }

    const refId = crypto.randomUUID()
    const message = `Your framedInsight verification code is: ${otp}. Valid for 15 minutes. Do not share this code.`

    // Send SMS via Tiara Connect with retry logic
    const result = await sendSmsWithRetry(normalisedPhone, message, refId)

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to send SMS' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    )
  } catch (error: any) {
    console.error('Unexpected error in send-otp function:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })
    return new Response(
      JSON.stringify({ error: 'SMS service temporarily unavailable. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    )
  }
})

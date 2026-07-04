import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// SMS provider credentials. The app now attempts a configured fallback provider
// if the primary provider fails, which improves OTP delivery resilience.
const TIARA_API_KEY = Deno.env.get('TIARA_API_KEY')
const TIARA_SENDER_ID = Deno.env.get('TIARA_SENDER_ID') || 'CONNECT'
const AFRICAS_TALKING_USERNAME = Deno.env.get('AFRICAS_TALKING_USERNAME')
const AFRICAS_TALKING_API_KEY = Deno.env.get('AFRICAS_TALKING_API_KEY')
const AFRICAS_TALKING_SENDER_ID = Deno.env.get('AFRICAS_TALKING_SENDER_ID') || 'framedInsight'

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
 * Send SMS via Tiara Connect with retry logic and comprehensive error handling.
 */
async function sendSmsViaTiara(
  normalisedPhone: string,
  message: string,
  refId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!TIARA_API_KEY) {
    return { success: false, error: 'Tiara provider not configured' }
  }

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
      const phonePartial = normalisedPhone.substring(0, 6) + '***'
      console.log(`[Tiara SMS Attempt ${attempt}/${maxRetries}]`, {
        phone: phonePartial,
        statusCode: smsResponse.status,
        tiaraStatus: smsData.status || smsData.statusCode,
        msgId: smsData.msgId,
        timestamp: new Date().toISOString(),
      })

      if (!smsResponse.ok) {
        lastError = new Error(
          `Tiara API Error ${smsResponse.status}: ${smsData.desc || smsData.error || 'Unknown error'}`
        )
        if (smsResponse.status >= 400 && smsResponse.status < 500 && smsResponse.status !== 429) {
          throw lastError
        }
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt - 1)
          console.log(`Retrying Tiara SMS in ${delayMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
        throw lastError
      }

      const isSuccess = smsData.statusCode === '0' || smsData.statusCode === 0 || smsData.status === 'SUCCESS'
      if (!isSuccess) {
        lastError = new Error(
          `Tiara indicates failure: ${smsData.desc || smsData.status} (statusCode: ${smsData.statusCode})`
        )
        if (smsData.statusCode === '1001' || smsData.statusCode === 1001) {
          throw lastError
        }
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
        throw lastError
      }

      const messageId = smsData.msgId || smsData.id || refId
      console.log(`Tiara SMS sent successfully (attempt ${attempt}):`, {
        phone: phonePartial,
        msgId: messageId,
        balance: smsData.balance,
        cost: smsData.cost,
      })

      return { success: true, messageId }
    } catch (error: any) {
      lastError = error
      console.error(`Tiara SMS attempt ${attempt} failed:`, {
        phone: normalisedPhone.substring(0, 6) + '***',
        attempt,
        maxRetries,
        error: error.message,
      })
      if (attempt === maxRetries) {
        break
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Tiara SMS delivery failed after multiple attempts',
  }
}

/**
 * Send SMS via Africa's Talking as a fallback provider when the primary route fails.
 */
async function sendSmsViaAfricaTalking(
  normalisedPhone: string,
  message: string,
  refId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!AFRICAS_TALKING_USERNAME || !AFRICAS_TALKING_API_KEY) {
    return { success: false, error: 'Africa\'s Talking provider not configured' }
  }

  try {
    const authHeader = `Basic ${btoa(`${AFRICAS_TALKING_USERNAME}:${AFRICAS_TALKING_API_KEY}`)}`
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: AFRICAS_TALKING_USERNAME,
        to: [normalisedPhone],
        message,
        from: AFRICAS_TALKING_SENDER_ID,
        bulkSMSMode: false,
      }),
    })

    const smsData = await response.json().catch(() => ({}))
    const phonePartial = normalisedPhone.substring(0, 6) + '***'
    console.log('[Africa\'s Talking SMS]', {
      phone: phonePartial,
      statusCode: response.status,
      payload: smsData,
    })

    const recipient = smsData.SMSMessageData?.Recipients?.[0]
    const isSuccess = response.ok && recipient?.status === 'Success'

    if (!isSuccess) {
      return {
        success: false,
        error: recipient?.status || smsData?.errorMessage || 'Africa\'s Talking rejected the request',
      }
    }

    return { success: true, messageId: recipient?.messageId || refId }
  } catch (error: any) {
    console.error('Africa\'s Talking SMS failed:', error)
    return { success: false, error: error?.message || 'Africa\'s Talking SMS delivery failed' }
  }
}

async function sendSmsWithFallback(
  normalisedPhone: string,
  message: string,
  refId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const providers = [] as Array<{ name: string; runner: () => Promise<{ success: boolean; messageId?: string; error?: string }> }>

  if (TIARA_API_KEY) {
    providers.push({ name: 'tiara', runner: () => sendSmsViaTiara(normalisedPhone, message, refId, maxRetries) })
  }

  if (AFRICAS_TALKING_USERNAME && AFRICAS_TALKING_API_KEY) {
    providers.push({ name: 'africastalking', runner: () => sendSmsViaAfricaTalking(normalisedPhone, message, refId) })
  }

  if (providers.length === 0) {
    return { success: false, error: 'No SMS provider is configured. Please contact support.' }
  }

  let lastError: string | undefined
  for (const provider of providers) {
    const result = await provider.runner()
    if (result.success) {
      return result
    }
    lastError = result.error
    console.warn(`[OTP] ${provider.name} failed:`, result.error)
  }

  return {
    success: false,
    error: lastError || 'All configured SMS providers failed to deliver the verification code',
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

    // Send SMS via the configured providers, with fallback to a second provider
    // if the first route fails or appears to be blocked for that number/network.
    const result = await sendSmsWithFallback(normalisedPhone, message, refId)

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

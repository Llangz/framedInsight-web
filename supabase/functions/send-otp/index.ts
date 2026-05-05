import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const AFRICAS_TALKING_API_KEY = Deno.env.get('AFRICAS_TALKING_API_KEY')!
const AFRICAS_TALKING_USERNAME = Deno.env.get('AFRICAS_TALKING_USERNAME')!

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: 'Phone and OTP are required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
        }
      )
    }

    // Send SMS via AfricasTalking
    const smsResponse = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': AFRICAS_TALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: AFRICAS_TALKING_USERNAME,
        to: phone,
        message: `Your framedInsight verification code is: ${otp}. Valid for 15 minutes. Do not share this code.`,
        from: Deno.env.get('AFRICAS_TALKING_SENDER_ID') || ''
      })
    })

    const smsData = await smsResponse.json()
    
    // Check if at least one recipient was successful
    const recipient = smsData.SMSMessageData.Recipients[0]
    if (recipient.status !== 'Success' && recipient.status !== 'Pending') {
      throw new Error(`SMS failed: ${recipient.status} (${recipient.statusCode})`)
    }

    return new Response(
      JSON.stringify({ success: true, messageId: recipient.messageId }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      }
    )
  } catch (error: any) {
    console.error('SMS sending error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send SMS' }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      }
    )
  }
})

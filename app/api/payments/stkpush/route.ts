import { NextRequest, NextResponse } from 'next/server'
import { initiateSTKPush } from '@/lib/daraja'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    const body = await req.json()
    const { phone, amount, farmId, userId, months } = body

    if (!phone || !amount || !farmId || !userId || !months) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Call Daraja API
    const stkResponse = await initiateSTKPush(
      phone,
      amount,
      'framedInsight',
      `Subscription for ${months} months`
    )

    // Store pending transaction
    const { error: dbError } = await supabaseAdmin
      .from('transactions')
      .insert({
        farm_id: farmId,
        user_id: userId,
        amount: amount,
        phone_number: phone,
        merchant_request_id: stkResponse.MerchantRequestID,
        checkout_request_id: stkResponse.CheckoutRequestID,
        status: 'pending',
        months_added: months
      })

    if (dbError) {
      console.error('Failed to log transaction:', dbError)
      // Continue anyway as STK push was sent
    }

    return NextResponse.json({ success: true, message: 'STK push sent', data: stkResponse })
  } catch (error: any) {
    console.error('STK Push Error:', error)
    return NextResponse.json({ error: error.message || 'Payment initiation failed' }, { status: 500 })
  }
}

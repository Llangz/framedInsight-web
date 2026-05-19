import { NextRequest, NextResponse } from 'next/server'
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
    console.log('M-Pesa Callback received:', JSON.stringify(body, null, 2))

    if (!body.Body || !body.Body.stkCallback) {
      return NextResponse.json({ success: true }) // Acknowledge to Safaricom anyway
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body.Body.stkCallback

    // 1. Find transaction
    const { data: transaction, error: fetchErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('checkout_request_id', CheckoutRequestID)
      .single()

    if (fetchErr || !transaction) {
      console.error('Transaction not found for checkout ID:', CheckoutRequestID)
      return NextResponse.json({ success: true })
    }

    if (ResultCode === 0 && CallbackMetadata) {
      // Payment Successful
      const receiptItem = CallbackMetadata.Item.find((item: any) => item.Name === 'MpesaReceiptNumber')
      const receiptNumber = receiptItem ? receiptItem.Value : null

      // Update transaction status
      await supabaseAdmin
        .from('transactions')
        .update({
          status: 'completed',
          mpesa_receipt_number: receiptNumber,
          result_desc: ResultDesc,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id)

      // Get current farm to check expiry
      const { data: farm } = await supabaseAdmin
        .from('farms')
        .select('subscription_end_date')
        .eq('id', transaction.farm_id)
        .single()

      if (farm) {
        let currentEnd = new Date(farm.subscription_end_date)
        const now = new Date()

        // Subscription stacking logic: 
        // If current end date is in the future, add to it. Otherwise, add to today.
        if (currentEnd < now) {
          currentEnd = now
        }

        const newEndDate = new Date(currentEnd)
        newEndDate.setMonth(newEndDate.getMonth() + transaction.months_added)

        // Update farm subscription
        await supabaseAdmin
          .from('farms')
          .update({
            subscription_end_date: newEndDate.toISOString(),
            is_active: true
          })
          .eq('id', transaction.farm_id)
      }
    } else {
      // Payment Failed or Cancelled
      await supabaseAdmin
        .from('transactions')
        .update({
          status: 'failed',
          result_desc: ResultDesc,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Callback Error:', error)
    // Safaricom expects a 200 OK so it doesn't retry infinitely
    return NextResponse.json({ success: true, error: error.message })
  }
}

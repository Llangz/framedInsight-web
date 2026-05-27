// ============================================================================
// GET /api/payments/status?checkoutRequestId=XXX
// Polls transaction status — used by billing UI after STK push fires
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAnonClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  }

  // Validate session
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.substring(7)
  const supabase = createAnonClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checkoutId = req.nextUrl.searchParams.get('checkoutRequestId')
  if (!checkoutId) return NextResponse.json({ error: 'checkoutRequestId required' }, { status: 400 })

  const { data: txn, error } = await supabase
    .from('transactions')
    .select('status, mpesa_receipt_number, result_desc, amount, months_added, created_at')
    .eq('checkout_request_id', checkoutId)
    .single()

  if (error || !txn) {
    return NextResponse.json({ status: 'not_found' })
  }

  return NextResponse.json({
    status:        txn.status,
    receiptNumber: txn.mpesa_receipt_number,
    resultDesc:    txn.result_desc,
    amount:        txn.amount,
    monthsAdded:   txn.months_added,
  })
}
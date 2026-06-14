import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createAuthClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    // 1. Verify user is authenticated (Server-Side)
    const authSupabase = await createAuthClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user's farm_id to ensure they only see their own transactions
    const { data: fm } = await authSupabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()

    if (!fm?.farm_id) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 })
    }

    // 3. Use service role key SERVER-SIDE ONLY (never exposed to client)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing server configuration for transactions')
      return NextResponse.json({ error: 'Missing server configuration' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 4. Fetch transactions for this farm
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, months_added, status, mpesa_receipt_number, created_at')
      .eq('farm_id', fm.farm_id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Transaction fetch error:', error)
      throw error
    }

    return NextResponse.json({ transactions: data || [] })
    
  } catch (error: any) {
    console.error('Transaction API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error.message }, 
      { status: 500 }
    )
  }
}
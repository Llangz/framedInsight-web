import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getSubscriptionInfo, TIER_MONTHLY_PRICES, TIER_NAMES } from '@/lib/subscription'
import BillingClient from '@/app/dashboard/billing/BillingClient'

interface Transaction {
  id: string
  amount: number
  months_added: number
  status: string
  mpesa_receipt_number: string | null
  created_at: string
}

export default async function BillingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id, role')
    .eq('user_id', user.id)
    .single()

  if (!fm?.farm_id) redirect('/onboarding')

  const { data: farm } = await supabase
    .from('farms')
    .select('id, farm_name, subscription_tier, subscription_end_date, created_at, phone')
    .eq('id', fm.farm_id)
    .single()

  if (!farm) redirect('/onboarding')

  const subInfo = getSubscriptionInfo(farm)

  // Transactions: use admin client since transactions may not be in generated types yet
  let transactions: Transaction[] = []
  try {
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (adminUrl && adminKey) {
      const admin = createAdmin(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data } = await admin
        .from('transactions')
        .select('id, amount, months_added, status, mpesa_receipt_number, created_at')
        .eq('farm_id', fm.farm_id)
        .order('created_at', { ascending: false })
        .limit(10)
      transactions = (data as Transaction[]) ?? []
    }
  } catch { /* transactions table may not exist in this environment yet */ }

  return (
    <BillingClient
      farm={{ id: farm.id, name: farm.farm_name ?? 'My Farm', phone: farm.phone ?? '' }}
      subInfo={subInfo}
      transactions={transactions}
      tierPrices={TIER_MONTHLY_PRICES}
      tierNames={TIER_NAMES}
    />
  )
}
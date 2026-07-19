// 📁 FILE PATH: app/dashboard/poultry/finance/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinanceClientComponent from './FinanceClientComponent'


export default async function PoultryFinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!fm) redirect('/onboarding')

  const farmId = fm.farm_id

  // Fetch all batches (active + closed) to show historical P&L
  const { data: batches } = await (supabase as any)
    .from('poultry_batches')
    .select('id, batch_name, bird_type, initial_count, current_count, date_of_placement, status, house_number, purchase_price_per_bird')
    .eq('farm_id', farmId)
    .order('date_of_placement', { ascending: false })

  const allBatchIds = (batches || []).map((b: any) => b.id)

  if (!allBatchIds.length) {
    return (
      <FinanceClientComponent
        farmId={farmId}
        batches={[]}
        sales={[]}
        feedRecords={[]}
        healthRecords={[]}
        mortalityRecords={[]}
      />
    )
  }

  // Parallel fetch: all financial data streams
  const [
    { data: sales },
    { data: feedRecords },
    { data: healthRecords },
    { data: mortalityRecords },
  ] = await Promise.all([
    (supabase as any)
      .from('poultry_sales')
      .select('id, batch_id, sale_date, sale_type, quantity, unit, price_per_unit, total_price, buyer_name, market, payment_method, notes, poultry_batches(batch_name, bird_type)')
      .in('batch_id', allBatchIds)
      .order('sale_date', { ascending: false }),

    (supabase as any)
      .from('poultry_feed_records')
      .select('id, batch_id, record_date, feed_type, quantity_kg, cost_per_kg, total_cost, poultry_batches(batch_name)')
      .in('batch_id', allBatchIds)
      .order('record_date', { ascending: false }),

    (supabase as any)
      .from('poultry_health_records')
      // BUG FIX: real column is event_date, not record_date (confirmed via
      // information_schema) — record_date doesn't exist on this table at
      // all, so this query was failing silently (data destructured
      // straight from { data }, no error check) and every health cost was
      // dropped from the P&L with no visible error. Aliased back to
      // record_date so FinanceClientComponent, which treats all four
      // record types uniformly via that field name, needs no changes.
      .select('id, batch_id, record_date:event_date, event_type, vaccine_name, disease, drug_name, cost, poultry_batches(batch_name)')
      .in('batch_id', allBatchIds)
      .not('cost', 'is', null)
      .order('event_date', { ascending: false }),

    (supabase as any)
      .from('poultry_mortality')
      .select('id, batch_id, record_date, count_dead, cause, poultry_batches(batch_name, initial_count)')
      .in('batch_id', allBatchIds)
      .order('record_date', { ascending: false }),
  ])

  return (
    <FinanceClientComponent
      farmId={farmId}
      batches={batches || []}
      sales={sales || []}
      feedRecords={feedRecords || []}
      healthRecords={healthRecords || []}
      mortalityRecords={mortalityRecords || []}
    />
  )
}
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalesClient from './SalesClient'

export default async function PoultrySalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()
  if (!fm) redirect('/onboarding')

  const farmId = fm.farm_id
  const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const [{ data: batches }, { data: sales }] = await Promise.all([
    (supabase as any)
      .from('poultry_batches')
      .select('id, batch_name, bird_type, current_count')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('batch_name'),
    (supabase as any)
      .from('poultry_sales')
      .select('*, poultry_batches(batch_name, bird_type)')
      .eq('farm_id', farmId)
      .gte('sale_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('sale_date', { ascending: false }),
  ])

  return <SalesClient farmId={farmId} initialBatches={(batches as any) || []} initialSales={(sales as any) || []} />
}
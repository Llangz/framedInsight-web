import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HealthClient from './HealthClient'

export default async function PoultryHealthPage() {
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

  const [{ data: batches }, { data: health }] = await Promise.all([
    supabase
      .from('poultry_batches' as any)
      .select('id, batch_name, bird_type, current_count')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('batch_name'),
    supabase
      .from('poultry_health_records' as any)
      .select('*, poultry_batches(batch_name)')
      .eq('farm_id', farmId)
      .order('record_date', { ascending: false })
      .limit(50),
  ])

  // Map record_date to event_date for component
  const healthEvents = (health as any[] || []).map((e: any) => ({
    ...e,
    event_date: e.record_date,
  }))

  return <HealthClient farmId={farmId} initialBatches={(batches as any) || []} initialEvents={healthEvents || []} />
}
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EggsClient from './EggsClient'

export default async function EggsPage() {
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
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  // Active layer/dual batches
  const { data: batches } = await supabase
    .from('poultry_batches' as any)
    .select('id, batch_name, bird_type, current_count')
    .eq('farm_id', farmId)
    .eq('status', 'active')
    .in('bird_type', ['layer', 'dual_purpose', 'kienyeji'])
    .order('batch_name')

  const batchIds = (batches as any[] || []).map(b => b.id)

  let records: any[] = []
  if (batchIds.length > 0) {
    const { data } = await supabase
      .from('poultry_egg_records' as any)
      .select('*, poultry_batches(batch_name, bird_type)')
      .in('batch_id', batchIds)
      .gte('record_date', thirtyAgo.toISOString().split('T')[0])
      .order('record_date', { ascending: false })
    records = data as any[] || []
  }

  return <EggsClient farmId={farmId} initialBatches={(batches as any) || []} initialRecords={records} />
}
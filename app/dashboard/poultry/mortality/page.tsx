import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MortalityClient from './MortalityClient'

export default async function MortalityPage() {
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
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const [{ data: batches }, { data: mortality }] = await Promise.all([
    supabase
      .from('poultry_batches' as any)
      .select('id, batch_name, bird_type, current_count')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('batch_name'),
    supabase
      .from('poultry_mortality' as any)
      .select('*, poultry_batches(batch_name)')
      .eq('farm_id', farmId)
      .gte('record_date', thirtyAgo.toISOString().split('T')[0])
      .order('record_date', { ascending: false }),
  ])

  // Map null notes to undefined for type compatibility
  const mortalityRecords = (mortality as any[] || []).map((m: any) => ({
    ...m,
    notes: m.notes || undefined,
  }))

  return <MortalityClient farmId={farmId} initialBatches={(batches as any) || []} initialRecords={mortalityRecords || []} />
}
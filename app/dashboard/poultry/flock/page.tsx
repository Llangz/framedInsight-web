import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FlockClient from '@/app/dashboard/poultry/flock/FlockClient'

export default async function FlockPage() {
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

  const { data: batches } = await supabase
    .from('poultry_batches' as any)
    .select('*')
    .eq('farm_id', farmId)
    .order('date_of_placement', { ascending: false })

  return <FlockClient initialBatches={(batches as any) || []} farmId={farmId} />
}
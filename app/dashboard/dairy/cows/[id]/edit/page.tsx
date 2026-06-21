import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EditCowClient from './EditCowClient'

export default async function EditCowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) redirect('/onboarding')

  // Fetch cow + other farm cows for sire/dam selects
  const [cowRes, farmCowsRes] = await Promise.all([
    supabase
      .from('cows')
      .select('*')
      .eq('id', id)
      .eq('farm_id', farmManager.farm_id)
      .single(),
    supabase
      .from('cows')
      .select('id, cow_tag, name, sex')
      .eq('farm_id', farmManager.farm_id)
      .neq('id', id),
  ])

  if (cowRes.error || !cowRes.data) notFound()

  return (
    <EditCowClient
      cow={cowRes.data}
      farmCows={farmCowsRes.data ?? []}
    />
  )
}
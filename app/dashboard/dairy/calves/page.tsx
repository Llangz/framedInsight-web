import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalvesClient from './CalvesClient'

export default async function CalvesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) {
    redirect('/onboarding')
  }

  const { data: cows } = await supabase
    .from('cows')
    .select('id, cow_tag, name')
    .eq('farm_id', farmManager.farm_id)

  const cowIds = (cows || []).map(c => c.id)
  const damById = new Map((cows || []).map(c => [c.id, c.name || c.cow_tag]))

  // calves has no farm_id column and no tracked RLS migration in this
  // repo — scope explicitly by dam_id membership in this farm's cow ids
  // rather than trusting an unverified policy.
  const { data: calvesRows } = cowIds.length > 0
    ? await supabase
        .from('calves')
        .select('*')
        .in('dam_id', cowIds)
        .order('birth_date', { ascending: false })
    : { data: [] }

  const calves = (calvesRows || []).map(c => ({
    ...c,
    dam_name: c.dam_id ? damById.get(c.dam_id) || 'Unknown dam' : 'Unknown dam',
  }))

  return <CalvesClient initialCalves={calves} />
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddCalfClient from './AddCalfClient'

export default async function AddCalfPage() {
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

  // Candidate dams: female cows still present on the farm. A calf can still
  // be born to a dam that's since gone dry, so status isn't filtered beyond
  // excluding sold/deceased.
  const { data: cows } = await supabase
    .from('cows')
    .select('id, cow_tag, name, sex, breed')
    .eq('farm_id', farmManager.farm_id)
    .not('status', 'in', '(sold,deceased)')
    .order('cow_tag')

  const dams = (cows || []).filter(c => c.sex !== 'male')

  return <AddCalfClient dams={dams} farmId={farmManager.farm_id} />
}

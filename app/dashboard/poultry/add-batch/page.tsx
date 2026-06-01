// 📁 FILE PATH: app/dashboard/poultry/add-batch/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddBatchClient from './AddBatchClient'

export default async function AddBatchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) redirect('/onboarding')

  return <AddBatchClient farmId={farmManager.farm_id} />
}
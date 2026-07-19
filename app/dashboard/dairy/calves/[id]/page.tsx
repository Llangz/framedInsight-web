import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CalfDetailClient from './CalfDetailClient'

export default async function CalfDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: calf } = await supabase
    .from('calves')
    .select('*, dam:cows!calves_dam_id_fkey(id, farm_id, cow_tag, breed, name)')
    .eq('id', id)
    .maybeSingle()

  // calves has no farm_id of its own — ownership is proven only through
  // the dam belonging to this farm.
  if (!calf || !calf.dam || calf.dam.farm_id !== farmManager.farm_id) {
    notFound()
  }

  return <CalfDetailClient calf={calf} />
}

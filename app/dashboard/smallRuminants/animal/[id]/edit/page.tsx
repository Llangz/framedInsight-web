import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EditAnimalClient from './EditAnimalClient'

export default async function EditAnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) redirect('/onboarding')

  const { data: animal, error } = await supabase
    .from('small_ruminants')
    .select('*')
    .eq('id', id)
    .eq('farm_id', farmManager.farm_id)
    .single()

  if (error || !animal) notFound()

  return <EditAnimalClient initialAnimal={animal} />
}

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import AnimalDetailClient from './AnimalDetailClient'

export default async function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [animalRes, weightsRes, healthRes, breedingRes, milkRes] = await Promise.all([
    supabase
      .from('small_ruminants')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('weight_records')
      .select('*')
      .eq('animal_id', id)
      .order('record_date', { ascending: false })
      .limit(10),
    supabase
      .from('small_ruminant_health')
      .select('*')
      .eq('animal_id', id)
      .order('event_date', { ascending: false })
      .limit(5),
    // small_ruminant_breeding uses dam_id (the female animal), not animal_id
    supabase
      .from('small_ruminant_breeding')
      .select('*')
      .eq('dam_id', id)
      .order('service_date', { ascending: false })
      .limit(5),
    supabase
      .from('goat_milk_records')
      .select('*')
      .eq('animal_id', id)
      .order('record_date', { ascending: false })
      .limit(10),
  ])

  if (animalRes.error || !animalRes.data) {
    console.error('[AnimalDetailPage] not found or RLS blocked:', animalRes.error?.message, '| id:', id)
    notFound()
  }

  return (
    <AnimalDetailClient
      animal={animalRes.data}
      weights={weightsRes.data ?? []}
      healthRecords={healthRes.data ?? []}
      breedingRecords={breedingRes.data ?? []}
      milkRecords={milkRes.data ?? []}
    />
  )
}
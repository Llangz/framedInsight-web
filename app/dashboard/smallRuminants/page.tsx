import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SmallRuminantsClient from './SmallRuminantsClient'

export default async function SmallRuminantsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // 1. Get farm ID
  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!fm?.farm_id) {
    redirect('/onboarding')
  }

  const farmId = fm.farm_id

  // 2. Fetch all required data in parallel
  const [animalResponse, vacResponse, kiddingResponse, weightResponse] = await Promise.all([
    supabase
      .from('small_ruminants')
      .select('*')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('species')
      .order('animal_tag'),
    
    supabase
      .from('small_ruminant_health')
      .select('id, animal_id, vaccine_type, vaccine_name, next_vaccination_due')
      .eq('event_type', 'vaccination')
      .not('next_vaccination_due', 'is', null)
      .lte('next_vaccination_due', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
      .order('next_vaccination_due', { ascending: true }),

    supabase
      .from('kidding_lambing_records')
      .select('id, dam_id, delivery_date, sex, birth_weight, vigor_score, colostrum_given, kid_lamb_id')
      .gte('delivery_date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      .order('delivery_date', { ascending: false }),

    supabase
      .from('weight_records')
      .select('animal_id, weight_kg, record_date, average_daily_gain, body_condition_score')
      .order('record_date', { ascending: false })
  ])

  const animals = animalResponse.data || []
  const animalIds = animals.map(a => a.id)
  const animalLookup = Object.fromEntries(animals.map(a => [a.id, a]))
  
  const today = new Date()
  today.setHours(0,0,0,0)

  // Filter and enrich vaccinations
  const vaccinations = (vacResponse.data || [])
    .filter(v => animalIds.includes(v.animal_id))
    .map(v => {
      const animal = animalLookup[v.animal_id]
      const dueDate = new Date(v.next_vaccination_due!)
      const daysUntil = Math.floor((dueDate.getTime() - today.getTime()) / 86400000)
      return {
        ...v,
        animal_tag: animal?.animal_tag ?? '—',
        animal_name: animal?.name ?? null,
        species: animal?.species ?? 'goat',
        days_until_due: daysUntil,
      }
    })

  // Filter and enrich kiddings
  const kiddings = (kiddingResponse.data || [])
    .filter(k => animalIds.includes(k.dam_id))
    .map(k => {
      const dam = animalLookup[k.dam_id]
      return {
        ...k,
        dam_tag: dam?.animal_tag ?? '—',
        dam_name: dam?.name ?? null,
      }
    })

  // Map weights (latest per animal)
  const weightMap: Record<string, any> = {}
  ;(weightResponse.data || [])
    .filter(w => animalIds.includes(w.animal_id))
    .forEach(w => {
      if (!weightMap[w.animal_id]) weightMap[w.animal_id] = w
    })

  return (
    <div className="min-h-screen bg-slate-50">
      <SmallRuminantsClient 
        initialAnimals={animals as any}
        initialVaccinations={vaccinations as any}
        initialKiddings={kiddings as any}
        weightMap={weightMap}
      />
    </div>
  )
}


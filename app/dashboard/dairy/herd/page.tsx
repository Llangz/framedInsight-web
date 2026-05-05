import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HerdClient from './HerdClient'

export default async function HerdPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Get farm ID
  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) {
    redirect('/onboarding')
  }

  // Get all cows
  const { data: cows, error: cowsError } = await supabase
    .from('cows')
    .select('*')
    .eq('farm_id', farmManager.farm_id)
    .order('created_at', { ascending: false })

  if (cowsError) {
    console.error('Error loading cows:', cowsError.message)
  }

  // Map cows data to the expected interface
  const animals = (cows || []).map(cow => ({
    id: cow.id,
    animal_id: cow.name || cow.cow_tag,
    breed: cow.breed || 'Unknown',
    date_of_birth: cow.birth_date || new Date().toISOString().split('T')[0],
    status: cow.status || 'active',
    purchase_price: cow.purchase_price || 0
  }))

  const stats = {
    total: animals.length,
    active: animals.filter(c => c.status === 'active').length,
    dry: animals.filter(c => c.status === 'dry').length,
    heifers: animals.filter(c => c.status === 'heifer').length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HerdClient initialAnimals={animals} initialStats={stats} />
    </div>
  )
}


import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CowsClient from './CowsClient'

export default async function CowsPage() {
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

  // Get cows
  const { data: cows, error } = await supabase
    .from('cows')
    .select('*')
    .eq('farm_id', farmManager.farm_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading cows:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CowsClient initialCows={cows || []} />
    </div>
  )
}


import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlotsClient from './PlotsClient'

export default async function CoffeePlotsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) {
    redirect('/onboarding')
  }

  // Fetch plots directly from coffee_plots table
  const { data: plots, error } = await supabase
    .from('coffee_plots')
    .select('*')
    .eq('farm_id', farmManager.farm_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading coffee plots:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PlotsClient initialPlots={plots || []} />
    </div>
  )
}


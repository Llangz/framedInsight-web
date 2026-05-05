import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CoffeeClient from './CoffeeClient'

export default async function CoffeePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get farm ID
  const { data: farmManager, error: fmError } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (fmError || !farmManager?.farm_id) {
    console.warn('Coffee Dashboard: No farm found for user')
    redirect('/onboarding')
  }

  // Get coffee stats from v_farm_summary
  const { data: summary, error: summaryError } = await supabase
    .from('v_farm_summary')
    .select('*')
    .eq('id', farmManager.farm_id)
    .single()

  if (summaryError) {
    console.warn('Coffee Dashboard: summary fetch failed:', summaryError.message)
  }

  const stats = {
    total_plots: summary?.total_coffee_plots || 0,
    total_trees: summary?.total_coffee_plants || 0,
    mature_trees: summary?.mature_coffee_plants || 0,
    season_harvest_kg: summary?.season_cherry_kg || 0,
    season_revenue: summary?.season_coffee_revenue_kes || 0,
    eudr_compliant: summary?.eudr_compliant_plants || 0,
    pending_payments: 0,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CoffeeClient stats={stats} />
    </div>
  )
}


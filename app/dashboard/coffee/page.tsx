import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unwrap } from '@/lib/safe-query'
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
    .maybeSingle()

  if (fmError || !farmManager?.farm_id) {
    console.warn('Coffee Dashboard: No farm found for user')
    redirect('/onboarding')
  }

  // Get coffee stats from v_farm_summary. This materialized view has
  // exactly one row per row in `farms` (see
  // 20260612_materialize_farm_summary.sql), so .single() failing here
  // means the fetch actually broke — not that the farm has zero
  // everything. Previously a summaryError was only console.warn'd and the
  // page fell straight through to a stats object of all zeros, which for
  // a brand-new farm and a broken fetch look identical. unwrap() throws
  // into app/dashboard/error.tsx instead, so a real failure gets a
  // "this page didn't load" screen rather than a false "0 trees, 0 kg
  // harvested, 0 revenue" that reads as data loss to the farmer.
  const summaryRes = await supabase
    .from('v_farm_summary')
    .select('*')
    .eq('id', farmManager.farm_id)
    .single()
  const summary = unwrap(summaryRes, 'v_farm_summary')

  const stats = {
    total_plots: summary?.total_coffee_plots || 0,
    total_trees: summary?.total_coffee_plants || 0,
    mature_trees: summary?.mature_coffee_plants || 0,
    season_harvest_kg: summary?.season_cherry_kg || 0,
    season_revenue: summary?.season_coffee_revenue_kes || 0,
    eudr_compliant: summary?.eudr_compliant_plants || 0,
    pending_payments: 0,
  }

  return <CoffeeClient stats={stats} />
}
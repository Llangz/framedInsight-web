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
    .maybeSingle()

  if (fmError || !farmManager?.farm_id) {
    console.warn('Coffee Dashboard: No farm found for user')
    redirect('/onboarding')
  }

  // Coffee stats, queried directly from the source tables.
  //
  // This used to read total_coffee_plots / total_coffee_plants /
  // season_cherry_kg / etc. from v_farm_summary. That view (see
  // 20260612_materialize_farm_summary.sql) was rewritten at some point
  // into a general cross-enterprise "quick stats" cache for a different
  // consumer — its actual live columns are id, farm_name, owner_name,
  // county, subscription_tier, has_dairy/has_coffee/has_small_ruminants/
  // has_poultry, total_cows, today_milk_liters, total_coffee_acres,
  // total_small_ruminants, total_poultry_birds, today_eggs,
  // poultry_layers, poultry_broilers, created_at — none of which are the
  // fields this page was reading. lib/database.types.ts still lists the
  // old coffee-specific columns because it was generated against an
  // earlier version of the view that no migration in this repo actually
  // creates anymore (confirmed via a live information_schema query, not
  // just reading the type file). No `.maybeSingle()`/`.single()` fix
  // could have helped here — it was never a missing-row problem, it was
  // asking a real view for columns it has never had.
  //
  // Querying coffee_plots / coffee_harvests / coffee_eudr_compliance
  // directly sidesteps that cache entirely and matches what every other
  // coffee page (plots, harvest, eudr-check) already reads from.
  const currentYear = new Date().getFullYear()

  const [
    { data: plots, error: plotsError },
    { data: harvests, error: harvestsError },
    { data: compliance, error: complianceError },
  ] = await Promise.all([
    supabase
      .from('coffee_plots')
      .select('id, total_trees, productive_trees')
      .eq('farm_id', farmManager.farm_id),
    supabase
      .from('coffee_harvests')
      .select('cherry_kg, total_value')
      .eq('farm_id', farmManager.farm_id)
      .eq('harvest_year', currentYear),
    supabase
      .from('coffee_eudr_compliance')
      .select('plot_id, compliance_status, assessment_date')
      .eq('farm_id', farmManager.farm_id),
  ])

  if (plotsError || harvestsError || complianceError) {
    throw new Error(
      `[coffee stats] ${plotsError?.message || harvestsError?.message || complianceError?.message}`
    )
  }

  // A plot can have more than one EUDR assessment over time — keep only
  // each plot's latest, same "latest wins" semantics as v_plot_status's
  // LATERAL join (see 20260613_create_secondary_materialized_views.sql).
  const latestAssessmentByPlot = new Map<string, { compliance_status: string | null }>()
  for (const c of compliance ?? []) {
    const existing = latestAssessmentByPlot.get(c.plot_id)
    if (!existing || (c.assessment_date ?? '') > ((existing as any).assessment_date ?? '')) {
      latestAssessmentByPlot.set(c.plot_id, c)
    }
  }

  const eudrCompliantTrees = (plots ?? [])
    .filter((p) => latestAssessmentByPlot.get(p.id)?.compliance_status === 'verified')
    .reduce((sum, p) => sum + (p.total_trees || 0), 0)

  const stats = {
    total_plots: plots?.length || 0,
    total_trees: (plots ?? []).reduce((sum, p) => sum + (p.total_trees || 0), 0),
    mature_trees: (plots ?? []).reduce((sum, p) => sum + (p.productive_trees || 0), 0),
    season_harvest_kg: (harvests ?? []).reduce((sum, h) => sum + (h.cherry_kg || 0), 0),
    season_revenue: (harvests ?? []).reduce((sum, h) => sum + (h.total_value || 0), 0),
    eudr_compliant: eudrCompliantTrees,
    pending_payments: 0,
  }

  return <CoffeeClient stats={stats} />
}
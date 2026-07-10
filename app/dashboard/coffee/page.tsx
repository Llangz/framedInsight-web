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

  // Get coffee stats from v_farm_summary. This is a MATERIALIZED view
  // refreshed on a 1-minute pg_cron tick (see
  // 20260708_fix_farm_summary_refresh_trigger.sql) — not a live view — so
  // there is a legitimate window, up to ~60s right after a farm is
  // created, where this farm genuinely has no row yet. That is not a
  // fetch failure, and treating it as one (the previous `.single()` +
  // unwrap() combination did exactly that) turned every brand-new farm's
  // first minute on the platform into a hard "This page didn't load"
  // crash — which is what the coffee dashboard screenshot was actually
  // showing.
  //
  // `.single()` throws PGRST116 on zero *or* multiple rows, and unwrap()
  // rethrows that unconditionally — it can't tell "missing row, refresh
  // hasn't ticked yet" apart from "something is actually broken."
  // `.maybeSingle()` doesn't error on zero rows, so we can make that
  // distinction explicitly below: a real Postgres/PostgREST error (RLS,
  // permissions, connection) still throws into app/dashboard/error.tsx;
  // "no row yet" falls through to an all-zero stats object, same as any
  // other legitimately-empty state on this dashboard.
  const { data: summary, error: summaryError } = await supabase
    .from('v_farm_summary')
    .select('*')
    .eq('id', farmManager.farm_id)
    .maybeSingle()

  if (summaryError) {
    throw new Error(`[v_farm_summary] ${summaryError.message}`)
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

  return <CoffeeClient stats={stats} />
}
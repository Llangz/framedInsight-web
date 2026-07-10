// 📁 FILE PATH: app/dashboard/coffee/harvest/page.tsx
//
// THE BUG THIS FIXES
// ───────────────────
// /dashboard/coffee/harvest had no page.tsx — only /dashboard/coffee/
// harvest/record (the "add a new harvest" form) existed. But five
// different places in the app link to the bare /dashboard/coffee/harvest
// URL expecting a listing/index page: QuickActions.tsx ("Log Harvest"),
// RecentActivity.tsx, the "Season harvest" stat card and nav item in
// CoffeeClient.tsx, and the "Harvest" tab in the (now-shared)
// EnterpriseNavHeader. Every one of those links 404'd — Next.js has no
// route to match, so it falls all the way through to the root
// not-found.tsx, outside the dashboard layout entirely (no sidebar, no
// nav — see the screenshot this was reported with).
//
// This adds the missing index page: a season-aware history of recorded
// harvest deliveries, with the existing /harvest/record form linked as
// the primary action, rather than silently redirecting bare /harvest to
// /harvest/record and hiding that a listing view never existed.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unwrapOr } from '@/lib/safe-query'
import HarvestClient from './HarvestClient'

export default async function CoffeeHarvestPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!farmManager) redirect('/onboarding')

  const farmId = farmManager.farm_id

  const [harvestsRes, plotsRes] = await Promise.all([
    supabase
      .from('coffee_harvests')
      .select(`
        id, harvest_date, harvest_year, harvest_season, plot_name,
        cherry_kg, produce_kg, produce_type, processing_method,
        quality_grade, price_per_kg, total_value, payment_status,
        payment_date, cooperative_name, factory_code, lot_number,
        mbuni_accepted, notes
      `)
      .eq('farm_id', farmId)
      .order('harvest_date', { ascending: false })
      .limit(200),
    supabase
      .from('coffee_plots')
      .select('id, plot_name')
      .eq('farm_id', farmId)
      .order('plot_name'),
  ])

  // Real farmer delivery/payment records — a failed fetch must surface as
  // an error screen (via app/dashboard/error.tsx), not render as "no
  // harvests yet", which would look identical to genuine emptiness and
  // could read as "your delivery history is gone."
  const harvests = unwrapOr(harvestsRes as any, [] as any[], 'coffee_harvests')
  const plots = unwrapOr(plotsRes as any, [] as any[], 'coffee_plots')

  return <HarvestClient farmId={farmId} initialHarvests={harvests as any} plots={plots as any} />
}

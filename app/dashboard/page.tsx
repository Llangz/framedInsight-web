import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Redirect cooperative officers to their dashboard.
  //
  // Was `.single()` — which throws (PostgREST 406) on zero rows, not just
  // multiple. A regular farmer (the majority of users) has zero rows in
  // cooperative_officers by definition, so this was throwing on every
  // single visit to /dashboard for every non-cooperative-officer account —
  // the primary landing page after login, crashing into
  // app/dashboard/error.tsx for most of the user base. `.maybeSingle()`
  // makes "not a cooperative officer" the normal, non-error case it always
  // was meant to be.
  const { data: coopOfficer } = await supabase
    .from('cooperative_officers')
    .select('cooperative_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (coopOfficer) {
    redirect('/dashboard/cooperative')
  }

  // 1. Get farm membership
  const { data: farmManager, error: fmError } = await supabase
    .from('farm_managers')
    .select('farm_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (fmError || !farmManager?.farm_id) {
    console.warn('Dashboard: No farm found for user, redirecting to onboarding')
    redirect('/onboarding')
  }

  // 2. Fetch farm profile
  //
  // Was `.single()` followed by `if (farmError || !farmData) redirect(...)`
  // — the redirect was dead code, unreachable because `.single()` throws
  // before it can run. Same fix as farm_managers above: `.maybeSingle()`
  // makes the deliberate onboarding-redirect fallback actually execute
  // instead of hard-crashing on a momentarily-unreadable or genuinely
  // missing farm row.
  const { data: farmData, error: farmError } = await supabase
    .from('farms')
    .select('*')
    .eq('id', farmManager.farm_id)
    .maybeSingle()

  if (farmError || !farmData) {
    console.warn('Dashboard: Farm record not found')
    redirect('/onboarding')
  }

  // 3. Fetch summary stats from view
  //
  // Was `.single()`. v_farm_summary is a MATERIALIZED view refreshed on a
  // 1-minute pg_cron tick (see 20260708_fix_farm_summary_refresh_trigger.sql)
  // — not a live view — so there's a legitimate ~60s window right after a
  // new farm is created where it genuinely has no row yet. `.single()`
  // throws in that window instead of returning null, which meant every
  // brand-new farmer's very first visit to their own dashboard — seconds
  // after finishing onboarding — crashed. `.maybeSingle()` plus the
  // existing `stats || {}` fallback below turns that into the intended
  // all-zero "just getting started" state instead.
  const { data: stats, error: statsError } = await supabase
    .from('v_farm_summary')
    .select('*')
    .eq('id', farmManager.farm_id)
    .maybeSingle()

  if (statsError) {
    console.warn('v_farm_summary not fully populated:', statsError.message)
  }

  // pending_alerts doesn't exist on v_farm_summary — it never did, so
  // `farmStats?.pending_alerts > 0` in DashboardClient was always
  // `undefined > 0`, i.e. always false. Not a crash, just a silently dead
  // feature: the alert badge on the main dashboard header never appeared,
  // even with real unacknowledged alerts sitting in the alerts table.
  // v_active_alerts (see 20260613_create_secondary_materialized_views.sql)
  // is the real source for this — querying it directly rather than adding
  // yet another column to v_farm_summary's already-drifted schema.
  const { count: pendingAlerts } = await supabase
    .from('v_active_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmManager.farm_id)

  return (
    <div className="min-h-screen">
      <DashboardClient farmData={farmData} farmStats={{ ...(stats || {}), pending_alerts: pendingAlerts || 0 }} />
    </div>
  )
}

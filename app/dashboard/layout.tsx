import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionInfo } from '@/lib/subscription'
import { getFarmStatus } from '@/lib/get-farm-status'
import DashboardShell from './components/DashboardShell'
import CoopDashboardShell from './components/CoopDashboardShell'

// Explicit, not inferred. This layout calls cookies() indirectly via the
// Supabase server client, which already forces dynamic rendering — but
// every other dashboard-adjacent route should declare this too rather
// than rely on that inference holding for every future code path
// (e.g. a server component that reads via the service-role client
// without touching cookies() itself would NOT be auto-detected as
// dynamic). See the security review notes on SSR/prerendering.
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Check if cooperative officer
  const { data: coopOfficer } = await supabase
    .from('cooperative_officers')
    .select('cooperative_id')
    .eq('user_id', user.id)
    .single()

  if (coopOfficer) {
    const { data: coop } = await ((supabase as any).from('cooperatives')
            .select('cooperative_name')
            .eq('id', coopOfficer.cooperative_id))
      .single()

    return (
      <CoopDashboardShell coopName={coop?.cooperative_name || 'My Cooperative'}>
        {children}
      </CoopDashboardShell>
    )
  }

  // ── Canonical farm-status check ──────────────────────────────────────
  // Previously: `const { data: fm } = await supabase.from('farm_managers')...`
  // followed only by `if (!fm?.farm_id) redirect('/onboarding')`. A failed
  // query (data: null, error: <something>) was indistinguishable from a
  // genuine "no farm" result, so any transient error here silently sent an
  // existing farmer back through onboarding. getFarmStatus() forces us to
  // handle that case explicitly instead.
  const farmStatus = await getFarmStatus(supabase, user.id)

  if (farmStatus.state === 'unknown') {
    console.error('[DashboardLayout] Could not verify farm status:', farmStatus.reason, '| user:', user.id)
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-2 border-neutral-800 border-t-red-500 rounded-full" />
          <h1 className="text-xl font-bold">Couldn't verify your account</h1>
          <p className="text-neutral-400 text-sm">
            Something went wrong loading your farm. This is usually temporary —
            please try again in a moment.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-3 bg-white text-neutral-950 font-bold rounded-xl hover:bg-neutral-200 transition-all"
          >
            Retry
          </a>
        </div>
      </div>
    )
  }

  if (farmStatus.state === 'no_farm') redirect('/onboarding')

  const { data: farm } = await supabase
    .from('farms')
    .select('id, farm_name, subscription_tier, subscription_end_date, created_at')
    .eq('id', farmStatus.farmId)
    .single()

  // A farm_managers row pointing at a farm that no longer exists is a data
  // integrity problem, not a "go fill out onboarding again" problem — surface
  // it the same way as the unknown-status case rather than silently offering
  // to create a duplicate farm.
  if (!farm) {
    console.error('[DashboardLayout] farm_managers row has no matching farm:', farmStatus.farmId, '| user:', user.id)
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-4">
          <h1 className="text-xl font-bold">We couldn't load your farm</h1>
          <p className="text-neutral-400 text-sm">
            Please contact support — your account is linked to a farm record
            that could not be found.
          </p>
        </div>
      </div>
    )
  }

  const subInfo = getSubscriptionInfo(farm)

  return (
    <DashboardShell
      farmName={farm.farm_name ?? 'My Farm'}
      farmId={farm.id}
      subInfo={subInfo}
    >
      {children}
    </DashboardShell>
  )
}
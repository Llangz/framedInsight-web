import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionInfo } from '@/lib/subscription'
import { getFarmStatus } from '@/lib/get-farm-status'
import { AccountIssueScreen } from '@/components/ui/AccountIssueScreen'
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
      <AccountIssueScreen
        title="Couldn't verify your account"
        message="Something went wrong loading your farm. This is usually temporary — retrying resolves it in most cases. If it keeps happening, reach out and we'll sort it out from our side."
        actions={[
          { label: 'Retry', href: '/dashboard', variant: 'primary' },
          { label: 'Contact support', href: '/contact', variant: 'secondary' },
        ]}
        diagnostic={farmStatus.reason}
      />
    )
  }

  if (farmStatus.state === 'no_farm') redirect('/onboarding')

  // Every farm_managers row for this user points at a farm that no longer
  // exists. Not a "retry" problem, and not safe to just link to /onboarding
  // directly either — see lib/create-farm.ts / the create_farm_with_manager
  // RPC (supabase/migrations/20260704b_...) for why onboarding now cleans
  // these rows up itself before creating a new farm, which is what makes
  // this button safe rather than compounding the problem.
  if (farmStatus.state === 'orphaned') {
    console.error('[DashboardLayout] Orphaned farm_managers row(s):', farmStatus.reason, '| user:', user.id)
    return (
      <AccountIssueScreen
        title="We couldn't find your farm"
        message="Your account is linked to a farm record that no longer exists. This can happen after account recovery or a data cleanup. You can set up a new farm now — it only takes a minute — or contact support if you expected your existing data to still be here."
        actions={[
          { label: 'Set Up My Farm', href: '/onboarding', variant: 'primary' },
          { label: 'Contact support', href: '/contact', variant: 'secondary' },
        ]}
        diagnostic={farmStatus.reason}
        tone="notice"
      />
    )
  }

  // 2+ rows, all pointing at real, distinct farms. Either intentional
  // (genuinely managing multiple farms) or a leftover duplicate — this
  // resolver deliberately doesn't guess which farm to show. There's no
  // farm-switcher UI yet, so this needs a person to sort out.
  if (farmStatus.state === 'ambiguous') {
    console.error('[DashboardLayout] Ambiguous farm status:', farmStatus.reason, '| user:', user.id)
    return (
      <AccountIssueScreen
        title="Your account is linked to multiple farms"
        message="We found more than one farm linked to your account and can't tell which one to show yet. Contact support and we'll get this sorted and pick the right one — or split them apart if that's what you need."
        actions={[
          { label: 'Contact support', href: '/contact', variant: 'primary' },
        ]}
        diagnostic={farmStatus.reason}
        tone="notice"
      />
    )
  }

  const { data: farm } = await supabase
    .from('farms')
    .select('id, farm_name, subscription_tier, subscription_end_date, created_at')
    .eq('id', farmStatus.farmId)
    .single()

  // Should be unreachable now that getFarmStatus() confirms the farm exists
  // before returning 'has_farm' — kept as a last-resort guard rather than
  // trusting that invariant blindly (e.g. the farm could be deleted in the
  // instant between the two queries).
  if (!farm) {
    console.error('[DashboardLayout] farm disappeared between status check and fetch:', farmStatus.farmId, '| user:', user.id)
    return (
      <AccountIssueScreen
        title="We couldn't load your farm"
        message="Your farm record couldn't be loaded just now. Retrying usually resolves this — if it doesn't, contact support and mention the reference below."
        actions={[
          { label: 'Retry', href: '/dashboard', variant: 'primary' },
          { label: 'Contact support', href: '/contact', variant: 'secondary' },
        ]}
        diagnostic={`farm_id=${farmStatus.farmId}`}
      />
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
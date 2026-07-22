import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionInfo } from '@/lib/subscription'
import { getFarmStatus } from '@/lib/get-farm-status'
import { validateAdminAccess } from '@/lib/validate-admin-access'
import { AccountIssueScreen } from '@/components/ui/AccountIssueScreen'
import { linkExistingFarm } from './actions'
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

  // Whether to show the "Admin panel" link in the shell's user menu — see
  // DashboardShell.tsx / CoopDashboardShell.tsx. Deliberately swallowed on
  // error rather than using requireAdminAccess()/letting it throw: this is
  // only cosmetic (one extra menu item), and app/admin/layout.tsx is the
  // actual access gate regardless of what this resolves to, so a transient
  // hiccup here should never turn into an AccountIssueScreen for every
  // ordinary farmer loading their dashboard.
  let isPlatformAdmin = false
  try {
    isPlatformAdmin = (await validateAdminAccess()).success
  } catch (e: any) {
    console.warn('[DashboardLayout] Could not check platform admin status (non-fatal):', e?.message)
  }

  // Check if cooperative officer.
  //
  // Was: `const { data: coopOfficer } = await supabase.from(...).single()`
  // — discarded `error` entirely. `.single()` also treats "0 rows" (the
  // normal case for anyone who ISN'T a coop officer) as an error, which
  // then got silently swallowed anyway. Two bugs stacked: a genuine query
  // failure here (e.g. the RLS recursion this table had — see
  // 20260705_fix_cooperative_officers_rls_recursion.sql) was
  // indistinguishable from "not a coop officer" and fell through to the
  // farm-status check below rather than surfacing. `.maybeSingle()` fixes
  // the 0-rows case; explicitly checking `error` fixes the other.
  const { data: coopOfficer, error: coopOfficerError } = await supabase
    .from('cooperative_officers')
    .select('cooperative_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (coopOfficerError) {
    console.error('[DashboardLayout] Could not check cooperative officer status:', coopOfficerError.message, '| user:', user.id)
    return (
      <AccountIssueScreen
        title="Couldn't verify your account"
        message="Something went wrong loading your account. This is usually temporary — retrying resolves it in most cases. If it keeps happening, reach out and we'll sort it out from our side."
        actions={[
          { label: 'Retry', href: '/dashboard', variant: 'primary' },
          { label: 'Contact support', href: '/contact', variant: 'secondary' },
        ]}
        diagnostic={coopOfficerError.message}
      />
    )
  }

  if (coopOfficer) {
    // Was `.single()`, which throws (not returns null) on zero rows. A
    // cooperative_officers row pointing at a cooperative_id that no longer
    // resolves — a deleted/merged cooperative, a bad seed row — used to
    // crash this root layout for every single /dashboard/cooperative/**
    // route with no recovery path, since app/dashboard/error.tsx's "Try
    // again" can't fix a row that's genuinely gone. `.maybeSingle()` plus
    // an explicit fallback name keeps the shell (and the rest of the app)
    // usable instead of hard-erroring the entire cooperative surface.
    const { data: coop, error: coopError } = await ((supabase as any).from('cooperatives')
            .select('cooperative_name')
            .eq('id', coopOfficer.cooperative_id))
      .maybeSingle()

    if (coopError) {
      console.error('[DashboardLayout] Could not load cooperative record:', coopError.message, '| coop_id:', coopOfficer.cooperative_id)
      return (
        <AccountIssueScreen
          title="Couldn't verify your account"
          message="Something went wrong loading your cooperative. This is usually temporary — retrying resolves it in most cases. If it keeps happening, reach out and we'll sort it out from our side."
          actions={[
            { label: 'Retry', href: '/dashboard', variant: 'primary' },
            { label: 'Contact support', href: '/contact', variant: 'secondary' },
          ]}
          diagnostic={coopError.message}
        />
      )
    }

    return (
      <CoopDashboardShell coopName={coop?.cooperative_name || 'My Cooperative'} isPlatformAdmin={isPlatformAdmin}>
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
  const farmStatus = await getFarmStatus(supabase, user.id, {
    phone: user.phone || user.user_metadata?.phone || null,
    email: user.email,
    fullName: user.user_metadata?.full_name || null,
  })

  if (farmStatus.state === 'unknown') {
    console.error('[DashboardLayout] Could not verify farm status:', farmStatus.reason, '| user:', user.id)
    return (
      <AccountIssueScreen
        title="Couldn't verify your account"
        message="Something went wrong loading your farm. This is usually temporary — retrying resolves it in most cases. If it keeps happening, contact support and we’ll help you recover your access quickly."
        actions={[
          { label: 'Retry', href: '/dashboard', variant: 'primary' },
          { label: 'Contact support', href: '/contact', variant: 'secondary' },
        ]}
        diagnostic={farmStatus.reason}
      />
    )
  }

  if (farmStatus.state === 'unlinked_match') {
    return (
      <AccountIssueScreen
        title="Is this your farm?"
        message={`We found an existing farm — ${farmStatus.farmName || 'unnamed farm'} — that matches your phone or email, but it isn't linked to this account yet. If this is yours, link it now instead of setting up a new one.`}
        tone="notice"
        actions={[
          { label: 'Yes, this is my farm', formAction: linkExistingFarm.bind(null, farmStatus.farmId), variant: 'primary' },
          { label: 'No, set up a new farm', href: '/onboarding', variant: 'secondary' },
        ]}
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
      isPlatformAdmin={isPlatformAdmin}
    >
      {children}
    </DashboardShell>
  )
}
// 📁 FILE PATH: app/dashboard/cooperative/settings/page.tsx
import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

// "Account settings" in CoopDashboardShell.tsx used to point at
// /dashboard/settings, which is a farm-only page: it calls GET /api/farms,
// which returns `{ farms: [] }` for anyone without a farm_managers row —
// which is every cooperative officer, by definition (they're routed to
// CoopDashboardShell precisely *because* app/dashboard/layout.tsx found a
// cooperative_officers row instead of a farm one). The page has no
// "you're not a farmer" branch, so it just sits on its loading state
// forever with nothing to show — a dead page reachable from the main nav
// on every cooperative account. This page is the cooperative-side
// equivalent, built from the same data cooperative/page.tsx and
// cooperative/legality/page.tsx already fetch.
export default async function CooperativeSettingsPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Was `.single()` in the sibling cooperative pages before their own
  // fixes — `.maybeSingle()` here for the same reason: a cooperative row
  // that's momentarily unreadable (or genuinely gone) should redirect to
  // onboarding, not crash this page with an unhandled throw.
  const { data: coop } = await supabase
    .from('cooperatives')
    .select('cooperative_name, county, sub_county, ward, primary_enterprise, registration_number, registration_year, registered_office, county_code')
    .eq('id', access.coopId)
    .maybeSingle()

  if (!coop) {
    redirect('/onboarding')
  }

  // Fellow officers, for a lightweight "who else has access" list — join
  // table only, no auth.users access needed (RLS on cooperative_officers
  // already allows an officer to see fellow officers' rows, per
  // "Cooperative officers can view fellow officers" in
  // 20260620_create_cooperatives.sql).
  const { data: officers } = await supabase
    .from('cooperative_officers')
    .select('id, user_id, role, created_at')
    .eq('cooperative_id', access.coopId)
    .order('created_at', { ascending: true })

  return (
    <SettingsClient
      coopName={coop.cooperative_name}
      county={coop.county}
      subCounty={coop.sub_county}
      ward={coop.ward}
      primaryEnterprise={coop.primary_enterprise}
      registrationNumber={coop.registration_number}
      registrationYear={coop.registration_year}
      registeredOffice={coop.registered_office}
      countyCode={coop.county_code}
      currentUserEmail={user?.email ?? null}
      currentUserPhone={user?.phone ?? user?.user_metadata?.phone ?? null}
      role={access.role ?? 'officer'}
      officerCount={officers?.length ?? (access.userId ? 1 : 0)}
    />
  )
}

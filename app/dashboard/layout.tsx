import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionInfo } from '@/lib/subscription'
import DashboardShell from './components/DashboardShell'
import CoopDashboardShell from './components/CoopDashboardShell'

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

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!fm?.farm_id) redirect('/onboarding')

  const { data: farm } = await supabase
    .from('farms')
    .select('id, farm_name, subscription_tier, subscription_end_date, created_at')
    .eq('id', fm.farm_id)
    .single()

  if (!farm) redirect('/onboarding')

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
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 1. Get farm membership
  const { data: farmManager, error: fmError } = await supabase
    .from('farm_managers')
    .select('farm_id, role')
    .eq('user_id', user.id)
    .single()

  if (fmError || !farmManager?.farm_id) {
    console.warn('Dashboard: No farm found for user, redirecting to onboarding')
    redirect('/onboarding')
  }

  // 2. Fetch farm profile
  const { data: farmData, error: farmError } = await supabase
    .from('farms')
    .select('*')
    .eq('id', farmManager.farm_id)
    .single()

  if (farmError || !farmData) {
    console.warn('Dashboard: Farm record not found')
    redirect('/onboarding')
  }

  // 3. Fetch summary stats from view
  const { data: stats, error: statsError } = await supabase
    .from('v_farm_summary')
    .select('*')
    .eq('id', farmManager.farm_id)
    .single()

  if (statsError) {
    console.warn('v_farm_summary not fully populated:', statsError.message)
  }

  return (
    <div className="min-h-screen">
      <DashboardClient farmData={farmData} farmStats={stats || {}} />
    </div>
  )
}

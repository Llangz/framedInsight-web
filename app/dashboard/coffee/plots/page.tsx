import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unwrapOr } from '@/lib/safe-query'
import PlotsClient from './PlotsClient'

export default async function CoffeePlotsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) {
    redirect('/onboarding')
  }

  // Fetch plots directly from coffee_plots table. This is the base data
  // every other coffee feature (EUDR compliance, harvests, activities)
  // is keyed off — a silent failure here previously showed "no plots"
  // indistinguishably from a genuinely new farm.
  const plotsRes = await supabase
    .from('coffee_plots')
    .select('*')
    .eq('farm_id', farmManager.farm_id)
    .order('created_at', { ascending: false })
  const plots = unwrapOr(plotsRes as any, [], 'coffee_plots')

  return (
    <div className="min-h-screen bg-gray-50">
      <PlotsClient initialPlots={plots} />
    </div>
  )
}


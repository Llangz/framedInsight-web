import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import PlotDetailClient from './PlotDetailClient'

export default async function CoffeePlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: plotId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) redirect('/onboarding')

  // Fetch the plot — RLS will block if it doesn't belong to this farm
  const { data: plot, error } = await supabase
    .from('coffee_plots')
    .select('*')
    .eq('id', plotId)
    .eq('farm_id', farmManager.farm_id)
    .single()

  if (error || !plot) {
    notFound()
  }

  // Parallel fetch of everything we need for the detail page
  const [harvestsRes, activitiesRes, diseasesRes, satelliteRes] =
    await Promise.all([
      supabase
        .from('coffee_harvests')
        .select('*')
        .eq('farm_id', farmManager.farm_id)
        .eq('plot_name', plot.plot_name)
        .order('harvest_date', { ascending: false })
        .limit(10),

      supabase
        .from('coffee_activities')
        .select('*')
        .eq('plot_id', plotId)
        .order('activity_date', { ascending: false })
        .limit(10),

      supabase
        .from('coffee_diseases')
        .select('*')
        .eq('plot_id', plotId)
        .order('detection_date', { ascending: false })
        .limit(5),

      supabase
        .from('coffee_satellite_indices')
        .select('*')
        .eq('plot_id', plotId)
        .order('image_date', { ascending: false })
        .limit(8),
    ])

  return (
    <div className="min-h-screen bg-gray-50">
      <PlotDetailClient
        plot={plot}
        harvests={harvestsRes.data || []}
        activities={activitiesRes.data || []}
        diseases={diseasesRes.data || []}
        satelliteHistory={satelliteRes.data || []}
      />
    </div>
  )
}
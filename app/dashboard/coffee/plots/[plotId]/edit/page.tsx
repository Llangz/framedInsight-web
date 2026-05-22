import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EditPlotClient from './EditPlotClient'

export default async function EditCoffeePlotPage({
  params,
}: {
  params: Promise<{ plotId: string }>
}) {
  const { plotId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) redirect('/onboarding')

  // Fetch the plot — confirms it exists AND belongs to this farm
  const { data: plot, error } = await supabase
    .from('coffee_plots')
    .select('*')
    .eq('id', plotId)
    .eq('farm_id', farmManager.farm_id)
    .single()

  if (error || !plot) notFound()

  return <EditPlotClient plot={plot} />
}
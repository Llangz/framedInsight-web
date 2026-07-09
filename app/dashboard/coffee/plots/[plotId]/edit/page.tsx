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
    .maybeSingle()

  if (!farmManager) redirect('/onboarding')

  // Fetch the plot — confirms it exists AND belongs to this farm.
  // notFound() renders Next's 404 page, which is the right call when the
  // plot genuinely doesn't exist or isn't this farm's (PGRST116 = "no
  // rows" from .single(), the expected shape of that case). Any other
  // error code means the query itself failed — that should NOT render as
  // "plot not found," which would read to the farmer as "my plot got
  // deleted" when it's actually just a transient fetch problem. Letting
  // it throw here surfaces it via app/dashboard/error.tsx instead, with
  // a "try again" path rather than a dead-end 404.
  const { data: plot, error } = await supabase
    .from('coffee_plots')
    .select('*')
    .eq('id', plotId)
    .eq('farm_id', farmManager.farm_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Could not load plot ${plotId}: ${error.message}`)
  }
  if (error || !plot) notFound()

  return <EditPlotClient plot={plot} />
}
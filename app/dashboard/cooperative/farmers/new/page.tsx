import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import MapFarmerClient from './MapFarmerClient'

export default async function MapFarmerPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // Fetch factories/branches of this cooperative for the select dropdown
  const { data: factories = [] } = await supabase
    .from('coop_factories')
    .select('id, factory_name')
    .eq('cooperative_id', access.coopId)
    .order('factory_name')

  return (
    <MapFarmerClient factories={factories || []} />
  )
}

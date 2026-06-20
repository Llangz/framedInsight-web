import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import EudrClient from './EudrClient'

export default async function CooperativeEudrPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // 1. Fetch cooperative details


  const { data: coop } = await ((supabase as any).from('cooperatives')
    .select('cooperative_name')
    .eq('id', access.coopId)

    .single())

  if (!coop) {
    redirect('/onboarding')
  }

  // ... rest of code ...

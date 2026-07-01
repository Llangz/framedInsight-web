import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import { listLegalityDeclarationSeasons } from './actions'
import LegalityClient from './LegalityClient'

export default async function CooperativeLegalityPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // Cooperative details for display
  const { data: coop } = await supabase
    .from('cooperatives')
    .select('cooperative_name, registration_number')
    .eq('id', access.coopId)
    .single()

  if (!coop) {
    redirect('/onboarding')
  }

  // Fetch existing declaration seasons from the summary view
  const { seasons, error: seasonsError } = await listLegalityDeclarationSeasons()

  return (
    <LegalityClient
      coopName={coop.cooperative_name}
      coopRegistrationNumber={coop.registration_number ?? null}
      existingSeasons={seasonsError ? [] : seasons}
    />
  )
}

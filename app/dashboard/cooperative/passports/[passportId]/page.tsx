/**
 * app/dashboard/cooperative/passports/[passportId]/page.tsx
 * Server component — loads passport, renders edit/publish client.
 */

import { notFound, redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import PassportEditClient from './PassportEditClient'

interface Props {
  params: Promise<{ passportId: string }>
}

export default async function PassportDetailPage({ params }: Props) {
  const { passportId } = await params
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const supabase = await createClient()

  const { data: passport, error } = await supabase
    .from('coffee_passports')
    .select(`
      *,
      export_lots (export_lot_number, buyer_name, buyer_country, grade, net_weight_kg, departure_date)
    `)
    .eq('id', passportId)
    .eq('cooperative_id', access.coopId)
    .single()

  // PGRST116 ("no rows") from .single() is a genuine not-found — 404 is
  // the right response. Any other error code means the fetch itself
  // failed, which should NOT render the same 404: a cooperative officer
  // seeing "not found" for a passport that's actually published and
  // buyer-facing would reasonably read that as "it got deleted," when
  // it's really just a transient fetch problem. Let it throw instead, so
  // app/dashboard/error.tsx can offer a retry.
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Could not load passport ${passportId}: ${error.message}`)
  }
  if (error || !passport) notFound()

  return (
    <PassportEditClient
      passport={passport}
      userId={access.userId!}
      coopId={access.coopId}
    />
  )
}
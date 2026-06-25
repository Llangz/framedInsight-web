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

  if (error || !passport) notFound()

  return (
    <PassportEditClient
      passport={passport}
      userId={access.userId!}
      coopId={access.coopId}
    />
  )
}
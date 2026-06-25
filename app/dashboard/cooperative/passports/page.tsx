/**
 * app/dashboard/cooperative/passports/page.tsx
 * Server component — passport management dashboard for cooperative officers.
 */

import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getCoopPassports } from '@/lib/passport/passport.service'
import PassportsClient from './PassportsClient'

type PassportStatus = 'draft' | 'published' | 'archived'

export default async function PassportsDashboardPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const raw = await getCoopPassports(access.coopId)

  // Supabase returns status as `string`; cast to the known union so
  // PassportsClient's strict Passport interface is satisfied.
  const passports = raw.map(p => ({
    ...p,
    status: (p.status ?? 'draft') as PassportStatus,
  }))

  return (
    <PassportsClient
      passports={passports}
      coopId={access.coopId}
      userId={access.userId!}
    />
  )
}
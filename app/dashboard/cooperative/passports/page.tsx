/**
 * app/dashboard/cooperative/passports/page.tsx
 * Server component — passport management dashboard for cooperative officers.
 */

import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getCoopPassports } from '@/lib/passport/passport.service'
import PassportsClient from './PassportsClient'

export default async function PassportsDashboardPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const passports = await getCoopPassports(access.coopId)

  return (
    <PassportsClient
      passports={passports}
      coopId={access.coopId}
      userId={access.userId!}
    />
  )
}
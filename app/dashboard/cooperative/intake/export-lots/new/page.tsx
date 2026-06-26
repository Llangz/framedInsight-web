/**
 * app/dashboard/cooperative/intake/export-lots/new/page.tsx
 *
 * Server component — loads eligible mill lots, renders the new
 * export lot client form.
 */

import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getExportableMillLots } from '../actions'
import NewExportLotClient from './NewExportLotClient'

export default async function NewExportLotPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const { millLots } = await getExportableMillLots()

  return (
    <NewExportLotClient
      millLots={millLots}
      coopId={access.coopId}
    />
  )
}
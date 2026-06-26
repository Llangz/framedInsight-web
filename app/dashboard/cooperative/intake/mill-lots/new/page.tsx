/**
 * app/dashboard/cooperative/intake/mill-lots/new/page.tsx
 *
 * Server component — loads eligible processing batches, renders the
 * new mill lot client form.
 */

import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getMillableBatches } from '../actions'
import NewMillLotClient from './NewMillLotClient'

export default async function NewMillLotPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const { batches } = await getMillableBatches()

  return (
    <NewMillLotClient
      batches={batches}
      coopId={access.coopId}
    />
  )
}
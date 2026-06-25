/**
 * app/dashboard/cooperative/intake/new/page.tsx
 *
 * Server component — loads factories, renders the new-lot client form.
 */

import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getCoopFactories } from '../actions'
import NewIntakeClient from './NewIntakeClient'

export default async function NewIntakePage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const { factories } = await getCoopFactories()

  return (
    <NewIntakeClient
      factories={factories}
      coopId={access.coopId}
    />
  )
}
/**
 * app/dashboard/cooperative/intake/[lotId]/page.tsx
 * Server component — loads lot detail + deliveries, renders client.
 */

import { notFound, redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getIntakeLotDetail, getCoopMemberFarms } from '../actions'
import LotDetailClient from './LotDetailClient'

interface Props {
  params: Promise<{ lotId: string }>
}

export default async function LotDetailPage({ params }: Props) {
  const { lotId } = await params
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const [detail, { farms }] = await Promise.all([
    getIntakeLotDetail(lotId),
    getCoopMemberFarms(),
  ])

  if (!detail.success || !detail.lot) notFound()

  return (
    <LotDetailClient
      lot={detail.lot}
      deliveries={detail.deliveries}
      farms={farms}
      coopId={access.coopId}
    />
  )
}
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminAccess } from '@/lib/validate-admin-access'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { auditLog } from '@/lib/security'

export async function setFarmActive(farmId: string, isActive: boolean) {
  const { userId } = await requireAdminAccess()
  const sb = await createAdminServiceClient()

  const { error } = await sb.from('farms').update({ is_active: isActive }).eq('id', farmId)
  if (error) throw new Error(error.message)

  // Reuses the same persistent audit_log table every other sensitive
  // action in the app already writes to (see lib/security.ts) — one place
  // to look up "who suspended this farm and when", not a separate
  // admin-only log a support ticket would have to know to ask about.
  await auditLog({
    action: isActive ? 'ADMIN_FARM_REACTIVATED' : 'ADMIN_FARM_SUSPENDED',
    actorId: userId,
    farmId,
    resource: 'farms',
    resourceId: farmId,
    details: {},
    ip: null,
  })

  revalidatePath(`/admin/farms/${farmId}`)
  revalidatePath('/admin/farms')
}

export async function updateFarmSubscription(
  farmId: string,
  tier: string,
  endDate: string | null
) {
  const { userId } = await requireAdminAccess('superadmin')
  const sb = await createAdminServiceClient()

  const { data: before } = await sb
    .from('farms')
    .select('subscription_tier, subscription_end_date')
    .eq('id', farmId)
    .maybeSingle()

  const { error } = await sb
    .from('farms')
    .update({ subscription_tier: tier, subscription_end_date: endDate })
    .eq('id', farmId)
  if (error) throw new Error(error.message)

  await auditLog({
    action: 'ADMIN_SUBSCRIPTION_EDITED',
    actorId: userId,
    farmId,
    resource: 'farms',
    resourceId: farmId,
    details: { before, after: { subscription_tier: tier, subscription_end_date: endDate } },
    ip: null,
  })

  revalidatePath(`/admin/farms/${farmId}`)
  revalidatePath('/admin/subscriptions')
}

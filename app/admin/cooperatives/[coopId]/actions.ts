'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminAccess } from '@/lib/validate-admin-access'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { auditLog } from '@/lib/security'

export async function removeOfficer(coopId: string, officerId: string) {
  const { userId } = await requireAdminAccess('superadmin')
  const sb = await createAdminServiceClient()

  const { error } = await sb.from('cooperative_officers').delete().eq('id', officerId)
  if (error) throw new Error(error.message)

  await auditLog({
    action: 'ADMIN_COOP_OFFICER_REMOVED',
    actorId: userId,
    farmId: null,
    resource: 'cooperative_officers',
    resourceId: officerId,
    details: { cooperativeId: coopId },
    ip: null,
  })

  revalidatePath(`/admin/cooperatives/${coopId}`)
}

export async function changeOfficerRole(coopId: string, officerId: string, role: string) {
  const { userId } = await requireAdminAccess('superadmin')
  const sb = await createAdminServiceClient()

  const { error } = await sb.from('cooperative_officers').update({ role }).eq('id', officerId)
  if (error) throw new Error(error.message)

  await auditLog({
    action: 'ADMIN_COOP_OFFICER_ROLE_CHANGED',
    actorId: userId,
    farmId: null,
    resource: 'cooperative_officers',
    resourceId: officerId,
    details: { cooperativeId: coopId, newRole: role },
    ip: null,
  })

  revalidatePath(`/admin/cooperatives/${coopId}`)
}

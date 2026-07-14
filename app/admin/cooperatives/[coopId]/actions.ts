'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminAccess } from '@/lib/validate-admin-access'
import { createClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/security'

export async function removeOfficer(coopId: string, officerId: string) {
  const { userId } = await requireAdminAccess('superadmin')
  // Covered by "Platform superadmins can remove officers" in
  // supabase/migrations/20260714_platform_admin_rls.sql — a support-tier
  // admin session (or a stripped-down future call site that forgot the
  // 'superadmin' check above) still can't DELETE here; the database
  // enforces the tier distinction independently of this function.
  const sb = await createClient()

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
  const sb = await createClient()

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

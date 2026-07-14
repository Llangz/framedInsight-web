'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminAccess } from '@/lib/validate-admin-access'
import { createClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/security'

export async function setFarmActive(farmId: string, isActive: boolean) {
  const { userId } = await requireAdminAccess()
  // Covered by "Platform admins can update all farms" in
  // supabase/migrations/20260714_platform_admin_rls.sql. Using the
  // caller's own RLS-scoped session (not the service-role client) means
  // this UPDATE is enforced by the database too — if requireAdminAccess()
  // above were ever accidentally removed or bypassed, a non-admin session
  // still couldn't touch this row; Postgres would reject it regardless of
  // what the application code does or doesn't check.
  const sb = await createClient()

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
  // Deliberately still gated to superadmin only in app code: the "Platform
  // admins can update all farms" RLS policy allows either admin tier to
  // UPDATE a farms row (RLS can't distinguish "which columns changed"), so
  // the superadmin-vs-support line for subscription edits specifically has
  // to be drawn here, not in the database. See the RLS migration's comment
  // on the farms UPDATE policy for the full reasoning.
  const { userId } = await requireAdminAccess('superadmin')
  const sb = await createClient()

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

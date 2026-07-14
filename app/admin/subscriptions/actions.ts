'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminAccess } from '@/lib/validate-admin-access'
import { activateSubscription } from '@/lib/activate-subscription'
import { auditLog } from '@/lib/security'
import { createClient } from '@/lib/supabase/server'

/**
 * Manual "Retry activation" action for a transaction stuck in
 * activation_status = 'activation_failed' (or one that hit the
 * reconcile-payments cron's MAX_ATTEMPTS cap and stopped being retried
 * automatically).
 *
 * Deliberately reads the transaction through the caller's own RLS-scoped
 * session (platform admins have read-only SELECT on `transactions` per
 * 20260714_platform_admin_rls.sql) but writes through
 * activateSubscription(), which uses the service-role client — matching
 * that migration's explicit decision that transactions stays writable
 * only via service-role code paths (the M-Pesa webhook, this action, the
 * reconcile cron), never a new RLS UPDATE policy. requireAdminAccess() is
 * the actual gate here, same as every other /admin write.
 */
export async function retryPaymentActivation(transactionId: string) {
  const { userId } = await requireAdminAccess()
  const sb = await createClient()

  // Cast: activation_status isn't in lib/database.types.ts yet — see
  // lib/activate-subscription.ts's note. Regenerate types after applying
  // 20260714b_payment_activation_reconciliation.sql and this cast can go.
  const { data: txn, error } = await (sb.from('transactions') as any)
    .select('id, farm_id, months_added, amount, status, activation_status')
    .eq('id', transactionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!txn) throw new Error('Transaction not found')
  if (txn.status !== 'completed') {
    throw new Error(`Cannot activate a transaction whose payment status is '${txn.status}', not 'completed'`)
  }

  const result = await activateSubscription({
    id: txn.id,
    farm_id: txn.farm_id,
    months_added: txn.months_added,
    amount: txn.amount,
  })

  await auditLog({
    action: result.success ? 'ADMIN_PAYMENT_ACTIVATION_RETRIED' : 'ADMIN_PAYMENT_ACTIVATION_RETRY_FAILED',
    actorId: userId,
    farmId: txn.farm_id,
    resource: 'transactions',
    resourceId: txn.id,
    details: result.success
      ? { tier: result.tier, endDate: result.endDate }
      : { error: result.error },
    ip: null,
  })

  revalidatePath('/admin/subscriptions')
  if (txn.farm_id) revalidatePath(`/admin/farms/${txn.farm_id}`)

  if (!result.success) throw new Error(result.error || 'Activation failed')
  return result
}

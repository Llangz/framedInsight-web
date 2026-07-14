// ============================================================================
// Subscription activation — single source of truth
// ============================================================================
// Extracted from app/api/payments/callback/route.ts so the exact same
// tier-inference / stacking / activation logic runs whether the caller is:
//   - the M-Pesa callback, immediately after Safaricom confirms payment
//   - the reconcile-payments cron, retrying a row where the callback's own
//     attempt failed
//   - an admin's manual "Retry activation" click on a still-failing row
//
// Before this existed, only the callback route had this logic — a retry
// path would have meant re-deriving the tier/stacking math from scratch
// and risking it drifting from the original. One implementation, three
// callers.
//
// Writes through the service-role client, matching
// 20260714_platform_admin_rls.sql's explicit decision that `transactions`
// stays writable only via service-role code paths, never a new RLS policy —
// see that migration's comment on the transactions policy. Callers here
// (including the admin action) are still gated by requireAdminAccess() /
// the callback's own checks at the call site; this file does no auth of
// its own.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

export interface ActivationTransaction {
  id: string
  farm_id: string | null
  months_added: number
  amount: number
}

export interface ActivationResult {
  success: boolean
  tier?: string
  endDate?: string
  error?: string
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service config missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Valid DB tiers: 'smallholder' | 'commercial' | 'enterprise'
// enterprise_plus is handled via manual sales flow, not M-Pesa self-serve
export function inferTierFromMonthlyRate(monthlyKes: number): string {
  if (monthlyKes >= 2000) return 'enterprise'
  if (monthlyKes >= 400) return 'commercial'
  return 'smallholder'
}

/**
 * Attempts to activate/extend a farm's subscription for a completed M-Pesa
 * transaction, and always writes the outcome back onto the transaction row
 * (activation_status / activation_error / activation_attempts /
 * activated_at) before returning — callers don't need to do that
 * bookkeeping themselves.
 *
 * Safe to call more than once for the same transaction: on a farm that's
 * already been activated for this txn, re-running would stack the
 * subscription again, so callers (the cron, the admin action) must only
 * invoke this on rows still in 'pending' or 'activation_failed'
 * activation_status. This function does not re-check that itself — it
 * trusts the caller's query, same as the original callback trusted its own
 * 'pending' guard on `status`.
 */
export async function activateSubscription(
  txn: ActivationTransaction
): Promise<ActivationResult> {
  const supabase = adminClient()
  const now = new Date()

  if (!txn.farm_id) {
    const error = 'Transaction has no farm_id'
    await recordOutcome(supabase, txn.id, { success: false, error })
    return { success: false, error }
  }

  const { data: farm, error: farmErr } = await supabase
    .from('farms')
    .select('id, subscription_tier, subscription_end_date')
    .eq('id', txn.farm_id)
    .single()

  if (farmErr || !farm) {
    const error = `Farm not found: ${farmErr?.message ?? txn.farm_id}`
    await recordOutcome(supabase, txn.id, { success: false, error })
    return { success: false, error }
  }

  const monthlyRate = Math.round(txn.amount / (txn.months_added || 1))
  const newTier = inferTierFromMonthlyRate(monthlyRate)

  // Stacking logic — if the current subscription is still active, extend
  // from its existing end date rather than today, so a farmer who pays
  // early doesn't lose the remainder of what they already paid for.
  const currentEnd = farm.subscription_end_date ? new Date(farm.subscription_end_date) : null
  const startFrom = currentEnd && currentEnd > now ? currentEnd : now
  const newEndDate = new Date(startFrom)
  newEndDate.setMonth(newEndDate.getMonth() + txn.months_added)

  const { error: farmUpdateErr } = await supabase
    .from('farms')
    .update({
      subscription_tier: newTier,
      subscription_end_date: newEndDate.toISOString(),
      subscription_start_date: now.toISOString(),
      is_active: true,
      updated_at: now.toISOString(),
    })
    .eq('id', txn.farm_id)

  if (farmUpdateErr) {
    await recordOutcome(supabase, txn.id, { success: false, error: farmUpdateErr.message })
    return { success: false, error: farmUpdateErr.message }
  }

  await recordOutcome(supabase, txn.id, {
    success: true,
    tier: newTier,
    endDate: newEndDate.toISOString(),
  })

  return { success: true, tier: newTier, endDate: newEndDate.toISOString() }
}

async function recordOutcome(
  supabase: ReturnType<typeof adminClient>,
  transactionId: string,
  outcome: ActivationResult
) {
  const now = new Date().toISOString()

  // Cast: the new activation_* columns aren't in lib/database.types.ts yet
  // (generated types haven't been regenerated since
  // 20260714b_payment_activation_reconciliation.sql was added). Regenerate
  // with `supabase gen types` after applying the migration and this cast
  // can be dropped.
  const update: Record<string, any> = outcome.success
    ? {
        activation_status: 'activated',
        activation_error: null,
        activated_at: now,
      }
    : {
        activation_status: 'activation_failed',
        activation_error: outcome.error ?? 'Unknown error',
      }

  // Attempts count needs a read-then-write since Postgres has no atomic
  // "increment this column" through PostgREST without an RPC — acceptable
  // here because activation retries are rare (a handful of rows at most
  // per cron run) and never concurrent for the same row (the cron
  // processes rows sequentially; the admin retry action and the cron are
  // very unlikely to race on the same row, and if they ever do, the
  // stacking math above is naturally idempotent-ish per calendar month,
  // not silently harmful).
  const { data: current } = await (supabase.from('transactions') as any)
    .select('activation_attempts')
    .eq('id', transactionId)
    .maybeSingle()

  update.activation_attempts = (current?.activation_attempts ?? 0) + 1

  const { error } = await (supabase.from('transactions') as any)
    .update(update)
    .eq('id', transactionId)

  if (error) {
    // Never throw from here — a failure to record the *outcome* of an
    // activation attempt must not be confused with the activation attempt
    // itself failing. Worst case this attempt isn't reflected in
    // activation_attempts and the cron retries it once more than
    // necessary, which is harmless.
    console.error('[activateSubscription] Failed to record activation outcome:', error.message)
  }
}

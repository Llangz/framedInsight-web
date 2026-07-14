-- ============================================================
-- Migration: Payment activation reconciliation
-- framedInsight — 20260714b_payment_activation_reconciliation.sql
--
-- CONTEXT:
--   app/api/payments/callback/route.ts has, since it was written, had a
--   bare `// TODO: Add to a dead-letter queue / alert` at the exact point
--   where a farmer's M-Pesa payment succeeds but the matching
--   `farms` UPDATE (the write that actually turns the subscription on)
--   fails. When that happens today, the only trace is a console.error —
--   the farmer has paid, `transactions.status` says 'completed', and
--   nothing about their farm ever changes. There is no query that finds
--   these rows and no automated retry.
--
--   This migration adds the columns needed to track activation as its
--   own state, separate from payment status, plus indexes for the
--   reconciliation queries this enables. lib/activate-subscription.ts
--   (new) and the reconcile-payments cron (new) do the actual work; this
--   migration only adds the storage for it.
--
--   IMPORTANT — this deliberately does NOT touch RLS on `transactions`.
--   20260714_platform_admin_rls.sql's comment on that table is explicit:
--   "Read-only — admin surfaces M-Pesa history, never edits it (that
--   stays the sole responsibility of the M-Pesa webhook's service-role
--   writes)." The new reconciliation cron and the admin "retry
--   activation" action both honor that and write through the
--   service-role client, exactly like the webhook already does — not
--   through a new admin RLS policy. See lib/activate-subscription.ts.
-- ============================================================

-- activation_status is intentionally a separate axis from `status`.
-- `status` ('pending' | 'completed' | 'failed') describes the M-Pesa
-- payment itself and must stay exactly what it means today — several
-- places (billing UI polling, the callback's own idempotency guard)
-- already depend on 'completed' meaning "Safaricom confirmed the
-- payment", and that must remain true even when the subsequent farm
-- activation write fails.
--
--   not_applicable    — payment never completed (pending/failed txns)
--   pending            — payment completed, activation not attempted yet
--                         (should be near-instantaneous; a row visibly
--                         stuck here past a minute or two is itself a
--                         signal something is wrong with the callback)
--   activated          — payment completed AND the farm row was updated
--   activation_failed  — payment completed, farm UPDATE failed at least
--                         once; activation_attempts / activation_error
--                         carry the detail; picked up by the
--                         reconcile-payments cron until activated or
--                         activation_attempts hits the cron's cap
--   legacy_unknown     — completed before this migration existed, so we
--                         genuinely don't know whether activation
--                         succeeded; see the backfill below and the
--                         admin "Legacy — needs audit" panel
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS activation_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (activation_status IN ('not_applicable', 'pending', 'activated', 'activation_failed', 'legacy_unknown')),
  ADD COLUMN IF NOT EXISTS activation_error text,
  ADD COLUMN IF NOT EXISTS activation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

COMMENT ON COLUMN public.transactions.activation_status IS
  'State of the *subscription activation* write that follows a completed M-Pesa payment. Independent of `status`, which tracks the payment itself. See migration 20260714b for the full state list.';
COMMENT ON COLUMN public.transactions.activation_attempts IS
  'Incremented on every activation attempt (initial callback attempt + each reconcile-payments cron retry). The cron stops retrying a row once this reaches its cap and instead escalates.';

-- Backfill: every transaction that was already 'completed' before this
-- migration ran has no reliable record of whether the farm activation
-- succeeded — the old code path didn't distinguish. Label them
-- 'legacy_unknown' rather than guessing 'activated', so they surface in
-- the admin audit panel for a one-time manual cross-check against
-- farms.subscription_end_date instead of silently assuming success.
UPDATE public.transactions
SET activation_status = 'legacy_unknown'
WHERE status = 'completed'
  AND activation_status = 'not_applicable';

-- Both routes (callback, status polling) already filter/query by
-- checkout_request_id on every call and there was no index backing it.
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request_id
  ON public.transactions (checkout_request_id);

-- The reconciliation cron's exact query shape: completed payments whose
-- activation isn't done yet, oldest-first.
CREATE INDEX IF NOT EXISTS idx_transactions_activation_pending
  ON public.transactions (created_at)
  WHERE status = 'completed' AND activation_status IN ('pending', 'activation_failed');

-- ============================================================
-- VERIFICATION (run manually after applying):
--
--   1. SELECT activation_status, count(*) FROM transactions GROUP BY 1;
--      -> every pre-existing 'completed' row should now show
--         'legacy_unknown', not 'not_applicable'.
--
--   2. SELECT indexname FROM pg_indexes WHERE tablename = 'transactions';
--      -> idx_transactions_checkout_request_id and
--         idx_transactions_activation_pending should both be present.
-- ============================================================

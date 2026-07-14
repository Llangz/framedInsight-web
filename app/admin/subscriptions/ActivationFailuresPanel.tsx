'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertOctagon, RotateCw, ShieldQuestion } from 'lucide-react'
import { retryPaymentActivation } from './actions'

type FailedTxn = {
  id: string
  farm_id: string | null
  farm_name?: string | null
  amount: number
  months_added: number
  activation_attempts: number
  activation_error: string | null
  created_at: string | null
}

type LegacyTxn = {
  id: string
  farm_id: string | null
  farm_name?: string | null
  amount: number
  created_at: string | null
  subscription_end_date: string | null
}

export default function ActivationFailuresPanel({
  failed,
  legacy,
}: {
  failed: FailedTxn[]
  legacy: LegacyTxn[]
}) {
  const [isPending, startTransition] = useTransition()
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const retry = (id: string) => {
    setRetryingId(id)
    setNotice(null)
    startTransition(async () => {
      try {
        await retryPaymentActivation(id)
        setNotice('Activation retried successfully.')
      } catch (e: any) {
        setNotice(`Retry failed: ${e.message}`)
      } finally {
        setRetryingId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {failed.length > 0 && (
        <div className="rounded-xl border border-red-800/40 bg-red-950/10 p-5">
          <h2 className="text-sm font-semibold text-red-300 mb-1 flex items-center gap-1.5">
            <AlertOctagon size={14} /> Payment activation failed ({failed.length})
          </h2>
          <p className="text-xs text-zinc-500 mb-3">
            M-Pesa confirmed these payments, but the subscription activation write failed.
            The reconcile-payments cron retries these automatically every 15 minutes up to 5
            attempts — these either haven&apos;t cleared yet or already hit that cap.
          </p>
          {notice && (
            <div className="text-sm rounded-lg border border-[#2A2D35] bg-zinc-900 px-3 py-2 text-zinc-300 mb-3">
              {notice}
            </div>
          )}
          <div className="space-y-2 text-sm">
            {failed.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-red-900/30 bg-zinc-900/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-zinc-300 truncate">
                    {t.farm_id ? (
                      <Link href={`/admin/farms/${t.farm_id}`} className="hover:text-white">
                        {t.farm_name || t.farm_id}
                      </Link>
                    ) : (
                      <span className="text-red-400">No farm_id on transaction</span>
                    )}
                    {' · '}KES {t.amount} · {t.months_added}mo
                  </div>
                  <div className="text-xs text-zinc-600 truncate">
                    {t.activation_attempts} attempt{t.activation_attempts === 1 ? '' : 's'} ·{' '}
                    {t.activation_error || 'no error recorded'}
                  </div>
                </div>
                <button
                  onClick={() => retry(t.id)}
                  disabled={isPending}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  <RotateCw size={12} className={retryingId === t.id ? 'animate-spin' : ''} />
                  Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {legacy.length > 0 && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/10 p-5">
          <h2 className="text-sm font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
            <ShieldQuestion size={14} /> Legacy — needs audit ({legacy.length})
          </h2>
          <p className="text-xs text-zinc-500 mb-3">
            Completed payments recorded before activation tracking existed. We can&apos;t tell
            from the transaction alone whether the farm was actually activated — flagged here
            because the farm&apos;s subscription_end_date looks inconsistent with this payment
            (missing, or earlier than the payment date). Worth a manual check; use Retry only
            if you&apos;ve confirmed the farm truly wasn&apos;t activated for this payment, since
            re-running it will stack more months on top of whatever is there now.
          </p>
          <div className="space-y-2 text-sm">
            {legacy.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-900/30 bg-zinc-900/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-zinc-300 truncate">
                    {t.farm_id ? (
                      <Link href={`/admin/farms/${t.farm_id}`} className="hover:text-white">
                        {t.farm_name || t.farm_id}
                      </Link>
                    ) : (
                      <span className="text-red-400">No farm_id on transaction</span>
                    )}
                    {' · '}KES {t.amount}
                  </div>
                  <div className="text-xs text-zinc-600 truncate">
                    paid {t.created_at ? new Date(t.created_at).toLocaleDateString('en-KE') : '—'} · sub ends{' '}
                    {t.subscription_end_date ? new Date(t.subscription_end_date).toLocaleDateString('en-KE') : 'never set'}
                  </div>
                </div>
                <button
                  onClick={() => retry(t.id)}
                  disabled={isPending}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800/50 rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  <RotateCw size={12} className={retryingId === t.id ? 'animate-spin' : ''} />
                  Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

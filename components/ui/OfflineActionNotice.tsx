// 📁 FILE PATH: components/ui/OfflineActionNotice.tsx
'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * components/ui/OfflineActionNotice.tsx
 *
 * The farmer-facing enterprises (poultry, dairy, coffee, small ruminants)
 * all have a real offline write path: lib/offline-db.ts queues the event
 * in IndexedDB and components/ui/SyncManager.tsx replays it later. The
 * cooperative-facing forms (factory intake, mill lots, export lots,
 * farmer mapping) have no equivalent — they call 'use server' actions in
 * app/dashboard/cooperative/**\/actions.ts directly, with no offline
 * fallback.
 *
 * That's not an oversight to blindly "fix" by bolting the same
 * queue-and-replay pattern on: several of these actions (e.g.
 * createIntakeLot in app/dashboard/cooperative/intake/actions.ts) derive
 * a sequential, per-factory lot number server-side from a live COUNT
 * query at submit time. Queuing that offline and replaying it later would
 * let two cooperative officers at two different (or the same) washing
 * stations generate colliding lot numbers the moment either of them syncs
 * — a real integrity problem for a custody record, worse than the offline
 * gap itself. Silent conflict-prone writes are a worse failure mode than
 * an honest "you need connectivity for this one" message.
 *
 * So this component is the deliberately honest middle ground: it tells
 * the officer plainly, in the same visual language as
 * ConnectivityBanner.tsx, that this specific action needs a live
 * connection and why, disables the submit button so they can't lose work
 * to a confusing network-error toast, and lets them keep the form filled
 * in so they can submit the moment they're back online. Drop this into
 * any cooperative form whose action isn't (yet) safe to queue; the same
 * component works everywhere since the message stays generic on purpose.
 */
export function OfflineActionNotice({ reason }: { reason?: string }) {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-xl border border-amber-900/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200"
    >
      <WifiOff size={16} className="mt-0.5 shrink-0" />
      <span>
        You're offline. Your entries here are kept on this device, but{' '}
        {reason ?? 'this record needs a live connection to save correctly'} —
        reconnect and submit again when you're back online.
      </span>
    </div>
  )
}

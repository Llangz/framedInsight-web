'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getPendingRequests,
  removeRequest,
  getPendingPoultryEvents,
  markPoultryEventSynced,
  clearSyncedPoultryEvents,
  getPendingDairyEvents,
  markDairyEventSynced,
  clearSyncedDairyEvents,
  getPendingCoffeeEvents,
  markCoffeeEventSynced,
  clearSyncedCoffeeEvents,
  getPendingSmallRuminantEvents,
  markSmallRuminantEventSynced,
  clearSyncedSmallRuminantEvents,
} from '@/lib/offline-db'

export function SyncManager() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(err => console.error('SW registration failed:', err))
    }

    checkPending()

    window.addEventListener('online', syncData)
    const interval = setInterval(syncData, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', syncData)
      clearInterval(interval)
    }
  }, [])

  async function checkPending() {
    const [generic, poultry, dairy, coffee, smallRuminant] = await Promise.all([
      getPendingRequests(),
      getPendingPoultryEvents(),
      getPendingDairyEvents(),
      getPendingCoffeeEvents(),
      getPendingSmallRuminantEvents(),
    ])

    setPendingCount(generic.length + poultry.length + dairy.length + coffee.length + smallRuminant.length)
  }

  async function syncData() {
    if (!navigator.onLine || isSyncing) return

    const [generic, poultryEvents, dairyEvents, coffeeEvents, smallRuminantEvents] = await Promise.all([
      getPendingRequests(),
      getPendingPoultryEvents(),
      getPendingDairyEvents(),
      getPendingCoffeeEvents(),
      getPendingSmallRuminantEvents(),
    ])

    if (
      generic.length === 0 &&
      poultryEvents.length === 0 &&
      dairyEvents.length === 0 &&
      coffeeEvents.length === 0 &&
      smallRuminantEvents.length === 0
    ) return

    setIsSyncing(true)

    try {
      /* ─────────────── 1. Sync generic requests ─────────────── */
      for (const req of generic) {
        try {
          const res = await fetch(req.url, {
            method: req.method,
            headers: {
              ...req.headers,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
          })

          if (res.ok && req.id != null) {
            await removeRequest(req.id)
          }
        } catch (err) {
          console.warn('Generic sync failed, stopping batch', err)
          break
        }
      }

      /* ─────────────── 2. Sync poultry CRDT events ─────────────── */
      if (poultryEvents.length > 0) {
        await syncDomainEvents('poultry', poultryEvents, markPoultryEventSynced, clearSyncedPoultryEvents)
      }

      /* ─────────────── 3. Sync dairy CRDT events ─────────────── */
      if (dairyEvents.length > 0) {
        await syncDomainEvents('dairy', dairyEvents, markDairyEventSynced, clearSyncedDairyEvents)
      }

      /* ─────────────── 4. Sync coffee CRDT events ─────────────── */
      if (coffeeEvents.length > 0) {
        await syncDomainEvents('coffee', coffeeEvents, markCoffeeEventSynced, clearSyncedCoffeeEvents)
      }

      /* ─────────────── 5. Sync small ruminant CRDT events ─────────────── */
      if (smallRuminantEvents.length > 0) {
        await syncDomainEvents('smallRuminant', smallRuminantEvents, markSmallRuminantEventSynced, clearSyncedSmallRuminantEvents)
      }
    } catch (err) {
      console.error('Sync failed:', err)
    }

    await checkPending()
    setIsSyncing(false)
  }

  async function syncDomainEvents(
    domain: 'poultry' | 'dairy' | 'coffee' | 'smallRuminant',
    events: any[],
    markSynced: (id: number) => Promise<unknown>,
    clearSynced: () => Promise<unknown>
  ) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return

    const res = await supabase.functions.invoke('sync-offline-events', {
      body: {
        device_id: getDeviceId(),
        user_id: session.user.id,
        [`${domain}Events`]: events.map(e => ({
          eventId: e.eventId,
          entityType: e.entityType,
          farmId: e.farmId,
          batchId: e.batchId,
          referenceId: e.referenceId,
          payload: e.payload,
          isoTimestamp: e.isoTimestamp,
        })),
      },
    })

    if (!res.error) {
      const syncedIds: string[] = res.data?.[`synced_${domain}_ids`] ?? []

      for (const event of events) {
        if (event.id != null && syncedIds.includes(event.eventId)) {
          await markSynced(event.id)
        }
      }

      await clearSynced()
    } else {
      console.error(`${domain} sync error:`, res.error)
    }
  }

  if (pendingCount === 0 && !isSyncing) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border text-sm font-medium transition-all ${
          isSyncing
            ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse'
            : 'bg-amber-100 text-amber-700 border-amber-200'
        }`}
      >
        {isSyncing ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Clock className="w-4 h-4" />
        )}
        <span>
          {isSyncing
            ? 'Syncing records…'
            : `${pendingCount} record${pendingCount !== 1 ? 's' : ''} pending sync`}
        </span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────── */
/* Device ID (stable per browser)                */
/* ─────────────────────────────────────────────── */

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'

  let id = localStorage.getItem('framedInsight_device_id')

  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem('framedInsight_device_id', id)
  }

  return id
}
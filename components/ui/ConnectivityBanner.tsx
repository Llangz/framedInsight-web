// 📁 FILE PATH: components/ui/ConnectivityBanner.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * components/ui/ConnectivityBanner.tsx
 *
 * hooks/useOnlineStatus.ts already existed but was never imported
 * anywhere in the app — dead code. The only connectivity signal a user
 * previously got was components/ui/SyncManager.tsx's pill, and that pill
 * is keyed off `pendingCount`: it stays hidden for as long as there is
 * nothing queued. That leaves a real gap — someone who loses signal and
 * is just *browsing* cached pages, or about to open a form, gets no
 * indication they're offline until the moment they submit something and
 * see a per-form "Saved offline" message.
 *
 * This closes that gap with a persistent, top-of-viewport banner driven
 * directly by navigator.onLine (via useOnlineStatus), independent of
 * whether anything is queued for sync. It's deliberately separate from
 * SyncManager's bottom-right pill rather than merged into it:
 *   - This banner = "here is your connection state, right now."
 *   - SyncManager's pill = "here is what's waiting to leave this device."
 * Those are two different facts and can both be true at once (e.g. back
 * online but still flushing a backlog), so collapsing them into one
 * indicator would hide information a farmer needs to trust the app.
 *
 * On reconnect, shows a brief "Back online" confirmation before
 * disappearing rather than vanishing instantly — silently going from
 * "offline" to "nothing" reads as ambiguous; a person who glances up
 * mid-task should get a definite, if fleeting, confirmation instead of
 * having to infer it from the banner just being gone.
 */
export function ConnectivityBanner() {
  const isOnline = useOnlineStatus()
  const [showReconnected, setShowReconnected] = useState(false)
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true
      setShowReconnected(false)
      return
    }

    if (wasOffline.current) {
      wasOffline.current = false
      setShowReconnected(true)
      const t = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline])

  if (isOnline && !showReconnected) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
        isOnline
          ? 'bg-emerald-600 text-white'
          : 'bg-amber-500 text-amber-950'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Back online — syncing your records</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>You're offline — new records are saved on this device and will sync automatically</span>
        </>
      )}
    </div>
  )
}
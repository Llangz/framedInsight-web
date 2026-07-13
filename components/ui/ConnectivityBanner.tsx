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
  const bannerRef = useRef<HTMLDivElement>(null)

  const visible = !isOnline || showReconnected

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

  // This banner is `position: fixed`, not part of normal document flow —
  // deliberately, since it needs to stay visible over every layout in the
  // app, including the dashboard shells' independently-scrolling <main>
  // regions where a simple `sticky` wouldn't reliably stick to anything.
  // But "fixed" also means nothing naturally reserves space for it, so it
  // was floating directly on top of whatever sits at the very top of the
  // page underneath — on the login page specifically, that's Header.tsx's
  // own `sticky top-0` bar and the submit button just below it on short
  // mobile viewports.
  //
  // Rather than hardcoding an offset (the banner's height isn't constant —
  // it wraps to two lines on narrow screens), this measures its own
  // rendered height and publishes it as a CSS custom property on the root
  // element. Header.tsx (and the dashboard shells' top bars) read
  // `--connectivity-banner-h` to push themselves down by exactly that much
  // while the banner is showing, and snap back to 0 the instant it isn't —
  // one source of truth instead of every consumer guessing a pixel value.
  useEffect(() => {
    const root = document.documentElement
    if (!visible || !bannerRef.current) {
      root.style.setProperty('--connectivity-banner-h', '0px')
      return
    }

    const el = bannerRef.current
    const publish = () => root.style.setProperty('--connectivity-banner-h', `${el.offsetHeight}px`)
    publish()

    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  // Belt-and-suspenders: if this component unmounts entirely (shouldn't
  // happen — it's mounted once in app/layout.tsx — but a stuck "0px"
  // never being reset would otherwise leave every header on the site
  // permanently offset), clear the var on unmount too.
  useEffect(() => {
    return () => document.documentElement.style.setProperty('--connectivity-banner-h', '0px')
  }, [])

  if (!visible) return null

  return (
    <div
      ref={bannerRef}
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
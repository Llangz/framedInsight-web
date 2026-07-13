'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * navigator.onLine and the browser's 'offline' event only reflect whether a
 * network interface is up — not whether it can actually reach the internet.
 * On weak rural cellular signal (tower handoff, brief radio drops that
 * recover a second later) this fires 'offline' for connections that are
 * still fine, which read to farmers as a spurious "You're offline" banner
 * even though the app keeps working. Before trusting an offline event, this
 * debounces briefly (a momentary blip shouldn't flash the banner at all)
 * and then verifies with a real network request — only flipping the UI to
 * offline if that also fails. 'online' events are trusted immediately:
 * showing "back online" a beat early is harmless, since every write path
 * already falls back to the offline queue on its own failed request.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const clearPending = () => {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    }

    const verifyOffline = async () => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)
        // Any response — even a 404/405 — proves the request reached the
        // network; we only care whether fetch() throws.
        await fetch(`${location.origin}/?_connectivity=${Date.now()}`, {
          method: 'HEAD', cache: 'no-store', signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!cancelled) setIsOnline(true)
      } catch {
        if (!cancelled) setIsOnline(false)
      }
    }

    function handleOnline() {
      clearPending()
      setIsOnline(true)
    }

    function handleOffline() {
      clearPending()
      debounceRef.current = setTimeout(verifyOffline, 2000)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      cancelled = true
      clearPending()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

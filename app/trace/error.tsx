// 📁 FILE PATH: app/trace/error.tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

/**
 * app/trace/error.tsx
 *
 * Same reasoning as app/buyer/error.tsx: a scan of a physical QR code on a
 * coffee bag that hits a genuine backend error (e.g. a real failure in
 * getPublicPassportLedger, distinct from "no events yet" - see that
 * function's comments) previously fell through to app/error.tsx's light
 * `bg-gray-50` card, breaking the "dark background, parchment gold" design
 * brief this route is built around (see app/trace/[passportCode]/page.tsx's
 * header comment) at the exact moment - a stranger scanning a bag in a shop
 * or warehouse - where looking legitimate matters most.
 *
 * `reset()` re-renders the segment but doesn't force a fresh network fetch;
 * after a couple of failed attempts this falls back to a genuine hard
 * reload, same reasoning as app/dashboard/error.tsx and app/buyer/error.tsx.
 */
const HARD_REFRESH_AFTER = 2

export default function TraceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    console.error('[TraceError]', error.digest ? `(${error.digest}) ` : '', error)
  }, [error])

  const stuck = attempts >= HARD_REFRESH_AFTER

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A0C10] text-white font-['Outfit'] px-4">
      <div className="max-w-md w-full border border-[#2A2D35] bg-[#0D0F14] rounded-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">This passport didn't load</h1>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          {stuck
            ? "Still not loading after a few tries. A full page reload almost always clears it."
            : "Something went wrong loading this coffee's origin story. This is almost always temporary - a retry usually fixes it."}
        </p>

        {error.digest && (
          <p className="text-xs text-zinc-600 mb-6 break-all">Reference: {error.digest}</p>
        )}

        <button
          onClick={() => {
            if (stuck) {
              window.location.reload()
            } else {
              setAttempts((a) => a + 1)
              reset()
            }
          }}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold rounded-xl transition-colors"
        >
          <RefreshCcw className="w-4 h-4" />
          {stuck ? 'Reload page' : 'Try again'}
        </button>
      </div>
    </main>
  )
}

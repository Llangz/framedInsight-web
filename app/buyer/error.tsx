// 📁 FILE PATH: app/buyer/error.tsx
'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

/**
 * app/buyer/error.tsx
 *
 * Without this file, a thrown error anywhere under /buyer/[token] (e.g.
 * lib/passport/buyer-access.service.ts's getBuyerDataRoom throwing on a
 * genuine query failure - see that file's comments) fell through to
 * app/error.tsx: a light `bg-gray-50` card in an app whose every buyer- and
 * trace-facing page is dark themed (`bg-[#0A0C10]`, parchment-gold accents).
 * For an EU buyer mid due-diligence check, that mismatch reads as "you've
 * left the real site" - a bad signal to give someone deciding whether to
 * trust the EUDR documents on the page they were just looking at.
 *
 * Also swaps app/error.tsx's "Back Home" action for "Try again" only: a
 * buyer's only way into this room is their private access-token link, so
 * sending them to the marketing homepage is a dead end, not a recovery path.
 */
export default function BuyerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[BuyerError]', error.digest ? `(${error.digest}) ` : '', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A0C10] text-white font-['Outfit'] px-4">
      <div className="max-w-md w-full border border-[#2A2D35] bg-[#0D0F14] rounded-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">This data room didn't load</h1>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Something went wrong loading this due-diligence room. This is almost always temporary -
          your access link is still valid, and a retry usually fixes it.
        </p>

        {error.digest && (
          <p className="text-xs text-zinc-600 mb-6 break-all">Reference: {error.digest}</p>
        )}

        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold rounded-xl transition-colors"
        >
          <RefreshCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </main>
  )
}

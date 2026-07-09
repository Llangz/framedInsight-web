// 📁 FILE PATH: app/error.tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react'

/**
 * app/error.tsx
 *
 * Segment-level error boundary for every route NOT covered by a more
 * specific error.tsx (marketing pages, /auth, /blog, /trace, /buyer,
 * /claim, /onboarding, etc.). app/dashboard/error.tsx overrides this for
 * everything under /dashboard.
 *
 * Deliberately mirrors components/ErrorBoundary.tsx's visual design
 * (same copy, same icon, same button layout) rather than inventing a new
 * look — but ErrorBoundary.tsx alone was never sufficient. It's a
 * client-side React error boundary, which only catches errors thrown
 * during client rendering; it cannot catch an error thrown while a
 * Server Component is awaiting data (e.g. the getFarmStatus() /
 * cooperative_officers checks in layout.tsx, or a broken query in any
 * server page.tsx). Next.js's file-convention error.tsx is what's
 * actually required to catch those, so this file and ErrorBoundary.tsx
 * are complementary, not redundant: this one catches segment
 * render/data-fetch failures; ErrorBoundary.tsx catches everything that
 * happens client-side after that (e.g. inside interactive widgets).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RootError]', error.digest ? `(${error.digest}) ` : '', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-6">
            We're sorry, but this page ran into a problem. Please try again.
          </p>

          {error.digest && (
            <p className="text-xs text-gray-400 mb-6 break-all">
              Reference: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-semibold rounded-lg transition hover:bg-emerald-500/20"
            >
              <Home className="w-4 h-4" />
              Back Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
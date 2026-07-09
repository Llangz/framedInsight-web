// 📁 FILE PATH: app/dashboard/error.tsx
'use client'

import { useEffect } from 'react'
import { AccountIssueScreen } from '@/components/ui/AccountIssueScreen'

/**
 * app/dashboard/error.tsx
 *
 * Route-segment error boundary for everything under /dashboard.
 *
 * Why this needs to exist: every dashboard page.tsx is a Server Component
 * that awaits Supabase queries directly (see e.g. app/dashboard/poultry/
 * health/page.tsx). If one of those queries *throws* (not "returns an
 * error" — actually throws: a network drop mid-request, a Supabase client
 * bug, a bad `.single()` on zero rows, RLS denying access in a way that
 * surfaces as an exception rather than a typed error) there was previously
 * no route-level error.tsx anywhere in the app. Next.js has no choice but
 * to fall back to its own generic, unstyled error screen — which a Kenyan
 * smallholder on a patchy connection would have no way to make sense of,
 * and which offers no path back into the app.
 *
 * The root components/ErrorBoundary.tsx (a client-side React error
 * boundary in app/layout.tsx) does NOT catch this class of error — it
 * only catches errors thrown during client-side rendering, not errors
 * thrown while a Server Component is fetching data. This file is the
 * mechanism Next.js actually requires for that.
 *
 * Reuses AccountIssueScreen rather than inventing another "something
 * broke" card, so a farmer sees one consistent failure pattern everywhere
 * in the dashboard instead of three different ones.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side/console logging hook. Swap for Sentry.captureException
    // (or similar) once an error-tracking service is wired in — see the
    // same TODO already left in components/ErrorBoundary.tsx.
    console.error('[DashboardError]', error.digest ? `(${error.digest}) ` : '', error)
  }, [error])

  return (
    <AccountIssueScreen
      title="This page didn't load"
      message="Something went wrong loading this part of your dashboard. Your farm records are safe — this is almost always temporary and a retry fixes it. If you were offline when this happened, reconnecting first usually helps."
      tone="error"
      actions={[
        { label: 'Try again', onClick: reset, variant: 'primary' },
        { label: 'Back to dashboard', href: '/dashboard', variant: 'secondary' },
      ]}
      diagnostic={error.digest ? `Error ref: ${error.digest}` : error.message}
    />
  )
}
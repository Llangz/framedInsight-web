// 📁 FILE PATH: app/global-error.tsx
'use client'

import { useEffect } from 'react'

/**
 * app/global-error.tsx
 *
 * Last-resort boundary: only fires when the ROOT layout.tsx itself throws
 * (e.g. a crash before ErrorBoundary / SyncManager / NavigationFallback
 * even mount). Because it replaces the root layout, Next.js requires it
 * to render its own <html> and <body> — it cannot rely on app/layout.tsx
 * at all, since that's the thing that failed.
 *
 * Kept deliberately minimal: no external fonts, no icon library, no
 * design-system dependency, nothing that could itself fail to load. This
 * is the one screen in the app that has to render even when almost
 * everything else is broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error.digest ? `(${error.digest}) ` : '', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#09090b', color: '#fff' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              framedInsight hit a problem
            </h1>
            <p style={{ color: '#9CA3AF', marginBottom: 24, lineHeight: 1.5 }}>
              The app failed to load. Your farm records are stored safely — this screen just means the page itself couldn't start. Reloading almost always fixes it.
            </p>
            {error.digest && (
              <p style={{ color: '#6B7280', fontSize: 12, marginBottom: 24, wordBreak: 'break-all' }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: '12px 24px',
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Reload framedInsight
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
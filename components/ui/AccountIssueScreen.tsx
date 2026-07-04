'use client'

import Link from 'next/link'

export interface AccountIssueAction {
  label: string
  // Provide exactly one of href / onClick.
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

interface AccountIssueScreenProps {
  title: string
  message: string
  actions: AccountIssueAction[]
  // Small, muted technical detail shown at the bottom — e.g. a reason
  // string worth including if the person contacts support. Never shown
  // as the main message; this is a "reference" line, not an explanation.
  diagnostic?: string
  tone?: 'error' | 'notice'
}

/**
 * components/ui/AccountIssueScreen.tsx
 *
 * The single place every "we couldn't get you to your dashboard/onboarding
 * cleanly" screen should render from. Previously each failure state
 * (dashboard/layout.tsx, onboarding/page.tsx) had its own hand-rolled card
 * with a single "Retry" button and nothing else — a dead end for any
 * failure that a retry can't actually fix (e.g. an orphaned farm record,
 * or an account linked to multiple farms). This component always gives
 * the person at least one concrete next step, and never just "try again"
 * when trying again can't possibly help.
 */
export function AccountIssueScreen({
  title,
  message,
  actions,
  diagnostic,
  tone = 'error',
}: AccountIssueScreenProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-5">
        <div
          className={`w-10 h-10 mx-auto border-2 border-neutral-800 rounded-full ${
            tone === 'error' ? 'border-t-red-500' : 'border-t-amber-500'
          }`}
        />
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-neutral-400 text-sm leading-relaxed">{message}</p>
        </div>

        <div className="space-y-2 pt-1">
          {actions.map((action, i) => {
            const isPrimary = action.variant !== 'secondary'
            const className = isPrimary
              ? 'w-full inline-block px-6 py-3 bg-white text-neutral-950 font-bold rounded-xl hover:bg-neutral-200 transition-all'
              : 'w-full inline-block px-6 py-3 bg-transparent border border-neutral-700 text-neutral-300 font-semibold rounded-xl hover:border-neutral-500 hover:text-white transition-all'

            if (action.href) {
              return (
                <Link key={i} href={action.href} className={className}>
                  {action.label}
                </Link>
              )
            }
            return (
              <button key={i} type="button" onClick={action.onClick} className={className}>
                {action.label}
              </button>
            )
          })}
        </div>

        {diagnostic && (
          <p className="text-neutral-600 text-xs pt-2 border-t border-neutral-800 mt-4">
            Reference for support: {diagnostic}
          </p>
        )}
      </div>
    </div>
  )
}

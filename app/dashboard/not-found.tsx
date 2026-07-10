// 📁 FILE PATH: app/dashboard/not-found.tsx

import { AccountIssueScreen } from '@/components/ui/AccountIssueScreen'

/**
 * app/dashboard/not-found.tsx
 *
 * WHY THIS EXISTS
 * ────────────────
 * /dashboard/coffee/harvest previously had no page.tsx (fixed separately —
 * see app/dashboard/coffee/harvest/page.tsx). Because no route matched
 * under /dashboard for that URL, Next.js had no dashboard-scoped
 * not-found.tsx to fall back to, so it bubbled all the way up to the
 * ROOT app/not-found.tsx — outside DashboardShell entirely. The farmer
 * lost the sidebar, the enterprise nav header, everything, and landed on
 * a generic marketing-site 404 with only "Back home" / "Open dashboard"
 * to escape.
 *
 * This file is a safety net for the *next* stale or mistyped link,
 * whenever that happens. Next.js renders the nearest not-found.tsx in the
 * matched layout hierarchy, so any unmatched route under /dashboard now
 * resolves here — inside app/dashboard/layout.tsx, i.e. inside
 * DashboardShell, with the sidebar and EnterpriseNavHeader still mounted
 * (see EnterpriseNavHeader.tsx for why that persists even through
 * boundaries like this one). Reuses the same AccountIssueScreen as
 * app/dashboard/error.tsx so a farmer sees one consistent "something's
 * off, here's what to do" pattern everywhere in the dashboard, rather
 * than a different unstyled screen depending on which kind of failure it
 * was.
 */
export default function DashboardNotFound() {
  return (
    <AccountIssueScreen
      title="Page not found"
      message="This can happen if a link is outdated or a page moved. Your farm records are unaffected — head back to your dashboard to keep going."
      tone="notice"
      actions={[
        { label: 'Back to dashboard', href: '/dashboard', variant: 'primary' },
      ]}
    />
  )
}

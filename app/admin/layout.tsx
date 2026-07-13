import { redirect } from 'next/navigation'
import { validateAdminAccess } from '@/lib/validate-admin-access'
import AdminShell from './components/AdminShell'
import { AccountIssueScreen } from '@/components/ui/AccountIssueScreen'

// Same reasoning as app/dashboard/layout.tsx: this touches cookies() via
// the Supabase server client, which already forces dynamic rendering, but
// declaring it explicitly avoids relying on that inference holding.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let access
  try {
    access = await validateAdminAccess()
  } catch (e: any) {
    // A genuine DB error checking platform_admins (not "logged in but not
    // an admin") — same AccountIssueScreen pattern app/dashboard/layout.tsx
    // uses for the equivalent cooperative_officers check, rather than
    // treating a transient hiccup as "access denied" and redirecting away.
    console.error('[AdminLayout] Could not verify admin access:', e?.message)
    return (
      <AccountIssueScreen
        title="Couldn't verify admin access"
        message="Something went wrong checking your admin permissions. This is usually temporary."
        actions={[
          { label: 'Retry', href: '/admin', variant: 'primary' },
          { label: 'Contact support', href: '/contact', variant: 'secondary' },
        ]}
        diagnostic={e?.message}
      />
    )
  }

  // Not an authenticated user at all → send through the normal login flow.
  // Authenticated but not in platform_admins → this is a farmer/officer
  // account that has no business here; send them to their own dashboard
  // rather than a bare 404, and don't leak which reason it was.
  if (!access.success) {
    if (access.error === 'Unauthorized') redirect('/auth/login')
    redirect('/dashboard')
  }

  return <AdminShell role={access.role!}>{children}</AdminShell>
}

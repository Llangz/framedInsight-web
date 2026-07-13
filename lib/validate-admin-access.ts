import { createClient } from './supabase/server'

export interface AdminAccessResult {
  success: boolean
  userId?: string
  role?: 'superadmin' | 'support'
  error?: string
}

/**
 * Checks whether the currently logged-in user is a platform admin.
 * Mirrors lib/validate-coop-access.ts's shape and error handling on
 * purpose: a genuine query failure (RLS hiccup, dropped connection) must
 * not look identical to "authenticated but not an admin", the same
 * distinction that mattered for cooperative officers.
 */
export async function validateAdminAccess(): Promise<AdminAccessResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data: admin, error } = await (supabase as any)
    .from('platform_admins')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[validateAdminAccess] Error checking platform_admins:', error)
    throw new Error(`[platform_admins] ${error.message}`)
  }

  if (!admin) {
    return { success: false, error: 'Not a platform admin' }
  }

  return { success: true, userId: user.id, role: admin.role as 'superadmin' | 'support' }
}

/**
 * For server actions that mutate data. Throws instead of returning a
 * result so a missing `if (!access.success) return` can never accidentally
 * let a write through. Pass minRole: 'superadmin' to gate actions (adding
 * other admins, editing subscriptions) that 'support' shouldn't be able to
 * do.
 */
export async function requireAdminAccess(
  minRole?: 'superadmin'
): Promise<{ userId: string; role: 'superadmin' | 'support' }> {
  const access = await validateAdminAccess()
  if (!access.success || !access.userId || !access.role) {
    throw new Error(access.error || 'Not authorized')
  }
  if (minRole === 'superadmin' && access.role !== 'superadmin') {
    throw new Error('This action requires superadmin access')
  }
  return { userId: access.userId, role: access.role }
}

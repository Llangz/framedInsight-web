import { createClient } from './supabase/server'
import { Database } from './database.types'

export interface CoopAccessResult {
  success: boolean
  coopId?: string
  userId?: string
  role?: string
  error?: string
}

export async function validateCoopAccess(): Promise<CoopAccessResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Get user's cooperative membership
  // Changed .single() to .maybeSingle() to gracefully handle users who are not cooperative officers
  const { data: officer, error } = await supabase
    .from('cooperative_officers')
    .select('cooperative_id, role')
    .eq('user_id', user.id)
    .maybeSingle() // <<-- Changed here

  // A genuine query failure (RLS recursion, dropped connection, 5xx from
  // PostgREST) must not look identical to "authenticated but not a
  // cooperative officer." Every caller of validateCoopAccess() does
  // `if (!access.success) redirect('/auth/login')`, which previously sent an
  // already-logged-in cooperative chairman back to the login screen on a
  // transient DB hiccup - a confusing dead end with no "try again" path.
  // Throwing here surfaces it via app/dashboard/error.tsx instead, which
  // does have a working retry button.
  if (error) {
    console.error("Error fetching cooperative officer:", error)
    throw new Error(`[cooperative_officers] ${error.message}`)
  }

  if (!officer) { // User is authenticated but not a cooperative officer
    return { success: false, error: 'No cooperative membership found' }
  }

  return {
    success: true,
    coopId: officer.cooperative_id,
    userId: user.id,
    role: officer.role || 'officer',
  }
}

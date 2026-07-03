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

  if (error) { // Log database errors, but don't treat 'no record found' as an error here
    console.error("Error fetching cooperative officer:", error)
    return { success: false, error: error.message }
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

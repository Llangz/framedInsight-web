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
  const { data: officer, error } = await supabase
    .from('cooperative_officers')
    .select('cooperative_id, role')
    .eq('user_id', user.id)
    .single()

  if (error || !officer) {
    return { success: false, error: 'No cooperative membership found' }
  }

  return {
    success: true,
    coopId: officer.cooperative_id,
    userId: user.id,
    role: officer.role || 'officer',
  }
}

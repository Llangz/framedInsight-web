import { createClient } from './supabase/server'
import { PostgrestError } from '@supabase/supabase-js'

export interface FarmAccessResult {
  success: boolean
  farmId?: string
  userId?: string
  error?: string
}

/**
 * Validates that the current user has access to the specified farm.
 * Returns farmId and userId if successful, error message if not.
 */
export async function validateFarmAccess(farmId?: string): Promise<FarmAccessResult> {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }
  
  if (!farmId) {
    // Get user's primary farm
    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()
    
    if (!fm) {
      return { success: false, error: 'No farm found' }
    }
    
    return { success: true, farmId: fm.farm_id, userId: user.id }
  }
  
  // Verify user has access to this specific farm
  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .eq('farm_id', farmId)
    .single()
  
  if (!fm) {
    return { success: false, error: 'Access denied to this farm' }
  }
  
  return { success: true, farmId: fm.farm_id, userId: user.id }
}

/**
 * Validates that a resource (cow, plot, batch, etc.) belongs to the user's farm.
 */
export async function validateResourceOwnership<T extends { farm_id: string }>(
  table: string,
  resourceId: string,
  farmId: string
): Promise<{ success: boolean; resource?: T; error?: string }> {
  const supabase = await createClient()
  
  const { data: resource, error } = await supabase
    .from(table)
    .select('farm_id, *')
    .eq('id', resourceId)
    .single()
  
  if (error || !resource) {
    return { success: false, error: 'Resource not found' }
  }
  
  if ((resource as any).farm_id !== farmId) {
    return { success: false, error: 'Resource does not belong to your farm' }
  }
  
  return { success: true, resource: resource as T }
}

export function formatSupabaseError(error: PostgrestError | null): string {
  if (!error) return 'Unknown database error'
  
  // Handle common error codes
  if (error.code === '23505') return 'A record with this value already exists'
  if (error.code === '23503') return 'Referenced record not found'
  if (error.code === '23502') return 'Required field is missing'
  if (error.code === 'PGRST116') return 'Record not found'
  
  return error.message || 'Database operation failed'
}
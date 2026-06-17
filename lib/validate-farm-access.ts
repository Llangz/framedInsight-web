import { createClient } from './supabase/server'
import { PostgrestError } from '@supabase/supabase-js'
import { Database } from './database.types'

type TableName = keyof Database['public']['Tables']

export interface FarmAccessResult {
  success: boolean
  farmId?: string
  userId?: string
  error?: string
}

export interface ResourceOwnershipResult<RowType = Record<string, unknown>> {
  success: boolean
  resource?: RowType
  error?: string
}


export async function validateFarmAccess(farmId?: string): Promise<FarmAccessResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Get user's primary farm
  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!fm) {
    return { success: false, error: 'No farm found' }
  }

  // If a specific farmId was requested, ensure it matches the user's farm
  if (farmId && fm.farm_id !== farmId) {
    return { success: false, error: 'Resource does not belong to your farm' }
  }

  return { success: true, farmId: fm.farm_id, userId: user.id }
}

export async function validateResourceOwnership<RowType = Record<string, unknown>>(
  table: TableName,
  resourceId: string,
  farmId: string
): Promise<ResourceOwnershipResult<RowType>> {
  const supabase = await createClient()

  const { data: resource, error } = await (supabase
    .from(table) as any)
    .select('farm_id, *')
    .eq('id', resourceId)
    .single()

  if (error || !resource) {
    return { success: false, error: 'Resource not found' }
  }

  if (!('farm_id' in resource) || (resource as { farm_id: string }).farm_id !== farmId) {
    return { success: false, error: 'Resource does not belong to your farm' }
  }

  return { success: true, resource: resource as RowType }
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
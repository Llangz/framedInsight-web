import { createClient } from '@/lib/supabase/server'
import { Database } from './database.types'

export type Enterprise = 'dairy' | 'coffee' | 'small_ruminants'

export interface CreateFarmParams {
  userId: string
  phone: string
  farmName: string
  county: string
  subCounty: string
  ward: string
  ownerName: string
  enterprises: Enterprise[]
}

export interface FarmCreationResult {
  success: boolean
  farmId?: string
  error?: string
}

export async function createFarmOnSignup(params: CreateFarmParams): Promise<FarmCreationResult> {
  const supabase = await createClient()

  try {
    // 1. Create farm record
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .insert({
        farm_name: params.farmName,
        owner_name: params.ownerName,
        phone: params.phone,
        county: params.county,
        sub_county: params.subCounty,
        ward: params.ward,
        is_active: true,
        subscription_tier: 'smallholder',
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        farm_types: params.enterprises,
        primary_enterprise: params.enterprises[0] || 'coffee',
      })
      .select('id')
      .single()

    if (farmError) {
      console.error('Error creating farm:', farmError)
      return { success: false, error: farmError.message }
    }

    if (!farm) {
      return { success: false, error: 'Farm created but no ID returned' }
    }

    // 2. Link user to farm (farm_managers table)
    const { error: managerError } = await supabase
      .from('farm_managers')
      .insert({
        user_id: params.userId,
        farm_id: farm.id,
        role: 'owner',
        created_at: new Date().toISOString(),
      })

    if (managerError) {
      console.error('Error creating farm_manager:', managerError)
      // Attempt cleanup
      await supabase.from('farms').delete().eq('id', farm.id)
      return { success: false, error: managerError.message }
    }

    // Note: Coffee plots and Small Ruminants are added by the user later via the dashboard

    return { success: true, farmId: farm.id }
  } catch (error) {
    console.error('Unexpected error creating farm:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// GET USER'S FARMS
// ============================================================================

export async function getUserFarms(userId: string) {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('farm_managers')
      .select(`
        farm_id,
        role,
        farms (
          id,
          farm_name,
          phone,
          county,
          farm_types,
          primary_enterprise,
          subscription_tier,
          is_active,
          created_at
        )
      `)
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user farms:', error)
      return { farms: [], error: error.message }
    }

    return { farms: data || [], error: null }
  } catch (error) {
    console.error('Unexpected error fetching farms:', error)
    return {
      farms: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// UPDATE FARM SUBSCRIPTION TIER
// ============================================================================

export async function updateFarmTier(
  farmId: string,
  newTier: string,
  price: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from('farms')
      .update({
        subscription_tier: newTier,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', farmId)

    if (error) {
      console.error('Error updating farm tier:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating tier:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}


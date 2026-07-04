import { createClient } from '@/lib/supabase/server'
import { Database } from './database.types'

export type Enterprise = 'dairy' | 'coffee' | 'small_ruminants' | 'poultry'

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
    // 0. Defensive pre-check — see lib/get-farm-status.ts for the full
    // context. `farm_managers` has no unique constraint on `user_id` alone
    // and no FK from `farm_id` to `farms.id`, so inserting here without
    // checking first is how a user ends up with 2+ farm_managers rows,
    // which breaks every `.single()`/`.maybeSingle()` query keyed on
    // user_id across the app (including this user's own dashboard).
    //
    // - If the user already has a farm_managers row pointing at a farm
    //   that STILL EXISTS, refuse — this is not a legitimate "create my
    //   first farm" call, and proceeding would create a second farm the
    //   UI has no way to disambiguate later. The caller (onboarding page)
    //   should not have reached this point in that case, but we don't
    //   trust that invariant blindly.
    // - If the user has row(s) pointing at farms that no longer exist
    //   (orphaned — e.g. left over from an earlier bug, or a farm that
    //   was deleted), delete those stale rows first, then proceed. This
    //   is what makes it safe to send a user with only orphaned rows
    //   straight to onboarding instead of to a dead-end support screen.
    const { data: managerRows, error: managerError } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', params.userId)

    if (managerError) {
      return { success: false, error: `Could not verify existing farm links: ${managerError.message}` }
    }

    const farmIds = Array.from(new Set((managerRows ?? []).map((r: any) => r.farm_id)))

    let existingIds = new Set<string>()
    if (farmIds.length > 0) {
      const { data: existingFarms, error: farmsError } = await supabase
        .from('farms')
        .select('id')
        .in('id', farmIds)

      if (farmsError) {
        return { success: false, error: `Could not verify existing farm links: ${farmsError.message}` }
      }
      existingIds = new Set((existingFarms ?? []).map((f: any) => f.id))
    }

    const liveRows = (managerRows ?? []).filter((r: any) => existingIds.has(r.farm_id))
    const staleRows = (managerRows ?? []).filter((r: any) => !existingIds.has(r.farm_id))

    if (liveRows.length > 0) {
      return {
        success: false,
        error: 'Your account is already linked to an existing farm. Contact support if you believe this is incorrect.',
      }
    }

    if (staleRows.length > 0) {
      const { error: cleanupError } = await supabase
        .from('farm_managers')
        .delete()
        .eq('user_id', params.userId)
        .in('farm_id', staleRows.map((r: any) => r.farm_id))

      if (cleanupError) {
        console.error('Error cleaning up stale farm_managers rows:', cleanupError)
        return { success: false, error: 'Could not clean up a stale farm link before creating your new farm. Please contact support.' }
      }
    }

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


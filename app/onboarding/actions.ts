'use server'

import { createClient } from '@/lib/supabase/server'
import { Enterprise, CreateFarmParams, FarmCreationResult } from '@/lib/create-farm'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

async function cleanupOrphanedFarmLinks(
  supabaseAdmin: ReturnType<typeof createAdminClient<Database>>,
  userId: string
) {
  const { data: managerRows, error: managerLookupError } = await supabaseAdmin
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', userId)

  if (managerLookupError) {
    return { success: false as const, error: managerLookupError.message }
  }

  if (!managerRows || managerRows.length === 0) {
    return { success: true as const }
  }

  const farmIds = managerRows.map((row) => row.farm_id)
  const { data: existingFarms, error: farmsLookupError } = await supabaseAdmin
    .from('farms')
    .select('id')
    .in('id', farmIds)

  if (farmsLookupError) {
    return { success: false as const, error: farmsLookupError.message }
  }

  const existingIds = new Set((existingFarms ?? []).map((farm) => farm.id))
  const staleFarmIds = farmIds.filter((farmId) => !existingIds.has(farmId))

  if (staleFarmIds.length === 0) {
    return { success: true as const }
  }

  const { error: cleanupError } = await supabaseAdmin
    .from('farm_managers')
    .delete()
    .eq('user_id', userId)
    .in('farm_id', staleFarmIds)

  if (cleanupError) {
    return { success: false as const, error: cleanupError.message }
  }

  return { success: true as const }
}

export async function createFarmAction(params: CreateFarmParams): Promise<FarmCreationResult> {
  const supabaseAuth = await createClient()

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
  if (userError || !user || user.id !== params.userId) {
    return {
      success: false,
      error: 'You must be signed in to continue.'
    }
  }

  // Use service role to bypass RLS for initial provisioning
  const supabaseAdmin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const cleanupResult = await cleanupOrphanedFarmLinks(supabaseAdmin, params.userId)
    if (!cleanupResult.success) {
      return {
        success: false,
        error: cleanupResult.error || 'Could not clean up stale farm links before setup continued.'
      }
    }

    // 1. Call the secure RPC function to create farm and manager association
    const { data: farmId, error: rpcError } = await supabaseAdmin.rpc('create_farm_with_manager', {
      p_farm_name: params.farmName,
      p_owner_name: params.ownerName,
      p_phone: params.phone,
      p_county: params.county,
      p_sub_county: params.subCounty || null,
      p_ward: params.ward || null,
      p_farm_types: params.enterprises,
      p_primary_enterprise: params.enterprises[0] || 'coffee',
      p_user_id: params.userId,
      p_subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })

    if (rpcError) {
      console.error('Error creating farm via RPC:', rpcError)

      // New — see supabase/migrations/20260706_prevent_cross_entity_account_linking.sql.
      // This account is already a cooperative officer; one account can't
      // currently be both. Distinct message from the generic failure below
      // so the person understands *why*, rather than "something went wrong."
      if (rpcError.code === 'P0010') {
        return {
          success: false,
          error: 'This account is already registered as a cooperative officer. A single account can\'t currently be both an individual farm owner and a cooperative officer — contact support if you need this changed.'
        }
      }

      // Postgres unique_violation (e.g. farms_phone_key) — never leak the raw
      // constraint message to the user. This phone is already linked to a farm,
      // most likely the user's own existing farm under a stale session.
      if (rpcError.code === '23505') {
        return {
          success: false,
          error: 'This phone number is already linked to a farm. Try logging in instead, or contact support if you believe this is an error.'
        }
      }

      return {
        success: false,
        error: 'Something went wrong setting up your farm. Please try again or contact support.'
      }
    }

    if (!farmId) {
      return { success: false, error: 'Farm created but no ID returned' }
    }

    revalidatePath('/dashboard')
    return { success: true, farmId: farmId }
  } catch (error: any) {
    console.error('Unexpected error creating farm:', error)
    return {
      success: false,
      error: 'Something went wrong setting up your farm. Please try again or contact support.',
    }
  }
}
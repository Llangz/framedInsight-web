'use server'

import { createClient } from '@supabase/supabase-js'
import { Enterprise, FarmCreationResult } from '@/lib/create-farm'
import { revalidatePath } from 'next/cache'
import { Database } from '@/lib/database.types'

interface VerifyFarmParams {
  userId: string
  phone: string
  email?: string
  ownerName: string
  farmName: string
  county: string
  subCounty?: string
  ward?: string
  farmTypes: Enterprise[]
  primaryEnterprise: Enterprise
  // Self-declared at signup — see 20260626_farmer_supplying_cooperative.sql
  // and 20260628_national_fcs_directory.sql. Deliberately NOT passed into
  // create_farm_with_manager: this is informational/lead-generation only
  // and must never be conflated with managed_by_coop_id (officer-verified
  // membership that drives RLS).
  supplyingCooperativeId?: string
  supplyingFactoryId?: string
  supplyingFcsDirectoryId?: string
  supplyingCoopNameUnmatched?: string
}

export async function createFarmOnVerifyAction(params: VerifyFarmParams): Promise<FarmCreationResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables for admin client')
    return { success: false, error: 'Server misconfiguration.' }
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    const { data: farmId, error: rpcError } = await supabaseAdmin.rpc('create_farm_with_manager', {
      p_farm_name: params.farmName,
      p_owner_name: params.ownerName,
      p_phone: params.phone,
      p_county: params.county,
      p_sub_county: params.subCounty || null,
      p_ward: params.ward || null,
      p_farm_types: params.farmTypes,
      p_primary_enterprise: params.primaryEnterprise,
      p_user_id: params.userId,
      p_subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      // create_farm_with_manager now accepts p_email as of
      // supabase/migrations/20260621_claim_flow_and_rpc_fixes.sql, which also
      // makes the RPC claim-aware: if this phone matches an unclaimed
      // cooperative-mapped farm, this call attaches params.userId as owner of
      // that existing farm instead of trying to insert a duplicate row.
      p_email: params.email || null,
    })

    if (rpcError) {
      console.error('Error creating farm via RPC:', rpcError)

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

    // Optional self-declared supplying-cooperative fields. A separate
    // lightweight update rather than RPC params, so the existing
    // claim-aware RPC stays untouched and this stays easy to drop later
    // if the directory-matched flow (Phase 2) replaces it.
    if (params.supplyingCooperativeId || params.supplyingFactoryId || params.supplyingFcsDirectoryId || params.supplyingCoopNameUnmatched) {
      const { error: updateError } = await supabaseAdmin
        .from('farms')
        .update({
          supplying_cooperative_id: params.supplyingCooperativeId ?? null,
          supplying_factory_id: params.supplyingFactoryId ?? null,
          supplying_fcs_directory_id: params.supplyingFcsDirectoryId ?? null,
          supplying_coop_name_unmatched: params.supplyingCoopNameUnmatched ?? null,
        })
        .eq('id', farmId)

      if (updateError) {
        // Non-fatal — the farm and account already exist successfully.
        console.error('Failed to save supplying-cooperative fields:', updateError)
      }
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
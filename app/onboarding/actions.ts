'use server'

import { createClient } from '@/lib/supabase/server'
import { Enterprise, CreateFarmParams, FarmCreationResult } from '@/lib/create-farm'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function createFarmAction(params: CreateFarmParams): Promise<FarmCreationResult> {
  const supabaseAuth = await createClient()

  // Use service role to bypass RLS for initial provisioning
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
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
      return { success: false, error: rpcError.message }
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
      error: error.message || 'Unknown error',
    }
  }
}

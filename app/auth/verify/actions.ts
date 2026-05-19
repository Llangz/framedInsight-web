'use server'

import { createClient } from '@supabase/supabase-js'
import { Enterprise, FarmCreationResult } from '@/lib/create-farm'
import { revalidatePath } from 'next/cache'

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
}

export async function createFarmOnVerifyAction(params: VerifyFarmParams): Promise<FarmCreationResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables for admin client')
    return { success: false, error: 'Server misconfiguration.' }
  }

  // Use service role key to bypass RLS for this multi-table creation flow.
  // This prevents the chicken-and-egg problem where the user can't select the farm they just created
  // because they haven't been added to farm_managers yet.
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // 1. Call the secure RPC function to create farm and manager association
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

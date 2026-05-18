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
    // 1. Create farm record
    const { data: farm, error: farmError } = await supabaseAdmin
      .from('farms')
      .insert({
        farm_name: params.farmName,
        owner_name: params.ownerName,
        phone: params.phone,
        county: params.county,
        sub_county: params.subCounty || null,
        ward: params.ward || null,
        is_active: true,
        subscription_tier: 'smallholder',
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        farm_types: params.farmTypes,
        primary_enterprise: params.primaryEnterprise,
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

    // 2. Link user to farm
    const { error: managerError } = await supabaseAdmin
      .from('farm_managers')
      .insert({
        user_id: params.userId,
        farm_id: farm.id,
        role: 'owner',
        created_at: new Date().toISOString(),
      })

    if (managerError) {
      console.error('Error creating farm_manager:', managerError)
      await supabaseAdmin.from('farms').delete().eq('id', farm.id)
      return { success: false, error: managerError.message }
    }

    revalidatePath('/dashboard')
    return { success: true, farmId: farm.id }
  } catch (error: any) {
    console.error('Unexpected error creating farm:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

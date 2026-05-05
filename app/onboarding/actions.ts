'use server'

import { createClient } from '@/lib/supabase/server'
import { Enterprise, CreateFarmParams, FarmCreationResult } from '@/lib/create-farm'
import { revalidatePath } from 'next/cache'

export async function createFarmAction(params: CreateFarmParams): Promise<FarmCreationResult> {
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

    // 2. Link user to farm
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
      await supabase.from('farms').delete().eq('id', farm.id)
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

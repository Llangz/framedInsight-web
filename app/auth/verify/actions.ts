'use server'

import { createClient } from '@/lib/supabase/server'
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

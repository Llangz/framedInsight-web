'use server'

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'

interface CreateFactoryParams {
  factoryName: string
  factoryCode?: string
  branchType: 'washing_station' | 'milk_cooling_plant' | 'poultry_collection_point' | 'other'
}

export async function createFactory(params: CreateFactoryParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false, error: 'Unauthorized' }
  }

  if (!params.factoryName.trim()) {
    return { success: false, error: 'Factory name is required' }
  }

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('coop_factories')
      .insert({
        cooperative_id: access.coopId,
        factory_name: params.factoryName.trim(),
        factory_code: params.factoryCode?.trim() || null,
        branch_type: params.branchType,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating factory:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/cooperative/factories')
    revalidatePath('/dashboard/cooperative/farmers/new')
    return { success: true, factory: data }
  } catch (error: any) {
    return { success: false, error: error.message || 'Server error' }
  }
}

export async function deleteFactory(id: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  try {
    // Before deleting, verify this factory belongs to the user's cooperative
    const { data: factory } = await supabase
      .from('coop_factories')
      .select('cooperative_id')
      .eq('id', id)
      .single()

    if (!factory || factory.cooperative_id !== access.coopId) {
      return { success: false, error: 'Factory not found or unauthorized' }
    }

    // Set factory_id to null on associated farms automatically (via DB REFERENCES ON DELETE SET NULL)
    const { error } = await supabase
      .from('coop_factories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting factory:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/cooperative/factories')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Server error' }
  }
}

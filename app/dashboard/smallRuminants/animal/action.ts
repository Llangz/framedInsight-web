'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from '@/lib/database.types'

type AnimalUpdate = Database['public']['Tables']['small_ruminants']['Update']

export async function updateAnimal(
  animalId: string,
  updates: Omit<AnimalUpdate, 'farm_id' | 'id'>
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) throw new Error('Farm profile not found')

  // Ownership check: only update if this animal belongs to the user's farm
  const { error } = await supabase
    .from('small_ruminants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', animalId)
    .eq('farm_id', farmManager.farm_id)

  if (error) throw error

  revalidatePath('/dashboard/smallRuminants')
  revalidatePath(`/dashboard/smallRuminants/animal/${animalId}`)
  return { success: true }
}

export async function deleteAnimal(animalId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) throw new Error('Farm profile not found')

  const { error } = await supabase
    .from('small_ruminants')
    .delete()
    .eq('id', animalId)
    .eq('farm_id', farmManager.farm_id)

  if (error) throw error

  revalidatePath('/dashboard/smallRuminants')
  return { success: true }
}
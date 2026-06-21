'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from '@/lib/database.types'

type CowUpdate = Database['public']['Tables']['cows']['Update']

export async function updateCow(
  cowId: string,
  updates: Omit<CowUpdate, 'farm_id' | 'id'>
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) throw new Error('Farm profile not found')

  const { error } = await supabase
    .from('cows')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', cowId)
    .eq('farm_id', farmManager.farm_id)

  if (error) throw error

  revalidatePath('/dashboard/dairy/cows')
  revalidatePath(`/dashboard/dairy/cows/${cowId}`)
  revalidatePath('/dashboard/dairy/herd')
  return { success: true }
}

export async function deleteCow(cowId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) throw new Error('Farm profile not found')

  const { error } = await supabase
    .from('cows')
    .delete()
    .eq('id', cowId)
    .eq('farm_id', farmManager.farm_id)

  if (error) throw error

  revalidatePath('/dashboard/dairy/cows')
  revalidatePath('/dashboard/dairy/herd')
  return { success: true }
}
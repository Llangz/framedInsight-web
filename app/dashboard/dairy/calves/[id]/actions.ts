'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getOwnedCalf(supabase: any, calfId: string, farmId: string) {
  const { data: calf } = await supabase
    .from('calves')
    .select('*, dam:cows!calves_dam_id_fkey(id, farm_id, cow_tag, breed, name)')
    .eq('id', calfId)
    .maybeSingle()

  // calves has no farm_id of its own — ownership is proven only through
  // its dam belonging to this farm. No dam, or a dam on another farm,
  // means this calf isn't this user's to touch.
  if (!calf || !calf.dam || calf.dam.farm_id !== farmId) {
    return null
  }
  return calf
}

async function currentFarmId(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()
  return farmManager?.farm_id ?? null
}

export async function recordWeaning(calfId: string, input: { weaning_date: string; weaning_weight?: string | number | null }) {
  const supabase = await createClient()
  const farmId = await currentFarmId(supabase)
  if (!farmId) return { success: false, error: 'Not authenticated' }

  const calf = await getOwnedCalf(supabase, calfId, farmId)
  if (!calf) return { success: false, error: 'Calf not found on your farm' }

  const { error } = await supabase
    .from('calves')
    .update({
      weaning_date: input.weaning_date || null,
      weaning_weight: input.weaning_weight ? parseFloat(String(input.weaning_weight)) : null,
      status: 'weaned',
    })
    .eq('id', calfId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/dairy')
  revalidatePath('/dashboard/dairy/calves')
  revalidatePath(`/dashboard/dairy/calves/${calfId}`)
  return { success: true }
}

// A weaned heifer calf that's ready to join the milking herd gets its own
// `cows` row (that's the only table the rest of the app — milk records,
// health, breeding — actually reads from). The calves row is kept, not
// deleted, as the permanent birth/rearing history, and gets linked via
// cow_id and marked 'promoted' so it drops out of the "in development"
// counts. Male calves aren't promoted here — in Kenyan smallholder dairy
// systems they're typically sold young rather than joining the milking
// herd, and that's a separate event (updateCalfStatus below), not an
// assumption this action should make on the farmer's behalf.
export async function promoteToHerd(calfId: string) {
  const supabase = await createClient()
  const farmId = await currentFarmId(supabase)
  if (!farmId) return { success: false, error: 'Not authenticated' }

  const calf = await getOwnedCalf(supabase, calfId, farmId)
  if (!calf) return { success: false, error: 'Calf not found on your farm' }
  if (calf.cow_id) return { success: false, error: 'This calf has already been promoted' }
  if (calf.sex === 'male') {
    return { success: false, error: 'Male calves are recorded as sold, not promoted — use "Mark as sold" instead' }
  }

  const cowTag = `CALF-${calf.id.slice(0, 8)}`

  const { data: newCow, error: cowError } = await supabase
    .from('cows')
    .insert({
      farm_id: farmId,
      cow_tag: cowTag,
      breed: calf.dam?.breed || null,
      birth_date: calf.birth_date,
      sex: calf.sex,
      dam_id: calf.dam_id,
      source: 'born on farm',
      status: 'heifer',
      notes: calf.notes || null,
    })
    .select('id')
    .single()

  if (cowError || !newCow) {
    return { success: false, error: cowError?.message || 'Could not create herd record' }
  }

  const { error: updateError } = await supabase
    .from('calves')
    .update({ cow_id: newCow.id, status: 'promoted' })
    .eq('id', calfId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath('/dashboard/dairy')
  revalidatePath('/dashboard/dairy/calves')
  revalidatePath('/dashboard/dairy/herd')
  return { success: true, cowId: newCow.id }
}

// For calves that leave the farm without ever joining the milking herd —
// most commonly a male calf sold young, or a loss. Doesn't touch `cows`
// at all, just the calf's own record.
export async function updateCalfStatus(calfId: string, status: 'sold' | 'deceased') {
  const supabase = await createClient()
  const farmId = await currentFarmId(supabase)
  if (!farmId) return { success: false, error: 'Not authenticated' }

  const calf = await getOwnedCalf(supabase, calfId, farmId)
  if (!calf) return { success: false, error: 'Calf not found on your farm' }

  const { error } = await supabase.from('calves').update({ status }).eq('id', calfId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/dairy')
  revalidatePath('/dashboard/dairy/calves')
  revalidatePath(`/dashboard/dairy/calves/${calfId}`)
  return { success: true }
}

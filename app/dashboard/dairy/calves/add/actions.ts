'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface RecordCalfBirthInput {
  dam_id: string
  sex?: string | null
  birth_date: string
  birth_weight?: string | number | null
  sire_code?: string | null
  notes?: string | null
}

export async function recordCalfBirth(input: RecordCalfBirthInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) {
    return { success: false, error: 'No farm linked to this account' }
  }

  // calves has no farm_id column of its own and no tracked RLS migration in
  // this repo, so ownership is enforced here explicitly rather than trusted
  // to a policy we can't verify from the codebase — confirm the chosen dam
  // actually belongs to this farm before inserting anything against it.
  const { data: dam, error: damError } = await supabase
    .from('cows')
    .select('id, farm_id')
    .eq('id', input.dam_id)
    .eq('farm_id', farmManager.farm_id)
    .maybeSingle()

  if (damError || !dam) {
    return { success: false, error: 'Selected dam was not found on your farm' }
  }

  if (!input.birth_date) {
    return { success: false, error: 'Birth date is required' }
  }

  const { error: insertError } = await supabase.from('calves').insert({
    dam_id: input.dam_id,
    sex: input.sex || null,
    birth_date: input.birth_date,
    birth_weight: input.birth_weight ? parseFloat(String(input.birth_weight)) : null,
    sire_code: input.sire_code || null,
    notes: input.notes || null,
    status: 'nursing',
  })

  if (insertError) {
    // See coffee/activities/actions.ts's recordActivity for why the raw
    // error message is surfaced directly instead of thrown — Next.js
    // redacts thrown-error messages in production.
    return { success: false, error: insertError.message }
  }

  revalidatePath('/dashboard/dairy')
  revalidatePath('/dashboard/dairy/calves')

  return { success: true }
}

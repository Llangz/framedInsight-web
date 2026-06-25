'use server'

/**
 * app/dashboard/cooperative/passports/[passportId]/actions.ts
 *
 * Saves enrichment edits to a passport's JSON blobs.
 * Merges the officer's additions into the existing auto-assembled data
 * rather than replacing it, so no auto-assembled field is ever lost.
 */

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/lib/database.types'

interface SavePassportEditsParams {
  passportId: string
  coopId: string
  publicStoryPatch:          Record<string, unknown>
  qualityMetricsPatch:       Record<string, unknown>
  sustainabilityMetricsPatch: Record<string, unknown>
}

export async function savePassportEditsAction(
  params: SavePassportEditsParams
): Promise<{ success: boolean; error?: string }> {
  const access = await validateCoopAccess()
  if (!access.success || access.coopId !== params.coopId) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Fetch existing blobs so we can merge rather than overwrite
  const { data: existing, error: fetchError } = await supabase
    .from('coffee_passports')
    .select('public_story, quality_metrics, sustainability_metrics')
    .eq('id', params.passportId)
    .eq('cooperative_id', params.coopId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Passport not found' }
  }

  // Remove undefined values from patches so they don't overwrite existing data
  const clean = (obj: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

  const merged = {
    public_story:           { ...(existing.public_story as object ?? {}),           ...clean(params.publicStoryPatch) } as unknown as Json,
    quality_metrics:        { ...(existing.quality_metrics as object ?? {}),        ...clean(params.qualityMetricsPatch) } as unknown as Json,
    sustainability_metrics: { ...(existing.sustainability_metrics as object ?? {}), ...clean(params.sustainabilityMetricsPatch) } as unknown as Json,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('coffee_passports')
    .update(merged)
    .eq('id', params.passportId)
    .eq('cooperative_id', params.coopId)

  if (error) {
    console.error('savePassportEditsAction error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/cooperative/passports/${params.passportId}`)
  revalidatePath('/dashboard/cooperative/passports')
  revalidatePath(`/trace/${params.passportId}`) // bust the public cache
  return { success: true }
}
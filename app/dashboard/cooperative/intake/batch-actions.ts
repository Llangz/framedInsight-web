'use server'

/**
 * app/dashboard/cooperative/intake/batch-actions.ts
 *
 * Creates a processing_batch from a closed factory_intake_lot.
 * This is the bridge from the intake custody record into the
 * passport chain (batch → mill_lot → export_lot → passport).
 */

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'
import { writeTraceabilityEvent } from '@/lib/passport/passport.service'

export interface CreateProcessingBatchParams {
  intakeLotId: string
  fermentationTank?: string
  pulpingStartTime?: string
  waterSource?: 'river' | 'borehole' | 'other'
}

export async function createProcessingBatch(params: CreateProcessingBatchParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Fetch the intake lot with factory info
  const { data: lot } = await supabase
    .from('factory_intake_lots')
    .select(`
      *,
      coop_factories (factory_code, factory_name)
    `)
    .eq('id', params.intakeLotId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!lot) return { success: false as const, error: 'Lot not found' }

  const factory = lot.coop_factories as any
  const batchNumber = `${lot.lot_number}-B`

  const { data: batch, error } = await supabase
    .from('processing_batches')
    .insert({
      batch_number: batchNumber,
      intake_lot_id: params.intakeLotId,
      factory_id: lot.factory_id,
      cooperative_id: access.coopId,
      intake_date: lot.intake_date,
      total_cherry_kg: lot.total_cherry_kg,
      total_mbuni_kg: lot.total_mbuni_kg ?? 0,
      rejected_kg: lot.rejected_kg ?? 0,
      total_farmers: lot.total_farmers,
      season: lot.season,
      harvest_year: lot.harvest_year,
      fermentation_tank: params.fermentationTank ?? null,
      pulping_start_time: params.pulpingStartTime ?? null,
      water_source: params.waterSource ?? null,
      clerk_name: lot.clerk_name,
      status: 'pulping',
    })
    .select()
    .single()

  if (error) {
    console.error('createProcessingBatch error:', error)
    return { success: false as const, error: error.message }
  }

  // Update intake lot status to 'processing'
  await supabase
    .from('factory_intake_lots')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', params.intakeLotId)

  // Write to traceability ledger
  await writeTraceabilityEvent({
    entityType: 'processing_batch',
    entityId: batch.id,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    actorName: lot.clerk_name ?? 'officer',
    eventType: 'batch_created',
    eventData: {
      batch_number: batchNumber,
      intake_lot_id: params.intakeLotId,
      lot_number: lot.lot_number,
      total_cherry_kg: lot.total_cherry_kg,
      total_farmers: lot.total_farmers,
      factory: factory?.factory_name,
    },
  })

  revalidatePath('/dashboard/cooperative/intake')
  return { success: true as const, batch }
}

export interface UpdateBatchProcessingParams {
  batchId: string
  fermentationStartTime?: string
  fermentationEndTime?: string
  fermentationHours?: number
  washingDate?: string
  dryingStartDate?: string
  dryingMethod?: string
  parchmentKg?: number
  moistureContentPct?: number
  dryingDays?: number
  status?: 'fermenting' | 'washing' | 'drying' | 'milled'
  notes?: string
}

export async function updateBatchProcessing(params: UpdateBatchProcessingParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: batch } = await supabase
    .from('processing_batches')
    .select('id, cooperative_id, total_cherry_kg')
    .eq('id', params.batchId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!batch) return { success: false as const, error: 'Batch not found' }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (params.fermentationStartTime !== undefined) updates.fermentation_start_time = params.fermentationStartTime
  if (params.fermentationEndTime !== undefined) updates.fermentation_end_time = params.fermentationEndTime
  if (params.fermentationHours !== undefined) updates.fermentation_hours = params.fermentationHours
  if (params.washingDate !== undefined) updates.washing_date = params.washingDate
  if (params.dryingStartDate !== undefined) updates.drying_start_date = params.dryingStartDate
  if (params.dryingMethod !== undefined) updates.drying_method = params.dryingMethod
  if (params.moistureContentPct !== undefined) updates.moisture_content_pct = params.moistureContentPct
  if (params.dryingDays !== undefined) updates.drying_days = params.dryingDays
  if (params.status !== undefined) updates.status = params.status
  if (params.notes !== undefined) updates.notes = params.notes

  if (params.parchmentKg !== undefined) {
    updates.parchment_kg = params.parchmentKg
    const cherry = batch.total_cherry_kg ?? 0
    if (cherry > 0) {
      updates.outturn_ratio = Math.round((params.parchmentKg / cherry) * 10000) / 10000
    }
  }

  const { data, error } = await supabase
    .from('processing_batches')
    .update(updates)
    .eq('id', params.batchId)
    .select()
    .single()

  if (error) return { success: false as const, error: error.message }

  // Ledger event for status transitions
  if (params.status) {
    await writeTraceabilityEvent({
      entityType: 'processing_batch',
      entityId: params.batchId,
      cooperativeId: access.coopId,
      actorUserId: access.userId,
      eventType: `status_changed_to_${params.status}`,
      eventData: {
        status: params.status,
        parchment_kg: params.parchmentKg ?? null,
        outturn_ratio: updates.outturn_ratio ?? null,
        fermentation_hours: params.fermentationHours ?? null,
      },
    })
  }

  revalidatePath('/dashboard/cooperative/intake')
  return { success: true as const, batch: data }
}
'use server'

/**
 * app/dashboard/cooperative/intake/mill-lots/actions.ts
 *
 * Mill lots aggregate one or more processing batches (parchment, post-drying)
 * into a single dry-mill run that produces clean, export-grade coffee.
 * This is the bridge from processing_batches into export_lots → passports.
 */

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'
import { writeTraceabilityEvent } from '@/lib/passport/passport.service'
import { buildMillLotNumber } from '@/lib/intake.types'

// ── Processing batches eligible to be milled ─────────────────────────────────
// status = 'milled' (dried, ready for the dry mill) AND not already
// consumed into a mill lot for this cooperative.

export async function getMillableBatches() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) return { batches: [] }

  const supabase = await createClient()

  const { data: coopMillLots } = await supabase
    .from('mill_lots')
    .select('id')
    .eq('cooperative_id', access.coopId)

  const millLotIds = (coopMillLots ?? []).map(m => m.id)
  let linkedBatchIds: string[] = []

  if (millLotIds.length > 0) {
    const { data: linked } = await supabase
      .from('mill_lot_batches')
      .select('processing_batch_id')
      .in('mill_lot_id', millLotIds)
    linkedBatchIds = (linked ?? []).map(l => l.processing_batch_id)
  }

  const { data: batches, error } = await supabase
    .from('processing_batches')
    .select(`
      *,
      factory_intake_lots ( lot_number, coop_factories ( factory_name, factory_code ) )
    `)
    .eq('cooperative_id', access.coopId)
    .eq('status', 'milled')
    .order('intake_date', { ascending: false })

  if (error) {
    console.error('getMillableBatches error:', error)
    return { batches: [] }
  }

  const eligible = (batches ?? []).filter(b => !linkedBatchIds.includes(b.id))
  return { batches: eligible }
}

// ── Fetch all mill lots for this cooperative (list page) ────────────────────

export async function getMillLots() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', millLots: [] }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mill_lots')
    .select(`
      *,
      mill_lot_batches ( id, parchment_kg_contributed, processing_batch_id )
    `)
    .eq('cooperative_id', access.coopId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getMillLots error:', error)
    return { success: false as const, error: error.message, millLots: [] }
  }

  return { success: true as const, millLots: data ?? [] }
}

// ── Create a mill lot from selected, milled processing batches ──────────────

export interface CreateMillLotParams {
  batchIds: string[]
  millName?: string
  millingDate: string
  cleanCoffeeKgOut: number
  moistureContentPct?: number
  nceTransactionId?: string
  nceAuctionDate?: string
  ncePriceUsdPerKg?: number
  notes?: string
}

export async function createMillLot(params: CreateMillLotParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  if (params.batchIds.length === 0) {
    return { success: false as const, error: 'Select at least one processing batch' }
  }

  const supabase = await createClient()

  // Re-verify server-side: never trust the client's eligibility filtering.
  const { data: batches, error: batchError } = await supabase
    .from('processing_batches')
    .select('id, cooperative_id, status, parchment_kg, batch_number')
    .in('id', params.batchIds)
    .eq('cooperative_id', access.coopId)

  if (batchError || !batches || batches.length !== params.batchIds.length) {
    return { success: false as const, error: 'One or more batches not found or unauthorized' }
  }

  const notMilled = batches.find(b => b.status !== 'milled')
  if (notMilled) {
    return { success: false as const, error: `Batch ${notMilled.batch_number} is not yet at 'milled' status` }
  }

  const { data: existingLinks } = await supabase
    .from('mill_lot_batches')
    .select('processing_batch_id')
    .in('processing_batch_id', params.batchIds)

  if (existingLinks && existingLinks.length > 0) {
    return { success: false as const, error: 'One or more batches are already linked to a mill lot' }
  }

  const totalParchmentKg = batches.reduce((s, b) => s + (b.parchment_kg ?? 0), 0)
  const millingOutturnRatio = totalParchmentKg > 0
    ? Math.round((params.cleanCoffeeKgOut / totalParchmentKg) * 10000) / 10000
    : null

  // Sequential mill lot number, scoped to this cooperative + calendar year
  const year = new Date(params.millingDate).getFullYear()
  const { count } = await supabase
    .from('mill_lots')
    .select('id', { count: 'exact', head: true })
    .eq('cooperative_id', access.coopId)
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)

  const millLotNumber = buildMillLotNumber(year, (count ?? 0) + 1)

  const { data: millLot, error } = await supabase
    .from('mill_lots')
    .insert({
      mill_lot_number: millLotNumber,
      cooperative_id: access.coopId,
      total_parchment_kg_in: totalParchmentKg,
      clean_coffee_kg_out: params.cleanCoffeeKgOut,
      milling_outturn_ratio: millingOutturnRatio,
      mill_name: params.millName?.trim() || null,
      milling_date: params.millingDate,
      moisture_content_pct: params.moistureContentPct ?? null,
      nce_transaction_id: params.nceTransactionId?.trim() || null,
      nce_auction_date: params.nceAuctionDate || null,
      nce_price_usd_per_kg: params.ncePriceUsdPerKg ?? null,
      notes: params.notes?.trim() || null,
      status: 'milled',
    })
    .select()
    .single()

  if (error || !millLot) {
    console.error('createMillLot error:', error)
    return { success: false as const, error: error?.message ?? 'Failed to create mill lot' }
  }

  // Link the contributing batches — each contributes its full parchment weight.
  const links = batches.map(b => ({
    mill_lot_id: millLot.id,
    processing_batch_id: b.id,
    parchment_kg_contributed: b.parchment_kg ?? 0,
  }))

  const { error: linkError } = await supabase.from('mill_lot_batches').insert(links)
  if (linkError) {
    console.error('createMillLot link error:', linkError)
    return { success: false as const, error: `Mill lot created but batch linking failed: ${linkError.message}` }
  }

  await writeTraceabilityEvent({
    entityType: 'mill_lot',
    entityId: millLot.id,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    eventType: 'mill_lot_created',
    eventData: {
      mill_lot_number: millLotNumber,
      batch_count: batches.length,
      batch_numbers: batches.map(b => b.batch_number),
      total_parchment_kg_in: totalParchmentKg,
      clean_coffee_kg_out: params.cleanCoffeeKgOut,
      milling_outturn_ratio: millingOutturnRatio,
    },
  })

  revalidatePath('/dashboard/cooperative/intake/mill-lots')
  return { success: true as const, millLot }
}
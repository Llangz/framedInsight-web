'use server'

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'
import {
  FactoryIntakeLotInsert,
  LotFarmerDeliveryInsert,
  FactoryIntakeLotUpdate,
  buildLotNumber,
  getCurrentSeason,
  getCurrentHarvestYear,
} from '@/lib/intake.types'

// ── Create a new factory intake lot ─────────────────────────────────────────

export interface CreateIntakeLotParams {
  factoryId: string
  intakeDate: string              // ISO date string
  season?: 'main' | 'fly'
  harvestYear?: number
  clerkName?: string
  notes?: string
}

export async function createIntakeLot(params: CreateIntakeLotParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Verify the factory belongs to this cooperative
  const { data: factory, error: factoryError } = await supabase
    .from('coop_factories')
    .select('id, factory_code, factory_name')
    .eq('id', params.factoryId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (factoryError || !factory) {
    return { success: false as const, error: 'Factory not found or unauthorized' }
  }

  if (!factory.factory_code) {
    return {
      success: false as const,
      error: 'This factory has no traceability code. Add one in Washing Stations settings before recording intake.',
    }
  }

  const season = params.season ?? getCurrentSeason()
  const harvestYear = params.harvestYear ?? getCurrentHarvestYear()

  // Get next sequence number for this factory + season + year
  const { count } = await supabase
    .from('factory_intake_lots')
    .select('id', { count: 'exact', head: true })
    .eq('factory_id', params.factoryId)
    .eq('harvest_year', harvestYear)
    .eq('season', season)

  const sequence = (count ?? 0) + 1
  const lotNumber = buildLotNumber(factory.factory_code, season, harvestYear, sequence)

  const insert: FactoryIntakeLotInsert = {
    lot_number: lotNumber,
    factory_id: params.factoryId,
    cooperative_id: access.coopId,
    intake_date: params.intakeDate,
    season,
    harvest_year: harvestYear,
    status: 'open',
    clerk_name: params.clerkName?.trim() || null,
    notes: params.notes?.trim() || null,
  }

  const { data: lot, error } = await supabase
    .from('factory_intake_lots')
    .insert(insert)
    .select()
    .single()

  if (error) {
    console.error('createIntakeLot error:', error)
    return { success: false as const, error: error.message }
  }

  revalidatePath('/dashboard/cooperative/intake')
  return { success: true as const, lot }
}

// ── Add a single farmer delivery to an open lot ──────────────────────────────

export interface AddDeliveryParams {
  lotId: string
  farmId: string
  cherryKg: number
  mbuniKg?: number
  rejectedKg?: number
  receiptNumber?: string
  deliveryDate: string
  qualityGrade?: string
  cherryCondition?: string
  accepted?: boolean
  rejectionReason?: string
  plotId?: string
  harvestId?: string
}

export async function addDeliveryToLot(params: AddDeliveryParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Verify the lot belongs to this cooperative and is open
  const { data: lot, error: lotError } = await supabase
    .from('factory_intake_lots')
    .select('id, status, cooperative_id, total_cherry_kg, total_mbuni_kg, total_farmers')
    .eq('id', params.lotId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (lotError || !lot) {
    return { success: false as const, error: 'Lot not found or unauthorized' }
  }

  if (lot.status !== 'open') {
    return { success: false as const, error: `Lot is ${lot.status} — deliveries can only be added to open lots` }
  }

  // Verify the farm belongs to this cooperative
  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .select('id')
    .eq('id', params.farmId)
    .eq('managed_by_coop_id', access.coopId)
    .single()

  if (farmError || !farm) {
    return { success: false as const, error: 'Farm not found or not a member of this cooperative' }
  }

  const delivery: LotFarmerDeliveryInsert = {
    lot_id: params.lotId,
    farm_id: params.farmId,
    harvest_id: params.harvestId ?? null,
    farmer_cherry_kg: params.cherryKg,
    farmer_mbuni_kg: params.mbuniKg ?? 0,
    receipt_number: params.receiptNumber?.trim() || null,
    delivery_date: params.deliveryDate,
    quality_grade: params.qualityGrade ?? 'AB',
    cherry_condition: params.cherryCondition ?? 'red_ripe',
    accepted: params.accepted ?? true,
    rejection_reason: params.rejectionReason?.trim() || null,
    plot_id: params.plotId ?? null,
  }

  const { data: deliveryRow, error: deliveryError } = await supabase
    .from('lot_farmer_deliveries')
    .insert(delivery)
    .select()
    .single()

  if (deliveryError) {
    console.error('addDeliveryToLot error:', deliveryError)
    return { success: false as const, error: deliveryError.message }
  }

  // Update lot totals atomically
  const newCherry = (lot.total_cherry_kg ?? 0) + (params.accepted !== false ? params.cherryKg : 0)
  const newMbuni = (lot.total_mbuni_kg ?? 0) + (params.accepted !== false ? (params.mbuniKg ?? 0) : 0)
  const newFarmers = (lot.total_farmers ?? 0) + 1

  await supabase
    .from('factory_intake_lots')
    .update({
      total_cherry_kg: newCherry,
      total_mbuni_kg: newMbuni,
      total_farmers: newFarmers,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.lotId)

  // If farm also has a corresponding coffee_harvest record, link nce/lot data back
  if (params.harvestId) {
    await supabase
      .from('coffee_harvests')
      .update({ lot_number: lot.id })   // stores the lot UUID for now; replaced by lot_number text on trace page
      .eq('id', params.harvestId)
      .eq('farm_id', params.farmId)
  }

  revalidatePath(`/dashboard/cooperative/intake/${params.lotId}`)
  revalidatePath('/dashboard/cooperative/intake')
  return { success: true as const, delivery: deliveryRow }
}

// ── Update processing record (post-pulping stage) ────────────────────────────

export interface UpdateProcessingParams {
  lotId: string
  processingStartDate?: string
  fermentationHours?: number
  parchmentKg?: number
  moistureContentPct?: number
  dryingDays?: number
  nceTransactionId?: string
  status?: 'processing' | 'milled' | 'exported' | 'closed'
  notes?: string
}

export async function updateLotProcessing(params: UpdateProcessingParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: lot } = await supabase
    .from('factory_intake_lots')
    .select('id, total_cherry_kg')
    .eq('id', params.lotId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!lot) return { success: false as const, error: 'Lot not found' }

  const updates: FactoryIntakeLotUpdate = {
    updated_at: new Date().toISOString(),
  }

  if (params.processingStartDate !== undefined) updates.processing_start_date = params.processingStartDate
  if (params.fermentationHours !== undefined) updates.fermentation_hours = params.fermentationHours
  if (params.moistureContentPct !== undefined) updates.moisture_content_pct = params.moistureContentPct
  if (params.dryingDays !== undefined) updates.drying_days = params.dryingDays
  if (params.nceTransactionId !== undefined) updates.nce_transaction_id = params.nceTransactionId
  if (params.status !== undefined) updates.status = params.status
  if (params.notes !== undefined) updates.notes = params.notes

  if (params.parchmentKg !== undefined) {
    updates.parchment_kg = params.parchmentKg
    // Compute outturn ratio
    const cherry = lot.total_cherry_kg ?? 0
    if (cherry > 0) {
      updates.outturn_ratio = Math.round((params.parchmentKg / cherry) * 1000) / 1000
    }
  }

  const { data, error } = await supabase
    .from('factory_intake_lots')
    .update(updates)
    .eq('id', params.lotId)
    .select()
    .single()

  if (error) {
    console.error('updateLotProcessing error:', error)
    return { success: false as const, error: error.message }
  }

  revalidatePath(`/dashboard/cooperative/intake/${params.lotId}`)
  revalidatePath('/dashboard/cooperative/intake')
  return { success: true as const, lot: data }
}

// ── Fetch all lots for this cooperative (list page) ──────────────────────────

export async function getIntakeLots() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', lots: [] }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('factory_intake_lots')
    .select(`
      *,
      coop_factories (factory_name, factory_code)
    `)
    .eq('cooperative_id', access.coopId)
    .order('intake_date', { ascending: false })

  if (error) {
    console.error('getIntakeLots error:', error)
    return { success: false as const, error: error.message, lots: [] }
  }

  return { success: true as const, lots: data ?? [] }
}

// ── Fetch a single lot with all deliveries ───────────────────────────────────

export async function getIntakeLotDetail(lotId: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', lot: null }
  }

  const supabase = await createClient()

  const { data: lot, error: lotError } = await supabase
    .from('factory_intake_lots')
    .select(`
      *,
      coop_factories (factory_name, factory_code)
    `)
    .eq('id', lotId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (lotError || !lot) {
    return { success: false as const, error: 'Lot not found', lot: null }
  }

  const { data: deliveries, error: deliveriesError } = await supabase
    .from('lot_farmer_deliveries')
    .select(`
      *,
      farms (farm_name, owner_name, phone),
      coffee_plots (plot_name, variety)
    `)
    .eq('lot_id', lotId)
    .order('created_at', { ascending: false })

  if (deliveriesError) {
    console.error('getIntakeLotDetail deliveries error:', deliveriesError)
  }

  return {
    success: true as const,
    lot,
    deliveries: deliveries ?? [],
  }
}

// ── Fetch cooperative's member farms for delivery form autocomplete ───────────

export async function getCoopMemberFarms() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) return { farms: [] }

  const supabase = await createClient()

  const { data } = await supabase
    .from('farms')
    .select('id, farm_name, owner_name, phone, coop_factory_id')
    .eq('managed_by_coop_id', access.coopId)
    .order('owner_name')

  return { farms: data ?? [] }
}

// ── Fetch factories for this cooperative ─────────────────────────────────────

export async function getCoopFactories() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) return { factories: [] }

  const supabase = await createClient()

  const { data } = await supabase
    .from('coop_factories')
    .select('id, factory_name, factory_code, branch_type')
    .eq('cooperative_id', access.coopId)
    .order('factory_name')

  return { factories: data ?? [] }
}
'use server'

/**
 * app/dashboard/cooperative/intake/export-lots/actions.ts
 *
 * Export lots aggregate one or more mill lots into a single shipment —
 * the buyer-facing unit that a Coffee Passport ultimately links to via
 * coffee_passports.export_lot_id.
 */

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'
import { writeTraceabilityEvent } from '@/lib/passport/passport.service'
import { buildExportLotNumber } from '@/lib/intake.types'

// ── Mill lots eligible to be exported ────────────────────────────────────────
// status = 'milled' AND not already linked to another export lot.

export async function getExportableMillLots() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) return { millLots: [] }

  const supabase = await createClient()

  const { data: coopExportLots } = await supabase
    .from('export_lots')
    .select('id')
    .eq('cooperative_id', access.coopId)

  const exportLotIds = (coopExportLots ?? []).map(e => e.id)
  let linkedMillLotIds: string[] = []

  if (exportLotIds.length > 0) {
    const { data: linked } = await supabase
      .from('export_lot_mill_lots')
      .select('mill_lot_id')
      .in('export_lot_id', exportLotIds)
    linkedMillLotIds = (linked ?? []).map(l => l.mill_lot_id)
  }

  const { data: millLots, error } = await supabase
    .from('mill_lots')
    .select('*')
    .eq('cooperative_id', access.coopId)
    .eq('status', 'milled')
    .order('milling_date', { ascending: false })

  if (error) {
    console.error('getExportableMillLots error:', error)
    return { millLots: [] }
  }

  const eligible = (millLots ?? []).filter(m => !linkedMillLotIds.includes(m.id))
  return { millLots: eligible }
}

// ── Fetch all export lots for this cooperative (list page) ──────────────────

export async function getExportLots() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', exportLots: [] }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('export_lots')
    .select(`
      *,
      export_lot_mill_lots ( id, clean_kg_allocated, mill_lot_id )
    `)
    .eq('cooperative_id', access.coopId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getExportLots error:', error)
    return { success: false as const, error: error.message, exportLots: [] }
  }

  return { success: true as const, exportLots: data ?? [] }
}

// ── Lightweight list for the "link to passport" picker ──────────────────────

export async function getExportLotOptions() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) return { exportLots: [] }

  const supabase = await createClient()

  const { data } = await supabase
    .from('export_lots')
    .select('id, export_lot_number, status, buyer_name, buyer_country')
    .eq('cooperative_id', access.coopId)
    .order('created_at', { ascending: false })

  return { exportLots: data ?? [] }
}

// ── Create an export lot from selected, milled mill lots ────────────────────

export interface CreateExportLotParams {
  millLotIds: string[]
  exporterName?: string
  buyerName?: string
  buyerCountry?: string
  destinationPort?: string
  originPort?: string
  containerNumber?: string
  billOfLading?: string
  grade?: string
  processingMethod?: string
  netWeightKg?: number
  bagWeightKg?: number
  totalBags?: number
  scaCuppingScore?: number
  fobPriceUsdPerKg?: number
  departureDate?: string
  status?: 'pending' | 'confirmed' | 'shipped' | 'arrived' | 'completed'
  eudrCompliant?: boolean
  eudrDdsReference?: string
  notes?: string
}

export async function createExportLot(params: CreateExportLotParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  if (params.millLotIds.length === 0) {
    return { success: false as const, error: 'Select at least one mill lot' }
  }

  const supabase = await createClient()

  const { data: millLots, error: millError } = await supabase
    .from('mill_lots')
    .select('id, cooperative_id, status, clean_coffee_kg_out, mill_lot_number')
    .in('id', params.millLotIds)
    .eq('cooperative_id', access.coopId)

  if (millError || !millLots || millLots.length !== params.millLotIds.length) {
    return { success: false as const, error: 'One or more mill lots not found or unauthorized' }
  }

  const notMilled = millLots.find(m => m.status !== 'milled')
  if (notMilled) {
    return { success: false as const, error: `Mill lot ${notMilled.mill_lot_number} is not at 'milled' status` }
  }

  const { data: existingLinks } = await supabase
    .from('export_lot_mill_lots')
    .select('mill_lot_id')
    .in('mill_lot_id', params.millLotIds)

  if (existingLinks && existingLinks.length > 0) {
    return { success: false as const, error: 'One or more mill lots are already linked to an export lot' }
  }

  const totalCleanKg = millLots.reduce((s, m) => s + (m.clean_coffee_kg_out ?? 0), 0)
  const netWeightKg = params.netWeightKg ?? totalCleanKg
  const totalValueUsd = (netWeightKg && params.fobPriceUsdPerKg)
    ? Math.round(netWeightKg * params.fobPriceUsdPerKg * 100) / 100
    : null

  // Sequential export lot number, scoped to this cooperative + calendar year
  const year = params.departureDate ? new Date(params.departureDate).getFullYear() : new Date().getFullYear()
  const { count } = await supabase
    .from('export_lots')
    .select('id', { count: 'exact', head: true })
    .eq('cooperative_id', access.coopId)
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)

  const exportLotNumber = buildExportLotNumber(year, (count ?? 0) + 1)

  const { data: exportLot, error } = await supabase
    .from('export_lots')
    .insert({
      export_lot_number: exportLotNumber,
      cooperative_id: access.coopId,
      exporter_name: params.exporterName?.trim() || null,
      buyer_name: params.buyerName?.trim() || null,
      buyer_country: params.buyerCountry?.trim() || null,
      destination_port: params.destinationPort?.trim() || null,
      origin_port: params.originPort?.trim() || 'Mombasa',
      container_number: params.containerNumber?.trim() || null,
      bill_of_lading: params.billOfLading?.trim() || null,
      grade: params.grade || null,
      processing_method: params.processingMethod || 'washed',
      net_weight_kg: netWeightKg,
      bag_weight_kg: params.bagWeightKg ?? 60,
      total_bags: params.totalBags ?? null,
      sca_cupping_score: params.scaCuppingScore ?? null,
      fob_price_usd_per_kg: params.fobPriceUsdPerKg ?? null,
      total_value_usd: totalValueUsd,
      departure_date: params.departureDate || null,
      status: params.status ?? 'pending',
      eudr_compliant: params.eudrCompliant ?? false,
      eudr_dds_reference: params.eudrDdsReference?.trim() || null,
      notes: params.notes?.trim() || null,
    })
    .select()
    .single()

  if (error || !exportLot) {
    console.error('createExportLot error:', error)
    return { success: false as const, error: error?.message ?? 'Failed to create export lot' }
  }

  const links = millLots.map(m => ({
    export_lot_id: exportLot.id,
    mill_lot_id: m.id,
    clean_kg_allocated: m.clean_coffee_kg_out ?? 0,
  }))

  const { error: linkError } = await supabase.from('export_lot_mill_lots').insert(links)
  if (linkError) {
    console.error('createExportLot link error:', linkError)
    return { success: false as const, error: `Export lot created but mill lot linking failed: ${linkError.message}` }
  }

  await writeTraceabilityEvent({
    entityType: 'export_lot',
    entityId: exportLot.id,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    eventType: 'export_lot_created',
    eventData: {
      export_lot_number: exportLotNumber,
      mill_lot_count: millLots.length,
      mill_lot_numbers: millLots.map(m => m.mill_lot_number),
      net_weight_kg: netWeightKg,
      buyer_country: params.buyerCountry ?? null,
      eudr_compliant: params.eudrCompliant ?? false,
      eudr_dds_reference: params.eudrDdsReference ?? null,
    },
  })

  revalidatePath('/dashboard/cooperative/intake/export-lots')
  return { success: true as const, exportLot }
}
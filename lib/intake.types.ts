/**
 * intake.types.ts — framedInsight
 * Local TypeScript types for the factory intake traceability tables.
 * These supplement database.types.ts until `supabase gen types` is re-run
 * against the live schema that includes factory_intake_lots and lot_farmer_deliveries.
 */

// ── factory_intake_lots ──────────────────────────────────────────────────────

export interface FactoryIntakeLotRow {
  id: string
  lot_number: string              // canonical: KRG-MC-2026-0042
  factory_id: string
  cooperative_id: string
  intake_date: string             // ISO date
  season: string | null           // 'main' | 'fly'
  harvest_year: number | null
  total_cherry_kg: number | null
  total_mbuni_kg: number | null
  rejected_kg: number | null
  total_farmers: number | null
  processing_start_date: string | null
  parchment_kg: number | null
  outturn_ratio: number | null    // parchment / cherry  (target 0.18–0.22)
  moisture_content_pct: number | null
  fermentation_hours: number | null
  drying_days: number | null
  nce_transaction_id: string | null
  dds_reference_number: string | null
  traceability_url: string | null
  qr_code_data: string | null
  status: 'open' | 'processing' | 'milled' | 'exported' | 'closed'
  notes: string | null
  clerk_name: string | null
  created_at: string | null
  updated_at: string | null
}

export interface FactoryIntakeLotInsert {
  lot_number: string
  factory_id: string
  cooperative_id: string
  intake_date: string
  season?: string | null
  harvest_year?: number | null
  total_cherry_kg?: number | null
  total_mbuni_kg?: number | null
  rejected_kg?: number | null
  total_farmers?: number | null
  status?: FactoryIntakeLotRow['status']
  notes?: string | null
  clerk_name?: string | null
}

export interface FactoryIntakeLotUpdate {
  processing_start_date?: string | null
  parchment_kg?: number | null
  outturn_ratio?: number | null
  moisture_content_pct?: number | null
  fermentation_hours?: number | null
  drying_days?: number | null
  nce_transaction_id?: string | null
  dds_reference_number?: string | null
  traceability_url?: string | null
  status?: FactoryIntakeLotRow['status']
  notes?: string | null
  updated_at?: string
}

// ── lot_farmer_deliveries ────────────────────────────────────────────────────

export interface LotFarmerDeliveryRow {
  id: string
  lot_id: string
  harvest_id: string | null       // FK → coffee_harvests.id
  farm_id: string
  farmer_cherry_kg: number | null
  farmer_mbuni_kg: number | null
  receipt_number: string | null
  delivery_date: string | null
  quality_grade: string | null    // 'AA' | 'AB' | 'C' | 'TT' | 'E'
  cherry_condition: string | null // 'red_ripe' | 'mixed' | 'unripe' | 'overripe'
  accepted: boolean
  rejection_reason: string | null
  plot_id: string | null          // FK → coffee_plots.id (for traceability)
  created_at: string | null
}

export interface LotFarmerDeliveryInsert {
  lot_id: string
  harvest_id?: string | null
  farm_id: string
  farmer_cherry_kg?: number | null
  farmer_mbuni_kg?: number | null
  receipt_number?: string | null
  delivery_date?: string | null
  quality_grade?: string | null
  cherry_condition?: string | null
  accepted?: boolean
  rejection_reason?: string | null
  plot_id?: string | null
}

// ── Combined view type for intake detail page ────────────────────────────────

export interface IntakeLotWithDeliveries extends FactoryIntakeLotRow {
  deliveries: (LotFarmerDeliveryRow & {
    farm_name: string
    owner_name: string
    phone: string
  })[]
  factory_name: string
  factory_code: string | null
  cooperative_name: string
}

// ── Season helpers ───────────────────────────────────────────────────────────

export function getCurrentSeason(): 'main' | 'fly' {
  const month = new Date().getMonth() + 1 // 1–12
  // Kenya main crop: Oct–Jan; fly crop: Apr–Jul
  return (month >= 10 || month <= 1) ? 'main' : 'fly'
}

export function getCurrentHarvestYear(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  // Main crop year is the calendar year of Oct; fly crop belongs to that same year
  return month >= 10 ? now.getFullYear() : now.getFullYear()
}

/**
 * Generate a canonical lot number.
 * Format: [FACTORY_CODE]-[SEASON_ABBR]-[YEAR]-[SEQUENCE]
 * e.g.  KRG-MC-2026-0042
 */
export function buildLotNumber(
  factoryCode: string,
  season: 'main' | 'fly',
  year: number,
  sequence: number
): string {
  const seasonCode = season === 'main' ? 'MC' : 'FC'
  const seq = String(sequence).padStart(4, '0')
  return `${factoryCode.toUpperCase()}-${seasonCode}-${year}-${seq}`
}
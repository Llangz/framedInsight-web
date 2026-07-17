/**
 * lib/passport/passport.service.ts
 *
 * Core business logic for the Coffee Digital Passport platform.
 * Runs server-side only. Assembles the full chain:
 *   delivery → processing_batch → mill_lot → export_lot → coffee_passport
 *
 * Also writes all traceability_events (the immutable audit ledger).
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { Json, Database } from '@/lib/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computePassportMetrics,
  type PublicStory,
  type SustainabilityMetrics,
  type QualityMetrics,
  type GeoSummary,
  type PassportComputationInput,
} from './passport.metrics'

// Re-exported so existing `import { PublicStory } from '.../passport.service'`
// call sites elsewhere in the app keep working unchanged — the types now
// live in passport.metrics.ts (see that file's header comment for why).
export type { PublicStory, SustainabilityMetrics, QualityMetrics, GeoSummary, PassportComputationInput }
export { computePassportMetrics }

// ── Hash helper ──────────────────────────────────────────────────────────────

const HASH_ALGORITHM = 'v2_canonical' as const

function normalizeForHash(value: unknown): unknown {
  if (value === null) return null

  if (Array.isArray(value)) {
    return value.map(item => {
      const normalized = normalizeForHash(item)
      return normalized === undefined ? null : normalized
    })
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const normalized = normalizeForHash((value as Record<string, unknown>)[key])
      if (normalized !== undefined) sorted[key] = normalized
    }
    return sorted
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForHash(value))
}

function computeHash(
  entityId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  previousHash: string | null,
  createdAt: string
): string {
  const payload = stableStringify({
    entityId,
    eventType,
    eventData,
    previousHash: previousHash ?? 'GENESIS',
    createdAt,
  })
  return createHash('sha256').update(payload).digest('hex')
}

// ── Write a traceability event ───────────────────────────────────────────────

export async function writeTraceabilityEvent({
  entityType,
  entityId,
  cooperativeId,
  actorUserId,
  actorName,
  eventType,
  eventData,
}: {
  entityType: string
  entityId: string
  cooperativeId: string
  actorUserId?: string
  actorName?: string
  eventType: string
  eventData: Record<string, unknown>
}): Promise<void> {
  const supabase = await createClient()
  await writeTraceabilityEventWithClient(supabase as SupabaseClient<Database>, {
    entityType,
    entityId,
    cooperativeId,
    actorUserId,
    actorName,
    eventType,
    eventData,
  })
}

export async function writeTraceabilityEventWithClient(
  supabase: SupabaseClient<Database>,
  {
    entityType,
    entityId,
    cooperativeId,
    actorUserId,
    actorName,
    eventType,
    eventData,
  }: {
    entityType: string
    entityId: string
    cooperativeId: string
    actorUserId?: string
    actorName?: string
    eventType: string
    eventData: Record<string, unknown>
  }
): Promise<void> {

  // Get the previous hash for this entity chain
  const { data: last } = await supabase
    .from('traceability_events')
    .select('current_hash')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousHash = last?.current_hash ?? null
  const now = new Date().toISOString()
  const currentHash = computeHash(entityId, eventType, eventData, previousHash, now)

  await supabase.from('traceability_events').insert({
    entity_type: entityType,
    entity_id: entityId,
    cooperative_id: cooperativeId,
    actor_user_id: actorUserId ?? null,
    actor_name: actorName ?? 'system',
    event_type: eventType,
    event_data: eventData as unknown as Json,
    previous_hash: previousHash,
    current_hash: currentHash,
    hash_algorithm: HASH_ALGORITHM,
    created_at: now,
  })
}

// ── Assemble passport story from the chain ───────────────────────────────────
/**
 * Given a processing_batch_id, walks the full chain upward and downward
 * to auto-generate the passport's public_story, sustainability_metrics,
 * quality_metrics, and geo_summary from existing data in the system.
 *
 * Officers can then edit/enrich these JSON blobs in the passport editor.
 */
export async function assemblePassportPayload(
  processingBatchId: string,
  cooperativeId: string,
  exportLotId?: string
): Promise<{
  publicStory: PublicStory
  sustainabilityMetrics: SustainabilityMetrics
  qualityMetrics: QualityMetrics
  geoSummary: GeoSummary
}> {
  const supabase = await createClient()

  // 1. Processing batch
  const { data: batch } = await supabase
    .from('processing_batches')
    .select(`
      *,
      coop_factories (factory_name, factory_code),
      cooperatives (cooperative_name, county, sub_county, ward)
    `)
    .eq('id', processingBatchId)
    .single()

  if (!batch) throw new Error('Processing batch not found')

  // Export-lot fields are the commercial source of truth for grade/SCA/moisture
  // once a passport is attached to a market lot.
  let exportLot: any = null
  if (exportLotId) {
    const { data } = await supabase
      .from('export_lots')
      .select('grade, processing_method, moisture_content_pct, sca_cupping_score')
      .eq('id', exportLotId)
      .eq('cooperative_id', cooperativeId)
      .maybeSingle()
    exportLot = data
  }

  // 2. Farmer deliveries → farms → plots for this batch via intake_lot
  const { data: deliveries } = await supabase
    .from('lot_farmer_deliveries')
    .select(`
      farm_id, farmer_cherry_kg, plot_id,
      farms (id, owner_name, land_size_acres, gps_latitude, gps_longitude),
      coffee_plots (variety, gps_latitude, gps_longitude, gps_polygon, land_size_acres, eudr_risk_level, area_hectares)
    `)
    .eq('lot_id', batch.intake_lot_id ?? '')
    .eq('accepted', true)

  const deliveryList = deliveries ?? []
  const farmCount = new Set(deliveryList.map(d => d.farm_id)).size

  // 3. EUDR compliance for plots in this batch
  const plotIds = deliveryList.map(d => d.plot_id).filter(Boolean) as string[]
  let eudrRecords: any[] = []
  if (plotIds.length > 0) {
    const { data } = await supabase
      .from('coffee_eudr_compliance')
      .select('risk_level, deforestation_risk, forest_cover_pct, compliance_status')
      .in('plot_id', plotIds)
    eudrRecords = data ?? []
  }

  // 4. Quality records linked to harvest records in this lot
  const harvestIds = deliveryList.map(d => (d as any).harvest_id).filter(Boolean)
  let qualityRecords: any[] = []
  if (harvestIds.length > 0) {
    const { data } = await supabase
      .from('coffee_quality_records')
      .select('*')
      .in('harvest_id', harvestIds)
      .order('cupping_score', { ascending: false })
    qualityRecords = data ?? []
  }

  return computePassportMetrics({ batch, deliveryList, eudrRecords, qualityRecords, exportLot })
}

// ── Create a new passport ────────────────────────────────────────────────────

export async function createPassport({
  cooperativeId,
  processingBatchId,
  exportLotId,
  actorUserId,
  overrides,
}: {
  cooperativeId: string
  processingBatchId: string
  exportLotId?: string
  actorUserId: string
  overrides?: {
    publicStory?: Partial<PublicStory>
    sustainabilityMetrics?: Partial<SustainabilityMetrics>
    qualityMetrics?: Partial<QualityMetrics>
  }
}): Promise<{ passportCode: string; passportId: string }> {
  const supabase = await createClient()

  let passportCode = ''
  let passport: { id: string; passport_code: string } | null = null
  let passportError: Error | null = null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_passport_code', { p_cooperative_id: cooperativeId })

    if (codeError) throw codeError

    passportCode = codeData as string

    const { data: insertedPassport, error: insertError } = await supabase
      .from('coffee_passports')
      .insert({
        cooperative_id: cooperativeId,
        export_lot_id: exportLotId ?? null,
        passport_code: passportCode,
        qr_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://framed-insight-web.vercel.app'}/trace/${passportCode}`,
        status: 'draft',
      })
      .select('id, passport_code')
      .single()

    if (!insertError && insertedPassport) {
      passport = insertedPassport
      break
    }

    if (insertError?.code === '23505') {
      continue
    }

    passportError = new Error(insertError?.message ?? 'Failed to create passport')
    break
  }

  if (!passport || passportError) {
    throw passportError ?? new Error('Unable to create passport after multiple attempts')
  }

  // Assemble the payload from the chain
  const { publicStory, sustainabilityMetrics, qualityMetrics, geoSummary } =
    await assemblePassportPayload(processingBatchId, cooperativeId, exportLotId)

  const mergedStory = { ...publicStory, ...(overrides?.publicStory ?? {}) }
  const mergedSustain = { ...sustainabilityMetrics, ...(overrides?.sustainabilityMetrics ?? {}) }
  const mergedQuality = { ...qualityMetrics, ...(overrides?.qualityMetrics ?? {}) }

  const traceUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://framed-insight-web.vercel.app'}/trace/${passportCode}`

  const { data: updatedPassport, error } = await supabase
    .from('coffee_passports')
    .update({
      qr_url: traceUrl,
      status: 'draft',
      public_story: mergedStory as unknown as Json,
      sustainability_metrics: mergedSustain as unknown as Json,
      quality_metrics: mergedQuality as unknown as Json,
      geo_summary: geoSummary as unknown as Json,
    })
    .eq('id', passport.id)
    .select('id, passport_code')
    .single()

  if (error || !updatedPassport) throw new Error(error?.message ?? 'Failed to create passport')

  passport = updatedPassport

  // Write genesis event to ledger
  await writeTraceabilityEvent({
    entityType: 'coffee_passport',
    entityId: passport.id,
    cooperativeId,
    actorUserId,
    actorName: 'system',
    eventType: 'passport_created',
    eventData: {
      passport_code: passportCode,
      processing_batch_id: processingBatchId,
      export_lot_id: exportLotId ?? null,
      farm_count: mergedStory.farm_count,
      varieties: mergedStory.varieties,
      eudr_compliant: mergedSustain.eudr_compliant,
    },
  })

  return { passportCode, passportId: passport.id }
}

// ── Publish a passport (makes it publicly readable) ──────────────────────────

export async function publishPassport(
  passportId: string,
  cooperativeId: string,
  actorUserId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('coffee_passports')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', passportId)
    .eq('cooperative_id', cooperativeId)

  if (error) throw new Error(error.message)

  await writeTraceabilityEvent({
    entityType: 'coffee_passport',
    entityId: passportId,
    cooperativeId,
    actorUserId,
    eventType: 'passport_published',
    eventData: { published_at: new Date().toISOString() },
  })
}

// ── Fetch a published passport by code (public — no auth required) ────────────

export async function getPublicPassport(passportCode: string) {
  // Use service role key bypass: this is a public read so RLS
  // 'Published passports are publicly readable' policy covers it via anon key
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_passport_chain')
    .select('*')
    .eq('passport_code', passportCode)
    .eq('passport_status', 'published')
    .single()

  // PGRST116 ("no rows") from .single() is the genuine "this code doesn't
  // exist / isn't published" case — the caller correctly renders a 404
  // for that. Any OTHER error code means the fetch itself broke (RLS
  // hiccup, dropped connection, DB blip), and previously collapsed into
  // the exact same `return null` → 404. This is the public, QR-scanned
  // verification page a buyer's compliance team uses to check EUDR
  // provenance before accepting a shipment — a transient failure here
  // must not present as "this passport doesn't exist," which reads as a
  // fraud/data-integrity red flag rather than "try scanning again."
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Could not load passport ${passportCode}: ${error.message}`)
  }
  if (error || !data) return null

  // NOTE: view_count is NOT incremented here.
  // This function runs inside a cached server component (revalidate = 3600),
  // so most page loads are served from the Vercel edge cache and never reach
  // this code path. View counting is handled client-side via
  // POST /api/passport/[passportCode]/view, which is always dynamic.
  return data
}

// ── Fetch all passports for a cooperative (dashboard) ───────────────────────

export async function getCoopPassports(cooperativeId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coffee_passports')
    .select(`
      id, passport_code, status, view_count, published_at, created_at,
      public_story, quality_metrics, sustainability_metrics,
      export_lots (export_lot_number, buyer_name, buyer_country, grade, net_weight_kg)
    `)
    .eq('cooperative_id', cooperativeId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Fetch traceability ledger for a passport (audit view) ────────────────────

export async function getPassportLedger(passportId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('traceability_events')
    .select('*')
    .eq('entity_id', passportId)
    .order('created_at', { ascending: true })

  return data ?? []
}

// ── Fetch public traceability ledger for a published passport (bypasses RLS scoped to coop_officer) ──
export async function getPublicPassportLedger(passportId: string) {
  const supabase = await createClient()

  // First, verify the passport exists and is published
  const { data: passport } = await supabase
    .from('coffee_passports')
    .select('status')
    .eq('id', passportId)
    .single()

  if (!passport || passport.status !== 'published') {
    return []
  }

  // To fetch ledger history for public users (who do not satisfy the RLS policy cooperative_id = auth.jwt() -> ...),
  // we use the admin client with the service role key.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('getPublicPassportLedger: Missing environment variables for service client')
    return []
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data, error } = await adminClient
    .from('traceability_events')
    .select('event_type, event_data, previous_hash, current_hash, hash_algorithm, actor_name, created_at')
    .eq('entity_id', passportId)
    .order('created_at', { ascending: true })

  // Previously any error here (RLS blip, network drop, admin-client
  // hiccup) was swallowed into `return []`, and PassportClient only
  // renders the entire "chain of custody" section when `ledger.length >
  // 0` — so a failed fetch didn't just show an empty ledger, it made the
  // whole hash-chain verification section silently vanish, with nothing
  // telling a buyer whether that coffee genuinely has no recorded
  // custody events or whether the fetch just failed. Throwing here lets
  // the caller (app/trace/[passportCode]/page.tsx) distinguish the two
  // and tell PassportClient which one happened, instead of presenting
  // "failed to load" as "nothing to show."
  if (error) {
    throw new Error(`Could not load traceability ledger: ${error.message}`)
  }

  return data ?? []
}

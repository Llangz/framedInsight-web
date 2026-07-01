'use server'

/**
 * app/dashboard/cooperative/legality/actions.ts
 * Server actions for the legality self-declaration checklist.
 *
 * Supports the "legally produced" clause of EUDR Article 3(b), plus core
 * Kenyan labour/tax compliance markers (AFA Milling License, NSSF, SHA,
 * child labour policy, land use rights, third-party rights, KRA tax).
 *
 * Design: cooperative-level, re-attested each crop season. Self-reported
 * — the UI and the passport widget label it as such.
 */

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'
import { writeTraceabilityEvent } from '@/lib/passport/passport.service'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Derive the canonical season string from intake lot records. */
async function getDeclaredSeasons(coopId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('factory_intake_lots')
    .select('payment_season')
    .eq('cooperative_id', coopId)
    .not('payment_season', 'is', null)

  const seasons = new Set<string>()
  ;(data ?? []).forEach(row => {
    if (row.payment_season) seasons.add(row.payment_season)
  })
  return Array.from(seasons).sort().reverse()
}

// ── Queries ─────────────────────────────────────────────────────────────────

/** Fetch all seasons that have a declaration record. */
export async function listLegalityDeclarationSeasons() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', seasons: [] }
  }

  const supabase = await createClient()

  // Query the summary view so we get items_complete / fully_declared
  const { data, error } = await supabase
    .from('v_legality_declaration_summary')
    .select(`
      season,
      afa_milling_license_held,
      nssf_compliant,
      sha_compliant,
      child_labour_policy_in_place,
      land_use_rights_confirmed,
      third_party_rights_confirmed,
      tax_compliant,
      declared_at,
      declared_by,
      updated_at
    `)
    .eq('cooperative_id', access.coopId)
    .order('season', { ascending: false })

  if (error) {
    console.error('listLegalityDeclarationSeasons error:', error)
    return { success: false as const, error: error.message, seasons: [] }
  }

  return { success: true as const, seasons: data ?? [] }
}

/** Fetch the full declaration for a given season, with optional supporting
 *  documents from export_lot_documents (scoped to cooperative-level docs). */
export async function getLegalityDeclaration(season: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', declaration: null, documents: [] }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cooperative_legality_declarations')
    .select('*')
    .eq('cooperative_id', access.coopId)
    .eq('season', season)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('getLegalityDeclaration error:', error)
    return { success: false as const, error: error.message, declaration: null, documents: [] }
  }

  // Load cooperative-level supporting documents (if any)
  const { data: docs } = await supabase
    .from('export_lot_documents')
    .select('*')
    .eq('cooperative_id', access.coopId)
    .eq('document_type', 'legality_supporting')
    .order('uploaded_at', { ascending: false })

  return {
    success: true as const,
    declaration: data ?? null,
    documents: docs ?? [],
  }
}

/** Return the canonical list of seasons from intake lot payment_season values,
 *  plus any season that already has a declaration. */
export async function getLegalitySeasonOptions() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', seasons: [] }
  }

  const supabase = await createClient()

  // 1. Seasons from intake lots
  const intakeSeasons = await getDeclaredSeasons(access.coopId)

  // 2. Seasons already declared
  const { data: declaredRows } = await supabase
    .from('cooperative_legality_declarations')
    .select('season')
    .eq('cooperative_id', access.coopId)

  const declaredSeasons = new Set<string>((declaredRows ?? []).map(r => r.season))

  // Merge & dedupe, most-recent-first
  const all = Array.from(new Set([...intakeSeasons, ...declaredSeasons]))
    .sort()
    .reverse()

  return { success: true as const, seasons: all }
}

// ── Upsert (create or update) ───────────────────────────────────────────────

export interface LegalityDeclarationForm {
  season: string
  // AFA Milling License
  afa_milling_license_held: boolean
  afa_milling_license_number?: string
  afa_milling_license_expiry?: string
  // NSSF
  nssf_compliant: boolean
  nssf_registration_number?: string
  // SHA / NHIF
  sha_compliant: boolean
  sha_registration_number?: string
  // Child labour policy
  child_labour_policy_in_place: boolean
  child_labour_policy_notes?: string
  // Land use rights
  land_use_rights_confirmed: boolean
  land_use_rights_notes?: string
  // Third-party / FPIC rights
  third_party_rights_confirmed: boolean
  // Tax compliance (KRA)
  tax_compliant: boolean
  kra_pin?: string
  // Notes
  notes?: string
}

export async function saveLegalityDeclaration(form: LegalityDeclarationForm) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId || !access.userId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const payload = {
    cooperative_id: access.coopId,
    season: form.season,

    afa_milling_license_held: form.afa_milling_license_held,
    afa_milling_license_number: form.afa_milling_license_number?.trim() || null,
    afa_milling_license_expiry: form.afa_milling_license_expiry || null,

    nssf_compliant: form.nssf_compliant,
    nssf_registration_number: form.nssf_registration_number?.trim() || null,

    sha_compliant: form.sha_compliant,
    sha_registration_number: form.sha_registration_number?.trim() || null,

    child_labour_policy_in_place: form.child_labour_policy_in_place,
    child_labour_policy_notes: form.child_labour_policy_notes?.trim() || null,

    land_use_rights_confirmed: form.land_use_rights_confirmed,
    land_use_rights_notes: form.land_use_rights_notes?.trim() || null,

    third_party_rights_confirmed: form.third_party_rights_confirmed,

    tax_compliant: form.tax_compliant,
    kra_pin: form.kra_pin?.trim() || null,

    declared_by: access.userId,
    declared_at: new Date().toISOString(),

    notes: form.notes?.trim() || null,
  }

  // Upsert: update if exists, insert if not
  const { data, error } = await supabase
    .from('cooperative_legality_declarations')
    .upsert(payload, {
      onConflict: 'cooperative_id,season',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) {
    console.error('saveLegalityDeclaration error:', error)
    return { success: false as const, error: error.message }
  }

  // Traceability event (uses shared hash-chain ledger)
  await writeTraceabilityEvent({
    entityType: 'legality_declaration',
    entityId: data.id,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    eventType: 'legality_declaration_submitted',
    eventData: {
      season: form.season,
      afa_milling_license_held: form.afa_milling_license_held,
      nssf_compliant: form.nssf_compliant,
      sha_compliant: form.sha_compliant,
      child_labour_policy_in_place: form.child_labour_policy_in_place,
      land_use_rights_confirmed: form.land_use_rights_confirmed,
      third_party_rights_confirmed: form.third_party_rights_confirmed,
      tax_compliant: form.tax_compliant,
    },
  })

  revalidatePath('/dashboard/cooperative/legality')
  return { success: true as const, declaration: data }
}

// ── Cooperative-level document upload ──────────────────────────────────────
// Reuses the existing export_lot_documents table for supporting documents
// (e.g. scanned AFA license, NSSF certificate). These are cooperative-scoped
// rather than export-lot-scoped — the UI will filter by cooperative_id when
// displaying them alongside the declaration.

export interface RecordLegalityDocumentParams {
  documentLabel: string
  storagePath: string
  fileName: string
  fileSizeBytes?: number
  mimeType?: string
  notes?: string
}

export async function recordLegalityDocument(params: RecordLegalityDocumentParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId || !access.userId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('export_lot_documents')
    .insert({
      cooperative_id: access.coopId,
      document_type: 'legality_supporting',
      document_label: params.documentLabel,
      storage_path: params.storagePath,
      file_name: params.fileName,
      file_size_bytes: params.fileSizeBytes ?? null,
      mime_type: params.mimeType ?? null,
      uploaded_by: access.userId,
      notes: params.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('recordLegalityDocument error:', error)
    return { success: false as const, error: error.message }
  }

  await writeTraceabilityEvent({
    entityType: 'legality_declaration',
    entityId: data.id,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    eventType: 'legality_supporting_document_uploaded',
    eventData: { document_label: params.documentLabel, file_name: params.fileName },
  })

  revalidatePath('/dashboard/cooperative/legality')
  return { success: true as const, document: data }
}

export async function deleteLegalityDocument(documentId: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId || !access.userId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('export_lot_documents')
    .select('id, storage_path, file_name, document_label')
    .eq('id', documentId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!doc) {
    return { success: false as const, error: 'Document not found or unauthorized' }
  }

  // Best-effort storage cleanup
  await supabase.storage.from('export-lot-documents').remove([doc.storage_path])

  const { error } = await supabase
    .from('export_lot_documents')
    .delete()
    .eq('id', documentId)
    .eq('cooperative_id', access.coopId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  await writeTraceabilityEvent({
    entityType: 'legality_declaration',
    entityId: doc.id,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    eventType: 'legality_supporting_document_deleted',
    eventData: { document_label: doc.document_label, file_name: doc.file_name },
  })

  revalidatePath('/dashboard/cooperative/legality')
  return { success: true as const }
}

export async function getLegalityDocumentDownloadUrl(documentId: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('export_lot_documents')
    .select('storage_path, file_name')
    .eq('id', documentId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!doc) {
    return { success: false as const, error: 'Document not found or unauthorized' }
  }

  const { data, error } = await supabase.storage
    .from('export-lot-documents')
    .createSignedUrl(doc.storage_path, 60 * 5) // 5 minutes

  if (error || !data) {
    return { success: false as const, error: error?.message ?? 'Could not sign URL' }
  }

  return { success: true as const, url: data.signedUrl, fileName: doc.file_name }
}
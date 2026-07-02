'use server'

/**
 * app/dashboard/cooperative/intake/export-lots/documents-actions.ts
 *
 * Government-issued document provenance for export lots: AFA Milling
 * License, KEPHIS Phytosanitary Certificate, Coffee Movement Permits,
 * cupping scorecards, etc. (audit §3 — Document Provenance).
 *
 * Files live in a PRIVATE Supabase Storage bucket ('export-lot-documents')
 * — unlike the public 'farm-photos' bucket used for EUDR evidence photos.
 * These are business/regulatory documents, not public marketing material,
 * and are only ever surfaced to:
 *   1. Cooperative officers (via this dashboard, RLS-gated)
 *   2. Authenticated buyers (via the buyer data room, service-role gated)
 * Never to the public passport page.
 */

import { createClient } from '@/lib/supabase/server'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { revalidatePath } from 'next/cache'
import { writeTraceabilityEvent } from '@/lib/passport/passport.service'
import { type ExportLotDocumentType } from '@/lib/passport/document-types'

const STORAGE_BUCKET = 'export-lot-documents'

// ── List documents for an export lot ─────────────────────────────────────────

export async function getExportLotDocuments(exportLotId: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    return { success: false as const, error: 'Unauthorized', documents: [] }
  }

  const supabase = await createClient()

  // Verify the lot belongs to this cooperative before listing its documents
  const { data: lot } = await supabase
    .from('export_lots')
    .select('id')
    .eq('id', exportLotId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!lot) {
    return { success: false as const, error: 'Export lot not found or unauthorized', documents: [] }
  }

  const { data, error } = await supabase
    .from('export_lot_documents')
    .select('*')
    .eq('export_lot_id', exportLotId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('getExportLotDocuments error:', error)
    return { success: false as const, error: error.message, documents: [] }
  }

  return { success: true as const, documents: data ?? [] }
}

// ── Upload a document ─────────────────────────────────────────────────────────
// File bytes are uploaded client-side directly to Storage (RLS-protected
// bucket, officer-scoped). This action only records the metadata row and
// the traceability event once the client confirms the upload succeeded.

export interface RecordDocumentUploadParams {
  exportLotId: string
  documentType: ExportLotDocumentType
  documentLabel?: string
  storagePath: string
  fileName: string
  fileSizeBytes?: number
  mimeType?: string
  notes?: string
}

export async function recordDocumentUpload(params: RecordDocumentUploadParams) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId || !access.userId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: exportLot } = await supabase
    .from('export_lots')
    .select('id, export_lot_number, cooperative_id')
    .eq('id', params.exportLotId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!exportLot) {
    return { success: false as const, error: 'Export lot not found or unauthorized' }
  }

  const { data: doc, error } = await supabase
    .from('export_lot_documents')
    .insert({
      export_lot_id: exportLot.id,
      cooperative_id: access.coopId,
      document_type: params.documentType,
      document_label: params.documentLabel?.trim() || null,
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
    console.error('recordDocumentUpload error:', error)
    return { success: false as const, error: error.message }
  }

  await writeTraceabilityEvent({
    entityType: 'export_lot',
    entityId: exportLot.id,
    cooperativeId: access.coopId,
    actorUserId: access.userId,
    eventType: 'export_lot_document_uploaded',
    eventData: {
      export_lot_number: exportLot.export_lot_number,
      document_type: params.documentType,
      file_name: params.fileName,
    },
  })

  revalidatePath(`/dashboard/cooperative/intake/export-lots`)
  return { success: true as const, document: doc }
}

// ── Officer verification (sign-off) ───────────────────────────────────────────

export async function verifyDocument(documentId: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId || !access.userId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: doc, error } = await supabase
    .from('export_lot_documents')
    .update({
      verified_by_officer: access.userId,
      verified_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('cooperative_id', access.coopId)
    .select()
    .single()

  if (error || !doc) {
    return { success: false as const, error: error?.message ?? 'Document not found' }
  }

  if (doc.export_lot_id) {
    await writeTraceabilityEvent({
      entityType: 'export_lot',
      entityId: doc.export_lot_id,
      cooperativeId: access.coopId,
      actorUserId: access.userId,
      eventType: 'export_lot_document_verified',
      eventData: {
        document_type: doc.document_type,
        file_name: doc.file_name,
      },
    })
  }

  revalidatePath(`/dashboard/cooperative/intake/export-lots`)
  return { success: true as const, document: doc }
}

// ── Delete a document ──────────────────────────────────────────────────────────
// Removes both the Storage object and the metadata row. Storage removal is
// best-effort — if it fails (e.g. already gone) the metadata row is still
// deleted so the UI doesn't show a dangling reference.

export async function deleteExportLotDocument(documentId: string) {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId || !access.userId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('export_lot_documents')
    .select('id, export_lot_id, storage_path, document_type, file_name')
    .eq('id', documentId)
    .eq('cooperative_id', access.coopId)
    .single()

  if (!doc) {
    return { success: false as const, error: 'Document not found or unauthorized' }
  }

  await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path])

  const { error } = await supabase
    .from('export_lot_documents')
    .delete()
    .eq('id', documentId)
    .eq('cooperative_id', access.coopId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  if (doc.export_lot_id) {
    await writeTraceabilityEvent({
      entityType: 'export_lot',
      entityId: doc.export_lot_id,
      cooperativeId: access.coopId,
      actorUserId: access.userId,
      eventType: 'export_lot_document_deleted',
      eventData: {
        document_type: doc.document_type,
        file_name: doc.file_name,
      },
    })
  }

  revalidatePath(`/dashboard/cooperative/intake/export-lots`)
  return { success: true as const }
}

// ── Signed download URL (short-lived) ────────────────────────────────────────
// Used by both the cooperative dashboard and the buyer data room to fetch
// a temporary, authenticated link rather than exposing the bucket publicly.

export async function getDocumentDownloadUrl(documentId: string) {
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
    .from(STORAGE_BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 5) // 5 minutes

  if (error || !data) {
    return { success: false as const, error: error?.message ?? 'Could not sign URL' }
  }

  return { success: true as const, url: data.signedUrl, fileName: doc.file_name }
}

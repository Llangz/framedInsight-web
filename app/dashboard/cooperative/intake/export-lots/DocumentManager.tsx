'use client'

/**
 * app/dashboard/cooperative/intake/export-lots/DocumentManager.tsx
 *
 * Upload and manage government-issued regulatory documents for an export
 * lot — AFA Milling License, KEPHIS Phytosanitary Certificate, Coffee
 * Movement Permits, cupping scorecards (audit §3, Document Provenance).
 *
 * Files upload directly from the browser to the private
 * 'export-lot-documents' Storage bucket (RLS-gated, see
 * 20260701_financial_transparency_and_documents.sql), then this component
 * calls recordDocumentUpload() to write the metadata row + traceability
 * event. Path convention: {cooperative_id}/{export_lot_id}/{timestamp}_{filename}
 * — this exact structure is required by the storage RLS policies.
 */

import { useEffect, useState, useTransition } from 'react'
import { FileText, Upload, Trash2, CheckCircle2, Download, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getExportLotDocuments,
  recordDocumentUpload,
  verifyDocument,
  deleteExportLotDocument,
  getDocumentDownloadUrl,
} from './documents-actions'
import { DOCUMENT_TYPE_LABELS, type ExportLotDocumentType } from '@/lib/passport/document-types'

interface Doc {
  id: string
  document_type: string
  document_label: string | null
  file_name: string
  file_size_bytes: number | null
  uploaded_at: string
  verified_by_officer: string | null
  verified_at: string | null
}

interface Props {
  exportLotId: string
  cooperativeId: string
}

const STORAGE_BUCKET = 'export-lot-documents'
const DOC_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as ExportLotDocumentType[]

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentManager({ exportLotId, cooperativeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<ExportLotDocumentType>('afa_milling_license')
  const [label, setLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const res = await getExportLotDocuments(exportLotId)
    if (res.success) setDocs(res.documents as Doc[])
    setLoading(false)
  }

  useEffect(() => { load() }, [exportLotId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const path = `${cooperativeId}/${exportLotId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file)
      if (upErr) throw upErr

      const res = await recordDocumentUpload({
        exportLotId,
        documentType: docType,
        documentLabel: label || undefined,
        storagePath: path,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
      })

      if (!res.success) throw new Error(res.error)

      setLabel('')
      await load()
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleVerify = (id: string) => {
    startTransition(async () => {
      const res = await verifyDocument(id)
      if (res.success) await load()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Remove this document? This cannot be undone.')) return
    startTransition(async () => {
      const res = await deleteExportLotDocument(id)
      if (res.success) await load()
    })
  }

  const handleDownload = (id: string) => {
    startTransition(async () => {
      const res = await getDocumentDownloadUrl(id)
      if (res.success) window.open(res.url, '_blank')
    })
  }

  return (
    <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <FileText size={14} className="text-[#C9A96E]" />
        Regulatory documents
      </h3>
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        AFA licenses, KEPHIS phytosanitary certificates, and movement permits required
        for customs clearance. Visible to authenticated buyers in their data room —
        never on the public passport.
      </p>

      {/* Upload form */}
      <div className="grid grid-cols-2 gap-3">
        <select
          value={docType}
          onChange={e => setDocType(e.target.value as ExportLotDocumentType)}
          className="bg-[#15171D] border border-[#2A2D35] rounded-lg px-3 py-2 text-sm text-white"
        >
          {DOC_TYPES.map(t => (
            <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Optional label (e.g. cert #)"
          className="bg-[#15171D] border border-[#2A2D35] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
      </div>

      <label className="flex items-center justify-center gap-2 border border-dashed border-[#2A2D35] rounded-xl py-4 cursor-pointer hover:border-[#C9A96E]/50 transition text-sm text-zinc-400">
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? 'Uploading…' : 'Choose a file to upload'}
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png" />
      </label>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={11} />{error}</p>
      )}

      {/* Document list */}
      {loading ? (
        <p className="text-xs text-zinc-600">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-zinc-600">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between bg-[#15171D] border border-[#1E2028] rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  {doc.document_label && <span className="text-zinc-500 font-normal"> · {doc.document_label}</span>}
                </p>
                <p className="text-[11px] text-zinc-600 truncate">
                  {doc.file_name} {doc.file_size_bytes ? `· ${formatBytes(doc.file_size_bytes)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {doc.verified_at ? (
                  <span className="flex items-center gap-1 text-[10px] text-[#7EC49A] font-semibold">
                    <ShieldCheck size={11} /> Verified
                  </span>
                ) : (
                  <button
                    onClick={() => handleVerify(doc.id)}
                    disabled={isPending}
                    className="text-[10px] text-zinc-500 hover:text-[#7EC49A] flex items-center gap-1"
                  >
                    <CheckCircle2 size={11} /> Verify
                  </button>
                )}
                <button onClick={() => handleDownload(doc.id)} disabled={isPending} className="text-zinc-500 hover:text-white">
                  <Download size={13} />
                </button>
                <button onClick={() => handleDelete(doc.id)} disabled={isPending} className="text-zinc-500 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

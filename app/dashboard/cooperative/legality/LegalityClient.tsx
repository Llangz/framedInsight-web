'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Shield, CheckCircle2, Circle, AlertCircle, ChevronRight,
  ChevronDown, Upload, Trash2, FileText, Info, X, Loader2,
  Scale, Briefcase, HeartPulse, Baby, MapPin, Users, Receipt
} from 'lucide-react'
import {
  saveLegalityDeclaration,
  getLegalityDeclaration,
  getLegalitySeasonOptions,
  LegalityDeclarationForm,
  recordLegalityDocument,
  deleteLegalityDocument,
  getLegalityDocumentDownloadUrl,
} from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExistingSeason {
  season: string
  afa_milling_license_held: boolean
  nssf_compliant: boolean
  sha_compliant: boolean
  child_labour_policy_in_place: boolean
  land_use_rights_confirmed: boolean
  third_party_rights_confirmed: boolean
  tax_compliant: boolean
  declared_at: string | null
  declared_by: string | null
  updated_at: string
}

interface SupportingDoc {
  id: string
  document_label: string
  file_name: string
  file_size_bytes: number | null
  mime_type: string | null
  uploaded_at: string
  storage_path: string
}

interface Props {
  coopName: string
  coopRegistrationNumber: string | null
  existingSeasons: ExistingSeason[]
}

type ChecklistItemId =
  | 'afa_milling_license_held'
  | 'nssf_compliant'
  | 'sha_compliant'
  | 'child_labour_policy_in_place'
  | 'land_use_rights_confirmed'
  | 'third_party_rights_confirmed'
  | 'tax_compliant'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS: Array<{
  id: ChecklistItemId
  label: string
  description: string
  hint: string
  icon: React.ElementType
  optionalFields?: Array<{ key: keyof LegalityDeclarationForm; label: string; placeholder: string }>
  notesField?: keyof LegalityDeclarationForm
}> = [
  {
    id: 'afa_milling_license_held',
    label: 'AFA Milling License',
    description: 'Coffee Factory/Mill Operating License issued by the Agriculture and Food Authority (AFA), Directorate of Coffee (Kenya). Required under the Crops Act 2021.',
    hint: 'Enter your AFA milling license number and expiry date. Upload a scanned copy of the license as supporting evidence.',
    icon: Briefcase,
    optionalFields: [
      { key: 'afa_milling_license_number', label: 'License Number', placeholder: 'e.g. AFA/CFE/2025/0042' },
    ],
    notesField: 'afa_milling_license_expiry',
  },
  {
    id: 'nssf_compliant',
    label: 'NSSF Compliance',
    description: 'Registration with and remittance of contributions to the National Social Security Fund (NSSF), Kenya. Mandatory for all employers with one or more employees.',
    hint: 'NSSF Act 2013 requires registration of all eligible employees and monthly remittance. Provide your NSSF employer registration number.',
    icon: Shield,
    optionalFields: [
      { key: 'nssf_registration_number', label: 'NSSF Employer No.', placeholder: 'e.g. NSSF/KEN/00001234' },
    ],
  },
  {
    id: 'sha_compliant',
    label: 'SHA / NHIF Compliance',
    description: 'Registration with the Social Health Authority (SHA), successor to NHIF since February 2024 per the Social Health Insurance Act 2023. Mandatory employer registration and employee enrollment.',
    hint: 'All employers must register their employees with SHA and remit monthly contributions. Your SHA employer registration number is required.',
    icon: HeartPulse,
    optionalFields: [
      { key: 'sha_registration_number', label: 'SHA Employer No.', placeholder: 'e.g. SHA/EMP/00001234' },
    ],
  },
  {
    id: 'child_labour_policy_in_place',
    label: 'Child Labour Policy',
    description: 'A written policy prohibiting child labour in all cooperative and member-farm operations, aligned with the Children\'s Act 2022 (Kenya) and ILO Convention 182 on the Worst Forms of Child Labour.',
    hint: 'EUDR Article 3(b)(iii) requires operators to confirm no child labour is used in production. Describe or link your policy or code of conduct.',
    icon: Baby,
    notesField: 'child_labour_policy_notes',
  },
  {
    id: 'land_use_rights_confirmed',
    label: 'Land Use Rights',
    description: 'The cooperative\'s factory, processing facilities, and associated land are confirmed to be established and operated under valid land use rights — title deeds, lease agreements, or customary land allocations recognized under Kenyan law.',
    hint: 'Note: per-plot land rights for member farms are separately tracked under EUDR geolocation (coffee_eudr_compliance). This item covers the cooperative\'s own land and facilities.',
    icon: MapPin,
    notesField: 'land_use_rights_notes',
  },
  {
    id: 'third_party_rights_confirmed',
    label: 'Third-Party / FPIC Rights',
    description: 'No Known land rights of Indigenous Peoples, local communities, or other third parties are violated by the cooperative\'s or its members\' land use. Free, Prior and Informed Consent (FPIC) has been obtained where applicable.',
    hint: 'Relevant where cooperative land overlaps community or customary land claims. If not applicable, you may still tick to confirm no known disputes exist.',
    icon: Users,
  },
  {
    id: 'tax_compliant',
    label: 'Tax Compliance (KRA)',
    description: 'The cooperative holds a valid Kenya Revenue Authority (KRA) PIN and is in good standing — current Tax Compliance Certificate (TCC) or self-declaration of filing obligations.',
    hint: 'EUDR Article 3(b)(iv) covers tax and anti-corruption obligations. Exporting coffee from Kenya also requires KRA clearance for the consignment.',
    icon: Receipt,
    optionalFields: [
      { key: 'kra_pin', label: 'KRA PIN', placeholder: 'e.g. A001234567B' },
    ],
  },
]

const TOTAL_ITEMS = CHECKLIST_ITEMS.length // 7

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(dateStr))
}

// ── Document Upload Modal ──────────────────────────────────────────────────────

function DocumentUploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void
  onUploaded: (doc: SupportingDoc) => void
}) {
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file) { setError('Please select a file first.'); return }
    if (!label.trim()) { setError('Please enter a document label.'); return }
    setError('')
    setUploading(true)

    try {
      // 1. Upload to Supabase Storage (client-side, directly)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const ext = file.name.split('.').pop() ?? 'pdf'
      const storagePath = `legality/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('export-lot-documents')
        .upload(storagePath, file, { upsert: false })

      if (uploadError) throw new Error(uploadError.message)

      // 2. Record metadata
      const result = await recordLegalityDocument({
        documentLabel: label.trim(),
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
        notes: notes.trim() || undefined,
      })

      if (!result.success) throw new Error(result.error ?? 'Failed to save document record')

      onUploaded(result.document as unknown as SupportingDoc)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0D0F14] border border-[#2A2D35] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Upload size={16} className="text-emerald-500" />
            Upload Supporting Document
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Upload scanned licenses, certificates, or other evidence supporting
          your legality declaration. Files are stored securely and only shared
          with authenticated buyers via the data room.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Document Label *</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. AFA Milling License 2025"
              className="w-full bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">File *</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-900/30 file:text-emerald-400 hover:file:bg-emerald-900/50 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Expiry: Dec 2026 — renewed on..."
              rows={2}
              className="w-full bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#2A2D35] text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !label.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm font-bold text-white transition-colors cursor-pointer"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function LegalityClient({ coopName, coopRegistrationNumber, existingSeasons }: Props) {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [selectedSeason, setSelectedSeason] = useState('')

  // Form state (one entry per item in the checklist)
  const [form, setForm] = useState<LegalityDeclarationForm | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedOk, setSavedOk] = useState(false)

  // Supporting docs
  const [docs, setDocs] = useState<SupportingDoc[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Expanded checklist items
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['afa_milling_license_held']))

  // Fetch season options on mount
  const [seasonOptions, setSeasonOptions] = useState<string[]>([])
  useEffect(() => {
    getLegalitySeasonOptions().then(r => {
      if (r.success) setSeasonOptions(r.seasons)
    })
  }, [])

  // Compute completion
  const completeCount = form ? CHECKLIST_ITEMS.filter(i => form[i.id]).length : 0

  // Load a season's existing data into the form
  const loadSeason = useCallback(async (season: string) => {
    setSelectedSeason(season)
    const { declaration, documents } = await getLegalityDeclaration(season)
    if (declaration) {
      setForm({
        season,
        afa_milling_license_held: declaration.afa_milling_license_held,
        afa_milling_license_number: declaration.afa_milling_license_number ?? undefined,
        afa_milling_license_expiry: declaration.afa_milling_license_expiry ?? undefined,
        nssf_compliant: declaration.nssf_compliant,
        nssf_registration_number: declaration.nssf_registration_number ?? undefined,
        sha_compliant: declaration.sha_compliant,
        sha_registration_number: declaration.sha_registration_number ?? undefined,
        child_labour_policy_in_place: declaration.child_labour_policy_in_place,
        child_labour_policy_notes: declaration.child_labour_policy_notes ?? undefined,
        land_use_rights_confirmed: declaration.land_use_rights_confirmed,
        land_use_rights_notes: declaration.land_use_rights_notes ?? undefined,
        third_party_rights_confirmed: declaration.third_party_rights_confirmed,
        tax_compliant: declaration.tax_compliant,
        kra_pin: declaration.kra_pin ?? undefined,
        notes: declaration.notes ?? undefined,
      })
      setNotes(declaration.notes ?? '')
    } else {
      setForm({ season, afa_milling_license_held: false, nssf_compliant: false, sha_compliant: false, child_labour_policy_in_place: false, land_use_rights_confirmed: false, third_party_rights_confirmed: false, tax_compliant: false })
      setNotes('')
    }
    setDocs(documents as SupportingDoc[])
    setExpanded(new Set(['afa_milling_license_held']))
    setSavedOk(false)
    setSaveError('')
    setView('form')
  }, [])

  // Start a NEW season
  const startNewSeason = useCallback(async () => {
    if (seasonOptions.length === 0) {
      // fallback: show a simple prompt
      const raw = window.prompt('Enter season (e.g. 2025/2026):')
      if (!raw?.trim()) return
      loadSeason(raw.trim())
      return
    }
    // pick the most recent undeclared season if possible
    const existing = new Set(existingSeasons.map(s => s.season))
    const next = seasonOptions.find(s => !existing.has(s)) ?? seasonOptions[0]
    loadSeason(next)
  }, [seasonOptions, existingSeasons, loadSeason])

  const toggleItem = (id: ChecklistItemId) => {
    if (!form) return
    setForm(prev => prev ? { ...prev, [id]: !prev[id] } : prev)
  }

  const setOptionalField = (key: keyof LegalityDeclarationForm, value: string) => {
    if (!form) return
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    setSaveError('')

    const payload: LegalityDeclarationForm = {
      ...form,
      notes: notes.trim() || undefined,
    }

    const result = await saveLegalityDeclaration(payload)
    if (!result.success) {
      setSaveError(result.error ?? 'Save failed')
    } else {
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    }
    setSaving(false)
  }

  const handleDownload = async (doc: SupportingDoc) => {
    const result = await getLegalityDocumentDownloadUrl(doc.id)
    if (result.success && result.url) {
      window.open(result.url, '_blank')
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Remove this supporting document?')) return
    const result = await deleteLegalityDocument(docId)
    if (result.success) setDocs(prev => prev.filter(d => d.id !== docId))
  }

  const progressPct = form ? Math.round((completeCount / TOTAL_ITEMS) * 100) : 0

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    const declaredSeasons = existingSeasons
      .sort((a, b) => b.season.localeCompare(a.season))

    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2D35] pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Scale size={26} className="text-emerald-500" />
              Legal Compliance
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Self-declaration of production legality for EUDR Article 3(b) and Kenyan
              regulatory compliance. Each crop season must be re-attested.
            </p>
          </div>
          <button
            onClick={startNewSeason}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm text-sm cursor-pointer shrink-0"
          >
            + New Declaration
          </button>
        </div>

        {/* ── Legal disclaimer ── */}
        <div className="flex items-start gap-3 bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4">
          <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200 leading-relaxed">
            <strong className="font-semibold">Self-declaration only.</strong> This
            checklist does not substitute the buyer's own legal due diligence.
            EUDR requires operators to demonstrate compliance with applicable laws;
            third-party verification is recommended for high-value export contracts.
            Misrepresentation may constitute fraud under Kenyan and EU law.
          </p>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CHECKLIST_ITEMS.map(item => {
            const declared = declaredSeasons.filter(s => s[item.id]).length
            const total = declaredSeasons.length || 1
            const pct = Math.round((declared / total) * 100)
            const Icon = item.icon
            return (
              <div key={item.id} className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 text-center">
                <Icon size={20} className="text-emerald-500 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-zinc-300 leading-snug">{item.label}</h4>
                <p className="text-xs text-zinc-500 mt-1">{declared}/{declaredSeasons.length || '–'} seasons</p>
              </div>
            )
          })}
        </div>

        {/* ── Season history ── */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2A2D35]">
            <h2 className="text-sm font-bold text-zinc-300">Declaration History</h2>
          </div>

          {declaredSeasons.length === 0 ? (
            <div className="p-10 text-center">
              <Scale size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No declarations yet.</p>
              <p className="text-zinc-600 text-xs mt-1">
                Start a new declaration to attest your cooperative&apos;s
                legal compliance for the current crop season.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#2A2D35]">
              {declaredSeasons.map(s => {
                const completedCount = CHECKLIST_ITEMS.filter(i => s[i.id]).length
                const fully = completedCount === TOTAL_ITEMS
                return (
                  <button
                    key={s.season}
                    onClick={() => loadSeason(s.season)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-zinc-900/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{s.season}</span>
                        {fully && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400">
                            <CheckCircle2 size={10} /> Complete
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {completedCount}/{TOTAL_ITEMS} items declared
                        {s.declared_at ? ` · Last updated ${formatDate(s.declared_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Mini progress */}
                      <div className="w-20 h-1.5 bg-zinc-900 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${(completedCount / TOTAL_ITEMS) * 100}%` }}
                        />
                      </div>
                      <ChevronRight size={16} className="text-zinc-600" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Quick-start CTA ── */}
        {declaredSeasons.length === 0 && (
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-6 text-center space-y-3">
            <p className="text-sm text-zinc-300 font-semibold">Ready to start your first declaration?</p>
            <button
              onClick={startNewSeason}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer"
            >
              Start Declaration
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── FORM VIEW ───────────────────────────────────────────────────────────────

  if (!form) return null

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

      {/* ── Back + Header ── */}
      <div className="flex items-center justify-between gap-4 border-b border-[#2A2D35] pb-6">
        <button
          onClick={() => setView('list')}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronRight size={16} className="rotate-180" />
          Back to history
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-400">Season:</span>
          <span className="font-bold text-white">{selectedSeason}</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Scale size={22} className="text-emerald-500" />
          Legality Self-Declaration
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          {coopName}
          {coopRegistrationNumber ? ` · Reg. No. ${coopRegistrationNumber}` : ''}
        </p>
      </div>

      {/* ── Progress bar ── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-zinc-400">Declaration completeness</span>
          <span className="text-white">{completeCount} of {TOTAL_ITEMS} items</span>
        </div>
        <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: progressPct === 100
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #10b981, #6ee7b7)',
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">
            EUDR requires all 7 items declared. Incomplete declarations will be surfaced
            in the buyer data room with an explicit &quot;In Progress&quot; status.
          </p>
          {progressPct === 100 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
              <CheckCircle2 size={13} /> All items declared
            </span>
          )}
        </div>
      </div>

      {/* ── Legal disclaimer ── */}
      <div className="flex items-start gap-3 bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4">
        <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200 leading-relaxed">
          <strong className="font-semibold">Self-declaration.</strong> This form
          documents your cooperative&apos;s compliance posture for market disclosure. It
          is self-reported and not independently verified. Buyers and competent
          authorities may request supporting documentation during due diligence.
        </p>
      </div>

      {/* ── Checklist ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Compliance Checklist</h2>

        {CHECKLIST_ITEMS.map(item => {
          const Icon = item.icon
          const checked = !!form[item.id]
          const isExpanded = expanded.has(item.id)

          return (
            <div
              key={item.id}
              className={`bg-[#0D0F14] border rounded-2xl transition-all ${
                checked ? 'border-emerald-800/60' : 'border-[#2A2D35]'
              }`}
            >
              {/* Row header */}
              <button
                onClick={() => {
                  setExpanded(prev => {
                    const next = new Set(prev)
                    if (next.has(item.id)) next.delete(item.id)
                    else next.add(item.id)
                    return next
                  })
                }}
                className="w-full px-5 py-4 flex items-start gap-4 text-left cursor-pointer"
              >
                {/* Toggle button */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleItem(item.id) }}
                  className={`mt-0.5 shrink-0 transition-colors ${
                    checked ? 'text-emerald-500' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {checked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>

                {/* Icon */}
                <Icon size={18} className={`mt-0.5 shrink-0 ${checked ? 'text-emerald-500' : 'text-zinc-500'}`} />

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${checked ? 'text-white' : 'text-zinc-300'}`}>
                    {item.label}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed hidden sm:block">
                    {item.description}
                  </p>
                </div>

                <ChevronDown
                  size={16}
                  className={`mt-1 shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-5 pl-14 space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-4 py-3">
                    <Info size={12} className="text-blue-400 inline mr-1.5 mb-0.5" />
                    {item.hint}
                  </p>

                  {/* Optional fields */}
                  {item.optionalFields?.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        {field.label}
                      </label>
                      <input
                        value={(form[field.key] as string) ?? ''}
                        onChange={e => setOptionalField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
                      />
                    </div>
                  ))}

                  {/* Notes textarea */}
                  {item.notesField && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        Notes / Additional details
                      </label>
                      <textarea
                        value={(form[item.notesField!] as string) ?? ''}
                        onChange={e => setOptionalField(item.notesField!, e.target.value)}
                        placeholder="e.g. Policy adopted on... / Expiry: Dec 2026"
                        rows={2}
                        className="w-full bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Supporting documents ── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
            Supporting Documents
          </h2>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <Upload size={13} />
            Upload document
          </button>
        </div>

        {docs.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">
            No supporting documents uploaded yet. Upload scanned licenses,
            certificates, or policy documents to strengthen your declaration.
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-4 py-3"
              >
                <FileText size={15} className="text-zinc-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{doc.document_label}</p>
                  <p className="text-xs text-zinc-500">
                    {doc.file_name} · {formatFileSize(doc.file_size_bytes)} · {formatDate(doc.uploaded_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── General notes + attestation ── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
          Officer Notes
        </h2>
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
            Additional notes for this declaration
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any caveats, pending renewals, or context about this season's compliance status..."
            rows={3}
            className="w-full bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none"
          />
        </div>
      </div>

      {/* ── Save / Attest ── */}
      {saveError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
          <AlertCircle size={14} />
          {saveError}
        </div>
      )}

      {savedOk && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-4 py-3">
          <CheckCircle2 size={14} />
          Declaration saved successfully.
        </div>
      )}

      <div className="flex items-start gap-3 bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
        <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Submitting this declaration constitutes an official attestation by an
          authorized cooperative officer. The declaration will be recorded with a
          timestamp and officer reference. It cannot be backdated after submission.
          If any information changes during the season, please update and
          re-submit this declaration.
        </p>
      </div>

      <div className="pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold text-sm transition shadow-sm cursor-pointer"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {saving ? 'Saving…' : 'Save & Attest Declaration'}
        </button>
      </div>

      {/* ── Upload modal ── */}
      {showUploadModal && (
        <DocumentUploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={(doc) => {
            setDocs(prev => [doc, ...prev])
            setShowUploadModal(false)
          }}
        />
      )}
    </div>
  )
}

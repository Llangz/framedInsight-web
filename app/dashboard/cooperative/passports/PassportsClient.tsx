'use client'

/**
 * app/dashboard/cooperative/passports/PassportsClient.tsx
 *
 * Cooperative officer view: create, manage, and publish Coffee Digital Passports.
 * Design: consistent with CoopDashboardShell dark token system.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Coffee, Plus, Globe, Eye, CheckCircle, Clock, Archive,
  QrCode, ExternalLink, Copy, Check, BarChart2, Leaf,
  Users, Award, Shield
} from 'lucide-react'
import { publishPassportAction, createPassportAction } from './actions'

interface Passport {
  id: string
  passport_code: string
  status: 'draft' | 'published' | 'archived'
  view_count: number
  published_at: string | null
  created_at: string | null
  public_story: any
  quality_metrics: any
  sustainability_metrics: any
  export_lots?: {
    export_lot_number: string
    buyer_name: string | null
    buyer_country: string | null
    grade: string | null
    net_weight_kg: number | null
  } | null
}

interface ExportLotOption {
  id: string
  export_lot_number: string
  status: string
  buyer_name: string | null
  buyer_country: string | null
}

interface Props {
  passports: Passport[]
  exportLots: ExportLotOption[]
  coopId: string
  userId: string
}

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'text-amber-400',  bg: 'bg-amber-950/40 border-amber-900/30',  icon: Clock },
  published: { label: 'Published', color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-900/30', icon: Globe },
  archived:  { label: 'Archived',  color: 'text-zinc-500',   bg: 'bg-zinc-900/40 border-zinc-800/30',    icon: Archive },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handle}
      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
      title="Copy URL"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  )
}

function PassportCard({ passport, onPublish }: { passport: Passport; onPublish: (id: string) => Promise<void> }) {
  const [publishing, setPublishing] = useState(false)
  const status = STATUS_CONFIG[passport.status]
  const StatusIcon = status.icon
  const story = passport.public_story ?? {}
  const quality = passport.quality_metrics ?? {}
  const sustain = passport.sustainability_metrics ?? {}
  const traceUrl = `${window.location.origin}/trace/${passport.passport_code}`

  const handlePublish = async () => {
    setPublishing(true)
    await onPublish(passport.id)
    setPublishing(false)
  }

  return (
    <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-4 hover:border-zinc-700 transition">

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#C9A96E]/10 border border-[#C9A96E]/20 flex items-center justify-center shrink-0">
            <Coffee size={15} className="text-[#C9A96E]" />
          </div>
          <div>
            <span className="block font-mono text-xs font-bold text-[#C9A96E]">{passport.passport_code}</span>
            <span className="block text-xs text-zinc-400 mt-0.5">
              {story.factory ?? story.cooperative ?? 'Cooperative'}
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
          <StatusIcon size={9} />
          {status.label}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 border-t border-[#2A2D35] pt-3">
        {story.farm_count && (
          <div className="text-center">
            <span className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 uppercase mb-1">
              <Users size={9} /> Farmers
            </span>
            <span className="text-sm font-bold text-white">{story.farm_count.toLocaleString()}</span>
          </div>
        )}
        {quality.sca_score && (
          <div className="text-center">
            <span className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 uppercase mb-1">
              <Award size={9} /> SCA
            </span>
            <span className="text-sm font-bold text-[#C9A96E]">{quality.sca_score.toFixed(1)}</span>
          </div>
        )}
        {sustain.eudr_compliant !== undefined && (
          <div className="text-center">
            <span className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 uppercase mb-1">
              <Shield size={9} /> EUDR
            </span>
            <span className={`text-sm font-bold ${sustain.eudr_compliant ? 'text-emerald-400' : 'text-amber-400'}`}>
              {sustain.eudr_compliant ? '✓' : 'Pending'}
            </span>
          </div>
        )}
        {passport.view_count > 0 && (
          <div className="text-center">
            <span className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 uppercase mb-1">
              <Eye size={9} /> Views
            </span>
            <span className="text-sm font-bold text-white">{passport.view_count}</span>
          </div>
        )}
      </div>

      {/* Export lot info */}
      {passport.export_lots && (
        <div className="bg-[#0A0C10] border border-[#2A2D35] rounded-xl px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Export lot</span>
            <span className="block text-xs font-semibold text-zinc-200 font-mono">{passport.export_lots.export_lot_number}</span>
          </div>
          {passport.export_lots.buyer_country && (
            <span className="text-xs text-zinc-500">{passport.export_lots.buyer_country}</span>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 border-t border-[#2A2D35] pt-3">
        {passport.status === 'published' ? (
          <>
            <Link
              href={`/trace/${passport.passport_code}`}
              target="_blank"
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
            >
              <ExternalLink size={11} /> View live
            </Link>
            <CopyButton text={traceUrl} />
            <button
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1D24] border border-[#2A2D35] rounded-lg text-xs font-semibold text-zinc-300 hover:text-white transition"
              title="QR code"
            >
              <QrCode size={11} /> QR code
            </button>
          </>
        ) : (
          <>
            <Link
              href={`/trace/${passport.passport_code}`}
              target="_blank"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              <Eye size={11} /> Preview
            </Link>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded-lg text-xs font-bold text-white transition"
            >
              <Globe size={11} />
              {publishing ? 'Publishing…' : 'Publish passport'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function PassportsClient({ passports: initialPassports, exportLots, coopId, userId }: Props) {
  const [passports, setPassports] = useState(initialPassports)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [batchId, setBatchId] = useState('')
  const [exportLotId, setExportLotId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handlePublish = async (passportId: string) => {
    const res = await publishPassportAction(passportId, coopId, userId)
    if (!res.success) { alert(res.error); return }
    setPassports(prev => prev.map(p =>
      p.id === passportId ? { ...p, status: 'published' as const, published_at: new Date().toISOString() } : p
    ))
  }

  const handleCreate = async () => {
    if (!batchId.trim()) return
    setCreating(true)
    setError(null)
    const res = await createPassportAction({
      cooperativeId: coopId,
      processingBatchId: batchId.trim(),
      exportLotId: exportLotId || undefined,
      actorUserId: userId,
    })
    setCreating(false)
    if (!res.success) { setError(res.error ?? 'Failed'); return }
    setShowCreate(false)
    setBatchId('')
    setExportLotId('')
    window.location.reload()
  }

  const published = passports.filter(p => p.status === 'published')
  const drafts = passports.filter(p => p.status === 'draft')
  const totalViews = passports.reduce((s, p) => s + (p.view_count ?? 0), 0)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[#2A2D35] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Coffee size={20} className="text-[#C9A96E]" />
            Coffee Passports
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Generate and publish digital origin passports for each export lot.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold rounded-xl text-sm transition shrink-0"
        >
          <Plus size={14} /> New passport
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 text-center">
          <span className="block text-2xl font-bold text-white">{passports.length}</span>
          <span className="block text-xs text-zinc-500 uppercase tracking-wider mt-1">Total passports</span>
        </div>
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 text-center">
          <span className="block text-2xl font-bold text-emerald-400">{published.length}</span>
          <span className="block text-xs text-zinc-500 uppercase tracking-wider mt-1">Published</span>
        </div>
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 text-center">
          <span className="block text-2xl font-bold text-[#C9A96E]">{totalViews.toLocaleString()}</span>
          <span className="block text-xs text-zinc-500 uppercase tracking-wider mt-1">Total scans</span>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#0D0F14] border border-[#C9A96E]/20 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus size={14} className="text-[#C9A96E]" />
            Generate new passport
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Enter the Processing Batch ID from the intake module. The passport will be auto-assembled
            from the chain: deliveries → EUDR assessments → quality records → cooperative profile.
          </p>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Processing Batch ID *
            </label>
            <input
              type="text"
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              placeholder="uuid from processing_batches table"
              className="w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 text-sm outline-none focus:ring-2 focus:ring-[#C9A96E]/40 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Export lot <span className="text-zinc-600">(optional — links grade, weight & EUDR status)</span>
            </label>
            <select
              value={exportLotId}
              onChange={e => setExportLotId(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
            >
              <option value="">No export lot yet — draft origin story only</option>
              {exportLots.map(e => (
                <option key={e.id} value={e.id}>
                  {e.export_lot_number}{e.buyer_country ? ` — ${e.buyer_country}` : ''} ({e.status})
                </option>
              ))}
            </select>
            {exportLots.length === 0 && (
              <p className="text-[10px] text-zinc-500 mt-1.5">
                No export lots yet —{' '}
                <Link href="/dashboard/cooperative/intake/export-lots/new" className="underline">
                  create one
                </Link>{' '}
                once a mill lot is ready, then come back here to link it.
              </p>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 px-3 py-2 rounded-xl">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !batchId.trim()}
              className="px-5 py-2 bg-[#C9A96E] hover:bg-[#B8935C] disabled:opacity-40 text-black font-bold rounded-xl text-sm transition"
            >
              {creating ? 'Generating…' : 'Generate passport'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setError(null) }}
              className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Passport list */}
      {passports.length === 0 ? (
        <div className="bg-[#0D0F14]/40 border border-[#2A2D35] border-dashed rounded-2xl p-12 text-center space-y-3">
          <Coffee size={32} className="text-zinc-700 mx-auto" />
          <h4 className="text-sm font-bold text-zinc-400">No passports yet</h4>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto">
            Create a processing batch from the intake module, then generate a passport here
            to make your coffee&apos;s origin story discoverable by buyers worldwide.
          </p>
        </div>
      ) : (
        <div>
          {drafts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Drafts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drafts.map(p => <PassportCard key={p.id} passport={p} onPublish={handlePublish} />)}
              </div>
            </div>
          )}
          {published.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Published</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {published.map(p => <PassportCard key={p.id} passport={p} onPublish={handlePublish} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
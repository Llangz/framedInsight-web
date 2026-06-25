'use client'

/**
 * app/dashboard/cooperative/intake/[lotId]/LotDetailClient.tsx
 *
 * Full intake lot detail view:
 *  - Lot header with status, lot number, key metrics
 *  - Delivery list (farmers received so far)
 *  - Add delivery form (farmer, cherry kg, receipt number, quality)
 *  - Processing record form (fermentation, parchment, moisture)
 *  - "Start processing" → createProcessingBatch()
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Scale, Users, Package, ChevronDown, ChevronUp,
  Plus, CheckCircle2, Clock, AlertCircle, Loader2, Coffee,
  Thermometer, Droplets, Info, ClipboardList, Archive,
} from 'lucide-react'
import { addDeliveryToLot, updateLotProcessing } from '../actions'
import { createProcessingBatch } from '../batch-actions'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Farm { id: string; farm_name: string; owner_name: string; phone: string; coop_factory_id: string | null }

interface Delivery {
  id: string
  farm_id: string
  farmer_cherry_kg: number | null
  farmer_mbuni_kg: number | null
  receipt_number: string | null
  delivery_date: string | null
  quality_grade: string | null
  cherry_condition: string | null
  accepted: boolean
  rejection_reason: string | null
  farms?: { farm_name: string; owner_name: string; phone: string } | null
}

interface Lot {
  id: string
  lot_number: string
  factory_id: string
  cooperative_id: string
  intake_date: string
  season: string | null
  harvest_year: number | null
  total_cherry_kg: number | null
  total_mbuni_kg: number | null
  total_farmers: number | null
  outturn_ratio: number | null
  parchment_kg: number | null
  fermentation_hours: number | null
  moisture_content_pct: number | null
  drying_days: number | null
  nce_transaction_id: string | null
  status: string
  clerk_name: string | null
  notes: string | null
  coop_factories?: { factory_name: string; factory_code: string | null } | null
}

interface Props {
  lot: Lot
  deliveries: Delivery[]
  farms: Farm[]
  coopId: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GRADES = ['AA', 'AB', 'C', 'PB', 'TT', 'E', 'MH/ML', 'UG'] as const
const CONDITIONS = [
  { value: 'red_ripe',  label: 'Red ripe (ideal)' },
  { value: 'mixed',     label: 'Mixed (red + some green)' },
  { value: 'unripe',    label: 'Mostly unripe (green)' },
  { value: 'overripe',  label: 'Overripe / black' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:       { label: 'Open — accepting deliveries', color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-900/30' },
  processing: { label: 'Processing',                  color: 'text-blue-400',    bg: 'bg-blue-950/40 border-blue-900/30'       },
  milled:     { label: 'Milled',                      color: 'text-purple-400',  bg: 'bg-purple-950/40 border-purple-900/30'   },
  exported:   { label: 'Exported',                    color: 'text-[#C9A96E]',   bg: 'bg-amber-950/40 border-amber-900/30'    },
  closed:     { label: 'Closed',                      color: 'text-zinc-500',    bg: 'bg-zinc-900/40 border-zinc-800/30'      },
}

const FIELD = 'w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 text-sm outline-none focus:ring-2 focus:ring-[#C9A96E]/40 transition'
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Grade badge ───────────────────────────────────────────────────────────────
function GradeBadge({ grade }: { grade: string | null }) {
  const colors: Record<string, string> = {
    AA: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/40',
    AB: 'text-sky-400 bg-sky-950/40 border-sky-900/40',
    PB: 'text-purple-400 bg-purple-950/40 border-purple-900/40',
    C:  'text-amber-400 bg-amber-950/40 border-amber-900/40',
  }
  if (!grade) return <span className="text-zinc-600 text-xs">—</span>
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${colors[grade] ?? 'text-zinc-300 bg-zinc-800/40 border-zinc-700/40'}`}>
      {grade}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LotDetailClient({ lot, deliveries: initialDeliveries, farms, coopId }: Props) {
  const [deliveries, setDeliveries] = useState(initialDeliveries)
  const [showAddDelivery, setShowAddDelivery] = useState(false)
  const [showProcessing, setShowProcessing] = useState(false)

  // Delivery form state
  const [farmId, setFarmId]           = useState('')
  const [cherryKg, setCherryKg]       = useState('')
  const [mbuniKg, setMbuniKg]         = useState('0')
  const [receiptNo, setReceiptNo]     = useState('')
  const [deliveryDate, setDeliveryDate] = useState(lot.intake_date)
  const [grade, setGrade]             = useState('AB')
  const [condition, setCondition]     = useState('red_ripe')
  const [accepted, setAccepted]       = useState(true)
  const [rejectionReason, setRejectionReason] = useState('')
  const [addingDelivery, setAddingDelivery]   = useState(false)
  const [deliveryError, setDeliveryError]     = useState<string | null>(null)

  // Processing form state
  const [fermentHours, setFermentHours]   = useState('')
  const [parchmentKg, setParchmentKg]     = useState('')
  const [moisturePct, setMoisturePct]     = useState('')
  const [dryingDays, setDryingDays]       = useState('')
  const [nceRef, setNceRef]               = useState(lot.nce_transaction_id ?? '')
  const [processingStatus, setProcessingStatus] = useState<string>('processing')
  const [updatingProcessing, setUpdatingProcessing] = useState(false)
  const [processingError, setProcessingError]       = useState<string | null>(null)

  // Batch promotion
  const [promotingBatch, setPromotingBatch] = useState(false)
  const [batchId, setBatchId]               = useState<string | null>(null)

  const status = STATUS_CONFIG[lot.status] ?? STATUS_CONFIG.closed
  const factory = lot.coop_factories as any
  const canAddDelivery = lot.status === 'open'

  // Running totals from live delivery list
  const liveCherry = deliveries.filter(d => d.accepted).reduce((s, d) => s + (d.farmer_cherry_kg ?? 0), 0)
  const liveFarmers = new Set(deliveries.map(d => d.farm_id)).size

  // ── Add delivery ──────────────────────────────────────────────────────────
  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!farmId || !cherryKg) return
    setAddingDelivery(true)
    setDeliveryError(null)

    const res = await addDeliveryToLot({
      lotId: lot.id,
      farmId,
      cherryKg: parseFloat(cherryKg),
      mbuniKg: parseFloat(mbuniKg) || 0,
      receiptNumber: receiptNo || undefined,
      deliveryDate,
      qualityGrade: grade,
      cherryCondition: condition,
      accepted,
      rejectionReason: accepted ? undefined : rejectionReason,
    })

    setAddingDelivery(false)
    if (!res.success) { setDeliveryError(res.error ?? 'Failed'); return }

    // Optimistically add to list
    const farm = farms.find(f => f.id === farmId)
    setDeliveries(prev => [{
      ...res.delivery,
      farms: farm ? { farm_name: farm.farm_name, owner_name: farm.owner_name, phone: farm.phone } : null,
    } as any, ...prev])

    // Reset form
    setCherryKg(''); setMbuniKg('0'); setReceiptNo(''); setFarmId('')
    setShowAddDelivery(false)
  }

  // ── Update processing record ──────────────────────────────────────────────
  const handleUpdateProcessing = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdatingProcessing(true)
    setProcessingError(null)

    const res = await updateLotProcessing({
      lotId: lot.id,
      fermentationHours: fermentHours ? parseFloat(fermentHours) : undefined,
      parchmentKg: parchmentKg ? parseFloat(parchmentKg) : undefined,
      moistureContentPct: moisturePct ? parseFloat(moisturePct) : undefined,
      dryingDays: dryingDays ? parseInt(dryingDays) : undefined,
      nceTransactionId: nceRef || undefined,
      status: processingStatus as any,
    })

    setUpdatingProcessing(false)
    if (!res.success) { setProcessingError(res.error ?? 'Failed'); return }
    setShowProcessing(false)
  }

  // ── Promote to processing batch ───────────────────────────────────────────
  const handleStartProcessing = async () => {
    if (!confirm('Close this lot to new deliveries and start processing? This writes a tamper-evident event to the traceability ledger.')) return
    setPromotingBatch(true)

    const res = await createProcessingBatch({ intakeLotId: lot.id })
    setPromotingBatch(false)
    if (!res.success) { alert(res.error); return }
    setBatchId(res.batch.id)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

      {/* ── Breadcrumb + header ────────────────────────────────────────────── */}
      <div className="border-b border-[#2A2D35] pb-6">
        <Link
          href="/dashboard/cooperative/intake"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-4"
        >
          <ArrowLeft size={12} /> All intake lots
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold font-mono text-[#C9A96E]">{lot.lot_number}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              {factory?.factory_name ?? 'Cooperative factory'} · {fmt(lot.intake_date)}
              {lot.season && ` · ${lot.season === 'main' ? 'Main Crop' : 'Fly Crop'} ${lot.harvest_year}`}
              {lot.clerk_name && ` · Clerk: ${lot.clerk_name}`}
            </p>
          </div>

          {/* Promote to batch button */}
          {lot.status === 'open' && !batchId && (
            <button
              onClick={handleStartProcessing}
              disabled={promotingBatch || deliveries.length === 0}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition"
            >
              <Coffee size={14} />
              {promotingBatch ? 'Starting…' : 'Start processing'}
            </button>
          )}
          {batchId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-950/40 border border-blue-900/30 rounded-xl text-xs text-blue-300 font-semibold">
              <CheckCircle2 size={12} />
              Processing batch created
            </div>
          )}
        </div>
      </div>

      {/* ── Metric strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Cherry received',  value: `${(lot.total_cherry_kg ?? liveCherry).toLocaleString()} kg` },
          { label: 'Farmers',          value: lot.total_farmers ?? liveFarmers },
          { label: 'Parchment',        value: lot.parchment_kg ? `${lot.parchment_kg.toLocaleString()} kg` : '—' },
          { label: 'Outturn ratio',    value: lot.outturn_ratio ? `${(lot.outturn_ratio * 100).toFixed(1)}%` : '—' },
        ].map(m => (
          <div key={m.label} className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{m.label}</span>
            <span className="block text-xl font-bold text-[#C9A96E]">{m.value}</span>
          </div>
        ))}
      </div>

      {/* ── Processing record accordion ────────────────────────────────────── */}
      {lot.status !== 'open' && (
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowProcessing(!showProcessing)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-white hover:bg-zinc-900/30 transition"
          >
            <span className="flex items-center gap-2">
              <Thermometer size={14} className="text-blue-400" />
              Processing record
            </span>
            {showProcessing ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
          </button>

          {showProcessing && (
            <form onSubmit={handleUpdateProcessing} className="px-5 pb-5 border-t border-[#2A2D35] pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Fermentation hours</label>
                  <input type="number" value={fermentHours} onChange={e => setFermentHours(e.target.value)}
                    placeholder={lot.fermentation_hours?.toString() ?? '36'} className={FIELD} min={0} max={120} step={0.5} />
                </div>
                <div>
                  <label className={LABEL}>Parchment kg (after drying)</label>
                  <input type="number" value={parchmentKg} onChange={e => setParchmentKg(e.target.value)}
                    placeholder={lot.parchment_kg?.toString() ?? '0'} className={FIELD} min={0} step={0.1} />
                </div>
                <div>
                  <label className={LABEL}>Moisture % (target 10–12)</label>
                  <input type="number" value={moisturePct} onChange={e => setMoisturePct(e.target.value)}
                    placeholder={lot.moisture_content_pct?.toString() ?? '11.5'} className={FIELD} min={8} max={18} step={0.1} />
                </div>
                <div>
                  <label className={LABEL}>Drying days</label>
                  <input type="number" value={dryingDays} onChange={e => setDryingDays(e.target.value)}
                    placeholder={lot.drying_days?.toString() ?? '21'} className={FIELD} min={0} max={60} />
                </div>
              </div>
              <div>
                <label className={LABEL}>NCE transaction reference</label>
                <input type="text" value={nceRef} onChange={e => setNceRef(e.target.value)}
                  placeholder={lot.nce_transaction_id ?? 'e.g. NCE-2026-XXXXXX'} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Update status</label>
                <select value={processingStatus} onChange={e => setProcessingStatus(e.target.value)} className={FIELD}>
                  <option value="processing">Processing</option>
                  <option value="milled">Milled</option>
                  <option value="exported">Exported</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              {processingError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={11} />{processingError}</p>
              )}
              <button type="submit" disabled={updatingProcessing}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition">
                {updatingProcessing ? 'Saving…' : 'Save processing record'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Deliveries section ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Scale size={15} className="text-[#C9A96E]" />
            Farmer deliveries
            <span className="text-zinc-500 font-normal text-sm">({deliveries.length})</span>
          </h2>
          {canAddDelivery && (
            <button
              onClick={() => setShowAddDelivery(!showAddDelivery)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold rounded-xl text-xs transition"
            >
              <Plus size={12} />
              Add delivery
            </button>
          )}
        </div>

        {/* Add delivery form */}
        {showAddDelivery && (
          <form onSubmit={handleAddDelivery} className="bg-[#0D0F14] border border-[#C9A96E]/20 rounded-2xl p-5 space-y-4 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus size={13} className="text-[#C9A96E]" /> Record a delivery
            </h3>

            {/* Farmer select */}
            <div>
              <label className={LABEL}>Member farmer *</label>
              <select value={farmId} onChange={e => setFarmId(e.target.value)} className={FIELD} required>
                <option value="">Select farmer</option>
                {farms.map(f => (
                  <option key={f.id} value={f.id}>{f.owner_name} — {f.farm_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cherry kg */}
              <div>
                <label className={LABEL}>Cherry kg *</label>
                <input type="number" value={cherryKg} onChange={e => setCherryKg(e.target.value)}
                  placeholder="e.g. 120" className={FIELD} min={0} step={0.5} required />
              </div>
              {/* Mbuni kg */}
              <div>
                <label className={LABEL}>Mbuni kg <span className="text-zinc-600">(dried cherry)</span></label>
                <input type="number" value={mbuniKg} onChange={e => setMbuniKg(e.target.value)}
                  placeholder="0" className={FIELD} min={0} step={0.5} />
              </div>
              {/* Receipt number */}
              <div>
                <label className={LABEL}>Receipt number</label>
                <input type="text" value={receiptNo} onChange={e => setReceiptNo(e.target.value)}
                  placeholder="e.g. 00842" className={FIELD} />
              </div>
              {/* Delivery date */}
              <div>
                <label className={LABEL}>Delivery date *</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  className={FIELD} required />
              </div>
              {/* Grade */}
              <div>
                <label className={LABEL}>Quality grade</label>
                <select value={grade} onChange={e => setGrade(e.target.value)} className={FIELD}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {/* Cherry condition */}
              <div>
                <label className={LABEL}>Cherry condition</label>
                <select value={condition} onChange={e => setCondition(e.target.value)} className={FIELD}>
                  {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Accept / reject */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4" />
                <span className="text-zinc-300">Accepted</span>
              </label>
              {!accepted && (
                <input type="text" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Rejection reason…" className={`flex-1 ${FIELD}`} />
              )}
            </div>

            {deliveryError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={11} />{deliveryError}</p>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={addingDelivery || !farmId || !cherryKg}
                className="px-5 py-2.5 bg-[#C9A96E] hover:bg-[#B8935C] disabled:opacity-40 text-black font-bold rounded-xl text-sm transition">
                {addingDelivery ? 'Recording…' : 'Record delivery'}
              </button>
              <button type="button" onClick={() => setShowAddDelivery(false)}
                className="px-4 py-2.5 text-zinc-400 hover:text-white text-sm transition">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Deliveries table */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
          {deliveries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2A2D35] bg-[#0A0C10]/60 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Farmer</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Cherry kg</th>
                    <th className="px-5 py-3 text-right">Mbuni kg</th>
                    <th className="px-5 py-3">Receipt</th>
                    <th className="px-5 py-3 text-center">Grade</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D35] text-sm">
                  {deliveries.map(d => {
                    const farm = d.farms as any
                    return (
                      <tr key={d.id} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="px-5 py-3">
                          <span className="block font-semibold text-white text-xs">{farm?.owner_name ?? '—'}</span>
                          <span className="block text-zinc-500 text-[10px]">{farm?.farm_name}</span>
                        </td>
                        <td className="px-5 py-3 text-zinc-400 text-xs">{d.delivery_date ? fmt(d.delivery_date) : '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold text-zinc-200">{d.farmer_cherry_kg?.toLocaleString() ?? '—'}</td>
                        <td className="px-5 py-3 text-right text-zinc-500">{d.farmer_mbuni_kg ? d.farmer_mbuni_kg.toLocaleString() : '—'}</td>
                        <td className="px-5 py-3 font-mono text-xs text-zinc-400">{d.receipt_number ?? '—'}</td>
                        <td className="px-5 py-3 text-center"><GradeBadge grade={d.quality_grade} /></td>
                        <td className="px-5 py-3 text-center">
                          {d.accepted
                            ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 size={10} /> Accepted</span>
                            : <span className="inline-flex items-center gap-1 text-[10px] text-red-400"><AlertCircle size={10} /> Rejected</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center space-y-2">
              <Users size={28} className="text-zinc-700 mx-auto" />
              <p className="text-sm font-bold text-zinc-400">No deliveries recorded yet</p>
              <p className="text-xs text-zinc-600">
                {canAddDelivery
                  ? "Use the 'Add delivery' button above to record each farmer's cherry delivery."
                  : 'This lot was closed before any deliveries were recorded.'}
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        {lot.notes && (
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 flex items-start gap-3 mt-4">
            <Info size={13} className="text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-400 leading-relaxed">{lot.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
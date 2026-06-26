'use client'

/**
 * app/dashboard/cooperative/intake/export-lots/new/NewExportLotClient.tsx
 *
 * Form to create an export lot from one or more milled mill lots.
 * This is the record a Coffee Passport links to — buyer details, shipping
 * documents, and EUDR compliance status all live here.
 */

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Ship, ArrowLeft, AlertCircle, Calendar, Package,
  Shield, Info, Globe, Anchor, FileText,
} from 'lucide-react'
import { createExportLot } from '../actions'

interface MillLot {
  id: string
  mill_lot_number: string
  mill_name: string | null
  milling_date: string | null
  clean_coffee_kg_out: number | null
}

interface Props {
  millLots: MillLot[]
  coopId: string
}

const FIELD = 'w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 text-sm outline-none focus:ring-2 focus:ring-[#C9A96E]/40 transition'
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5'
const GRADES = ['AA', 'AB', 'PB', 'C', 'TT', 'E'] as const
const STATUSES = ['pending', 'confirmed', 'shipped', 'arrived', 'completed'] as const

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NewExportLotClient({ millLots, coopId }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporterName, setExporterName] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [buyerCountry, setBuyerCountry] = useState('')
  const [destinationPort, setDestinationPort] = useState('')
  const [originPort, setOriginPort] = useState('Mombasa')
  const [containerNumber, setContainerNumber] = useState('')
  const [billOfLading, setBillOfLading] = useState('')
  const [grade, setGrade] = useState<typeof GRADES[number]>('AA')
  const [processingMethod, setProcessingMethod] = useState('washed')
  const [netWeightKg, setNetWeightKg] = useState('')
  const [totalBags, setTotalBags] = useState('')
  const [scaScore, setScaScore] = useState('')
  const [fobPrice, setFobPrice] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [status, setStatus] = useState<typeof STATUSES[number]>('pending')
  const [eudrCompliant, setEudrCompliant] = useState(false)
  const [eudrDdsRef, setEudrDdsRef] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleMillLot = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedMillLots = millLots.filter(m => selected.has(m.id))
  const totalCleanKg = useMemo(
    () => selectedMillLots.reduce((s, m) => s + (m.clean_coffee_kg_out ?? 0), 0),
    [selectedMillLots]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selected.size === 0) { setError('Select at least one mill lot'); return }

    setLoading(true)
    setError(null)

    const res = await createExportLot({
      millLotIds: Array.from(selected),
      exporterName: exporterName.trim() || undefined,
      buyerName: buyerName.trim() || undefined,
      buyerCountry: buyerCountry.trim() || undefined,
      destinationPort: destinationPort.trim() || undefined,
      originPort: originPort.trim() || undefined,
      containerNumber: containerNumber.trim() || undefined,
      billOfLading: billOfLading.trim() || undefined,
      grade,
      processingMethod,
      netWeightKg: netWeightKg ? parseFloat(netWeightKg) : undefined,
      totalBags: totalBags ? parseInt(totalBags) : undefined,
      scaCuppingScore: scaScore ? parseFloat(scaScore) : undefined,
      fobPriceUsdPerKg: fobPrice ? parseFloat(fobPrice) : undefined,
      departureDate: departureDate || undefined,
      status,
      eudrCompliant,
      eudrDdsReference: eudrDdsRef.trim() || undefined,
      notes: notes.trim() || undefined,
    })

    setLoading(false)
    if (!res.success) { setError(res.error ?? 'Failed to create export lot'); return }
    router.push('/dashboard/cooperative/intake/export-lots')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2A2D35] pb-6">
        <Link
          href="/dashboard/cooperative/intake/export-lots"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-4"
        >
          <ArrowLeft size={12} /> Back to export lots
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ship size={20} className="text-[#C9A96E]" />
          New export lot
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Combine one or more mill lots into a shipment. This is the record a Coffee Passport
          links to, so buyer-facing fields below appear on the public trace page.
        </p>
      </div>

      {/* ── No eligible mill lots guard ─────────────────────────────────── */}
      {millLots.length === 0 ? (
        <div className="bg-amber-950/30 border border-amber-900/30 rounded-2xl p-6 space-y-3 text-center">
          <Package size={32} className="text-amber-500 mx-auto" />
          <h3 className="font-bold text-white">No mill lots ready for export</h3>
          <p className="text-sm text-zinc-400">
            Create a mill lot first — once it&apos;s at &lsquo;milled&rsquo; status and not already
            linked to another shipment, it&apos;ll show up here.
          </p>
          <Link
            href="/dashboard/cooperative/intake/mill-lots/new"
            className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition"
          >
            Go to mill lots
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Mill lot selection */}
          <div>
            <label className={LABEL}>Mill lots *</label>
            <div className="space-y-2">
              {millLots.map(m => {
                const checked = selected.has(m.id)
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                      checked
                        ? 'bg-[#C9A96E]/10 border-[#C9A96E]/40'
                        : 'bg-[#0D0F14] border-[#2A2D35] hover:border-zinc-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMillLot(m.id)}
                      className="accent-[#C9A96E] w-4 h-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-white font-mono">{m.mill_lot_number}</span>
                      <span className="block text-[10px] text-zinc-500 mt-0.5">
                        {m.mill_name ?? 'Dry mill'} · {fmt(m.milling_date)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-300 shrink-0">
                      {m.clean_coffee_kg_out ? `${m.clean_coffee_kg_out.toLocaleString()} kg` : '—'}
                    </span>
                  </label>
                )
              })}
            </div>
            {selected.size > 0 && (
              <p className="text-[10px] text-zinc-500 mt-2">
                {selected.size} mill lot{selected.size > 1 ? 's' : ''} selected ·{' '}
                <span className="text-[#C9A96E] font-semibold">{totalCleanKg.toLocaleString()} kg</span> clean coffee available
              </p>
            )}
          </div>

          {/* Buyer details */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Globe size={12} className="text-[#C9A96E]" />
              Buyer & exporter
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Exporter name</label>
                <input type="text" value={exporterName} onChange={e => setExporterName(e.target.value)}
                  placeholder="e.g. Sucafina Kenya" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Buyer / roaster name</label>
                <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)}
                  placeholder="e.g. Stockholm Roasters AB" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Buyer country</label>
                <input type="text" value={buyerCountry} onChange={e => setBuyerCountry(e.target.value)}
                  placeholder="e.g. Sweden" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Destination port</label>
                <input type="text" value={destinationPort} onChange={e => setDestinationPort(e.target.value)}
                  placeholder="e.g. Hamburg" className={FIELD} />
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[10px] text-zinc-500">
              <Info size={10} className="shrink-0 mt-0.5" />
              Buyer name and country are stored for your own shipment records but are deliberately
              excluded from the public passport page and B2B API — they stay internal to your cooperative.
            </p>
          </div>

          {/* Shipping documents */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Anchor size={12} className="text-[#C9A96E]" />
              Shipping
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Origin port</label>
                <input type="text" value={originPort} onChange={e => setOriginPort(e.target.value)}
                  className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Departure date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)}
                    className={`${FIELD} pl-9`} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Container number</label>
                <input type="text" value={containerNumber} onChange={e => setContainerNumber(e.target.value)}
                  placeholder="e.g. MSKU1234567" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Bill of lading</label>
                <input type="text" value={billOfLading} onChange={e => setBillOfLading(e.target.value)}
                  placeholder="B/L reference" className={FIELD} />
              </div>
            </div>
          </div>

          {/* Coffee details */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Package size={12} className="text-[#C9A96E]" />
              Coffee details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Grade</label>
                <select value={grade} onChange={e => setGrade(e.target.value as typeof GRADES[number])} className={FIELD}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Processing method</label>
                <select value={processingMethod} onChange={e => setProcessingMethod(e.target.value)} className={FIELD}>
                  <option value="washed">Washed</option>
                  <option value="natural">Natural</option>
                  <option value="honey">Honey</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Net weight (kg)</label>
                <input type="number" value={netWeightKg} onChange={e => setNetWeightKg(e.target.value)}
                  placeholder={totalCleanKg ? totalCleanKg.toString() : '0'} className={FIELD} min={0} step={0.1} />
              </div>
              <div>
                <label className={LABEL}>Total bags (60kg)</label>
                <input type="number" value={totalBags} onChange={e => setTotalBags(e.target.value)}
                  placeholder="e.g. 70" className={FIELD} min={0} />
              </div>
              <div>
                <label className={LABEL}>SCA cupping score</label>
                <input type="number" value={scaScore} onChange={e => setScaScore(e.target.value)}
                  placeholder="e.g. 86.5" className={FIELD} min={70} max={100} step={0.1} />
              </div>
              <div>
                <label className={LABEL}>FOB price (USD / kg)</label>
                <input type="number" value={fobPrice} onChange={e => setFobPrice(e.target.value)}
                  placeholder="e.g. 6.20" className={FIELD} min={0} step={0.01} />
              </div>
            </div>
          </div>

          {/* EUDR */}
          <div className="bg-[#0D0F14] border border-emerald-900/30 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Shield size={12} className="text-emerald-400" />
              EUDR compliance
            </h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={eudrCompliant} onChange={e => setEudrCompliant(e.target.checked)}
                className="accent-emerald-500 w-4 h-4" />
              <span className="text-zinc-300">Mark this export lot as EUDR compliant</span>
            </label>
            <p className="flex items-start gap-1.5 text-[10px] text-zinc-500">
              <Info size={10} className="shrink-0 mt-0.5" />
              Confirm every contributing plot shows as compliant on the{' '}
              <Link href="/dashboard/cooperative/eudr" className="underline text-zinc-400 hover:text-zinc-200">
                EUDR Compliance dashboard
              </Link>{' '}
              before checking this — it isn&apos;t calculated automatically yet.
            </p>
            <div>
              <label className={LABEL}>EUDR DDS reference number</label>
              <div className="relative">
                <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input type="text" value={eudrDdsRef} onChange={e => setEudrDdsRef(e.target.value)}
                  placeholder="Filed in the EU Information System (TRACES)" className={`${FIELD} pl-9`} />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={LABEL}>Shipment status</label>
            <select value={status} onChange={e => setStatus(e.target.value as typeof STATUSES[number])} className={FIELD}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Anything else worth recording about this shipment…"
              className={`${FIELD} resize-none`} />
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-xl flex items-start gap-2 text-xs text-red-300">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading || selected.size === 0}
              className="flex-1 py-3 bg-[#C9A96E] hover:bg-[#B8935C] disabled:opacity-40 text-black font-bold rounded-xl text-sm transition">
              {loading ? 'Creating…' : 'Create export lot'}
            </button>
            <Link href="/dashboard/cooperative/intake/export-lots"
              className="px-5 py-3 border border-[#2A2D35] text-zinc-400 hover:text-white rounded-xl text-sm transition text-center">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
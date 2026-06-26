'use client'

/**
 * app/dashboard/cooperative/intake/mill-lots/new/NewMillLotClient.tsx
 *
 * Form to create a mill lot from one or more milled processing batches.
 * Officer selects the contributing batches, enters the dry-mill outturn,
 * and (optionally) the NCE auction reference.
 */

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Package, ArrowLeft, AlertCircle, Calendar, Droplets,
  Gavel, Info, CheckCircle2, Coffee,
} from 'lucide-react'
import { createMillLot } from '../actions'

interface Batch {
  id: string
  batch_number: string
  parchment_kg: number | null
  intake_date: string
  factory_intake_lots?: {
    lot_number: string
    coop_factories?: { factory_name: string; factory_code: string | null } | null
  } | null
}

interface Props {
  batches: Batch[]
  coopId: string
}

const FIELD = 'w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 text-sm outline-none focus:ring-2 focus:ring-[#C9A96E]/40 transition'
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NewMillLotClient({ batches, coopId }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [millName, setMillName] = useState('')
  const [millingDate, setMillingDate] = useState(today)
  const [cleanKgOut, setCleanKgOut] = useState('')
  const [moisturePct, setMoisturePct] = useState('')
  const [nceRef, setNceRef] = useState('')
  const [nceAuctionDate, setNceAuctionDate] = useState('')
  const [ncePrice, setNcePrice] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleBatch = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedBatches = batches.filter(b => selected.has(b.id))
  const totalParchment = useMemo(
    () => selectedBatches.reduce((s, b) => s + (b.parchment_kg ?? 0), 0),
    [selectedBatches]
  )
  const projectedOutturn = totalParchment > 0 && cleanKgOut
    ? (parseFloat(cleanKgOut) / totalParchment) * 100
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selected.size === 0) { setError('Select at least one processing batch'); return }
    if (!cleanKgOut) { setError('Enter the clean coffee output weight'); return }

    setLoading(true)
    setError(null)

    const res = await createMillLot({
      batchIds: Array.from(selected),
      millName: millName.trim() || undefined,
      millingDate,
      cleanCoffeeKgOut: parseFloat(cleanKgOut),
      moistureContentPct: moisturePct ? parseFloat(moisturePct) : undefined,
      nceTransactionId: nceRef.trim() || undefined,
      nceAuctionDate: nceAuctionDate || undefined,
      ncePriceUsdPerKg: ncePrice ? parseFloat(ncePrice) : undefined,
      notes: notes.trim() || undefined,
    })

    setLoading(false)
    if (!res.success) { setError(res.error ?? 'Failed to create mill lot'); return }
    router.push('/dashboard/cooperative/intake/mill-lots')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2A2D35] pb-6">
        <Link
          href="/dashboard/cooperative/intake/mill-lots"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-4"
        >
          <ArrowLeft size={12} /> Back to mill lots
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package size={20} className="text-[#C9A96E]" />
          New mill lot
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Combine one or more milled processing batches into a single dry-mill run.
        </p>
      </div>

      {/* ── No eligible batches guard ───────────────────────────────────── */}
      {batches.length === 0 ? (
        <div className="bg-amber-950/30 border border-amber-900/30 rounded-2xl p-6 space-y-3 text-center">
          <Coffee size={32} className="text-amber-500 mx-auto" />
          <h3 className="font-bold text-white">No batches ready for milling</h3>
          <p className="text-sm text-zinc-400">
            A processing batch must reach &lsquo;milled&rsquo; status in the intake module before it
            can be combined into a mill lot here. Once one is ready, it&apos;ll show up below.
          </p>
          <Link
            href="/dashboard/cooperative/intake"
            className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition"
          >
            Go to factory intake
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Batch selection */}
          <div>
            <label className={LABEL}>Processing batches *</label>
            <div className="space-y-2">
              {batches.map(b => {
                const factory = b.factory_intake_lots?.coop_factories
                const checked = selected.has(b.id)
                return (
                  <label
                    key={b.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                      checked
                        ? 'bg-[#C9A96E]/10 border-[#C9A96E]/40'
                        : 'bg-[#0D0F14] border-[#2A2D35] hover:border-zinc-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBatch(b.id)}
                      className="accent-[#C9A96E] w-4 h-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-white font-mono">{b.batch_number}</span>
                      <span className="block text-[10px] text-zinc-500 mt-0.5">
                        {factory?.factory_name ?? 'Cooperative'} · {fmt(b.intake_date)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-300 shrink-0">
                      {b.parchment_kg ? `${b.parchment_kg.toLocaleString()} kg` : '—'}
                    </span>
                  </label>
                )
              })}
            </div>
            {selected.size > 0 && (
              <p className="text-[10px] text-zinc-500 mt-2">
                {selected.size} batch{selected.size > 1 ? 'es' : ''} selected ·{' '}
                <span className="text-[#C9A96E] font-semibold">{totalParchment.toLocaleString()} kg</span> parchment in
              </p>
            )}
          </div>

          {/* Mill name + date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Dry mill</label>
              <input type="text" value={millName} onChange={e => setMillName(e.target.value)}
                placeholder="e.g. Othaya Farmers Mill" className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Milling date *</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input type="date" value={millingDate} onChange={e => setMillingDate(e.target.value)}
                  className={`${FIELD} pl-9`} required />
              </div>
            </div>
          </div>

          {/* Clean kg out + moisture */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Clean coffee out (kg) *</label>
              <input type="number" value={cleanKgOut} onChange={e => setCleanKgOut(e.target.value)}
                placeholder="e.g. 4200" className={FIELD} min={0} step={0.1} required />
            </div>
            <div>
              <label className={LABEL}>Moisture % at milling</label>
              <div className="relative">
                <Droplets size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input type="number" value={moisturePct} onChange={e => setMoisturePct(e.target.value)}
                  placeholder="11.0" className={`${FIELD} pl-9`} min={8} max={18} step={0.1} />
              </div>
            </div>
          </div>

          {projectedOutturn !== null && (
            <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <Info size={10} />
              Projected milling outturn:{' '}
              <span className={`font-bold ${projectedOutturn >= 65 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {projectedOutturn.toFixed(1)}%
              </span>{' '}
              (clean coffee target 60–75% of parchment)
            </p>
          )}

          {/* NCE auction reference */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Gavel size={12} className="text-[#C9A96E]" />
              Nairobi Coffee Exchange (optional)
            </h3>
            <div>
              <label className={LABEL}>NCE transaction reference</label>
              <input type="text" value={nceRef} onChange={e => setNceRef(e.target.value)}
                placeholder="e.g. NCE-2026-014872" className={FIELD} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Auction date</label>
                <input type="date" value={nceAuctionDate} onChange={e => setNceAuctionDate(e.target.value)}
                  className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Price (USD / kg)</label>
                <input type="number" value={ncePrice} onChange={e => setNcePrice(e.target.value)}
                  placeholder="e.g. 5.40" className={FIELD} min={0} step={0.01} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Grade breakdown, defects observed, anything unusual about this run…"
              className={`${FIELD} resize-none`} />
          </div>

          {/* Ledger info banner */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-xl p-3 flex items-start gap-2.5">
            <CheckCircle2 size={13} className="text-[#C9A96E] shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Creating this mill lot writes a hash-chained entry to the traceability ledger and
              permanently links the selected batches — they can&apos;t be reused in another mill lot.
            </p>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-xl flex items-start gap-2 text-xs text-red-300">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading || selected.size === 0 || !cleanKgOut}
              className="flex-1 py-3 bg-[#C9A96E] hover:bg-[#B8935C] disabled:opacity-40 text-black font-bold rounded-xl text-sm transition">
              {loading ? 'Creating…' : 'Create mill lot'}
            </button>
            <Link href="/dashboard/cooperative/intake/mill-lots"
              className="px-5 py-3 border border-[#2A2D35] text-zinc-400 hover:text-white rounded-xl text-sm transition text-center">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
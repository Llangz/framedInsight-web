'use client'

/**
 * app/dashboard/cooperative/intake/new/NewIntakeClient.tsx
 *
 * Form to open a new factory intake lot.
 * On submit → calls createIntakeLot() → redirects to the lot detail page.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList, ArrowLeft, Scale, Calendar,
  User, AlertCircle, Warehouse, Info,
} from 'lucide-react'
import { createIntakeLot } from '../actions'
import { getCurrentSeason, getCurrentHarvestYear } from '@/lib/intake.types'

interface Factory {
  id: string
  factory_name: string
  factory_code: string | null
  branch_type: string | null
}

interface Props {
  factories: Factory[]
  coopId: string
}

const FIELD = 'w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 text-sm outline-none focus:ring-2 focus:ring-[#C9A96E]/40 transition'
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5'

export default function NewIntakeClient({ factories, coopId }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [factoryId, setFactoryId]   = useState(factories[0]?.id ?? '')
  const [intakeDate, setIntakeDate] = useState(today)
  const [season, setSeason]         = useState<'main' | 'fly'>(getCurrentSeason())
  const [harvestYear, setHarvestYear] = useState(getCurrentHarvestYear())
  const [clerkName, setClerkName]   = useState('')
  const [notes, setNotes]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const selectedFactory = factories.find(f => f.id === factoryId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factoryId) { setError('Please select a washing station'); return }
    setLoading(true)
    setError(null)

    const res = await createIntakeLot({
      factoryId,
      intakeDate,
      season,
      harvestYear,
      clerkName: clerkName.trim() || undefined,
      notes: notes.trim() || undefined,
    })

    setLoading(false)
    if (!res.success) { setError(res.error ?? 'Failed to create lot'); return }
    router.push(`/dashboard/cooperative/intake/${res.lot.id}`)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2A2D35] pb-6">
        <Link
          href="/dashboard/cooperative/intake"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-4"
        >
          <ArrowLeft size={12} /> Back to intake lots
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList size={20} className="text-[#C9A96E]" />
          Open new intake lot
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          This creates the custody record for today's cherry intake. Farmer deliveries are added on the lot detail page.
        </p>
      </div>

      {/* ── No factories guard ───────────────────────────────────────────── */}
      {factories.length === 0 ? (
        <div className="bg-amber-950/30 border border-amber-900/30 rounded-2xl p-6 space-y-3 text-center">
          <Warehouse size={32} className="text-amber-500 mx-auto" />
          <h3 className="font-bold text-white">No washing stations configured</h3>
          <p className="text-sm text-zinc-400">
            You need at least one washing station with a traceability code before you can open an intake lot.
          </p>
          <Link
            href="/dashboard/cooperative/factories"
            className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition"
          >
            Add a washing station
          </Link>
        </div>
      ) : (

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Factory */}
          <div>
            <label className={LABEL}>Washing station *</label>
            <select
              value={factoryId}
              onChange={e => setFactoryId(e.target.value)}
              className={FIELD}
              required
            >
              <option value="" disabled>Select a washing station</option>
              {factories.map(f => (
                <option key={f.id} value={f.id}>
                  {f.factory_name}{f.factory_code ? ` (${f.factory_code})` : ''}
                </option>
              ))}
            </select>
            {selectedFactory && !selectedFactory.factory_code && (
              <p className="flex items-center gap-1.5 text-[10px] text-amber-400 mt-1.5">
                <Info size={10} />
                This station has no traceability code — lot numbers cannot be generated until one is added in{' '}
                <Link href="/dashboard/cooperative/factories" className="underline">Washing Stations</Link>.
              </p>
            )}
            {selectedFactory?.factory_code && (
              <p className="text-[10px] text-zinc-500 mt-1.5">
                Lot numbers will be prefixed <span className="font-mono text-[#C9A96E]">{selectedFactory.factory_code}</span>
              </p>
            )}
          </div>

          {/* Intake date */}
          <div>
            <label className={LABEL}>Intake date *</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="date"
                value={intakeDate}
                onChange={e => setIntakeDate(e.target.value)}
                className={`${FIELD} pl-9`}
                required
              />
            </div>
          </div>

          {/* Season + year row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Season</label>
              <select
                value={season}
                onChange={e => setSeason(e.target.value as 'main' | 'fly')}
                className={FIELD}
              >
                <option value="main">Main Crop (Oct–Jan)</option>
                <option value="fly">Fly Crop (Apr–Jul)</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Harvest year</label>
              <input
                type="number"
                value={harvestYear}
                onChange={e => setHarvestYear(Number(e.target.value))}
                min={2020}
                max={2035}
                className={FIELD}
              />
            </div>
          </div>

          {/* Clerk name */}
          <div>
            <label className={LABEL}>Intake clerk name</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={clerkName}
                onChange={e => setClerkName(e.target.value)}
                placeholder="Name of officer recording this lot"
                className={`${FIELD} pl-9`}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any special conditions, quality observations for this batch…"
              className={`${FIELD} resize-none`}
            />
          </div>

          {/* Ledger info banner */}
          <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-xl p-3 flex items-start gap-2.5">
            <Scale size={13} className="text-[#C9A96E] shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Opening this lot creates a tamper-evident entry in the traceability ledger.
              Every subsequent delivery, processing record, and status change is hash-chained
              to this genesis event.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-xl flex items-start gap-2 text-xs text-red-300">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading || !factoryId}
              className="flex-1 py-3 bg-[#C9A96E] hover:bg-[#B8935C] disabled:opacity-40 text-black font-bold rounded-xl text-sm transition"
            >
              {loading ? 'Opening lot…' : 'Open intake lot'}
            </button>
            <Link
              href="/dashboard/cooperative/intake"
              className="px-5 py-3 border border-[#2A2D35] text-zinc-400 hover:text-white rounded-xl text-sm transition text-center"
            >
              Cancel
            </Link>
          </div>

        </form>
      )}
    </div>
  )
}
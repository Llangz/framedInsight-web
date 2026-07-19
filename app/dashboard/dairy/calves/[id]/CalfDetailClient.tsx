'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Baby, Milk, Sparkles, Banknote, CircleDashed, Scale, CalendarDays } from 'lucide-react'
import { recordWeaning, promoteToHerd, updateCalfStatus } from './actions'

const STATUS_META: Record<string, { label: string; Icon: any; color: string; border: string; bg: string }> = {
  nursing:  { label: 'Nursing',  Icon: Baby,        color: 'text-emerald-400', border: 'border-emerald-900/40', bg: 'bg-emerald-950/30' },
  weaned:   { label: 'Weaned',   Icon: Milk,         color: 'text-sky-400',     border: 'border-sky-900/40',     bg: 'bg-sky-950/30' },
  promoted: { label: 'Promoted', Icon: Sparkles,     color: 'text-amber-400',   border: 'border-amber-900/40',   bg: 'bg-amber-950/30' },
  sold:     { label: 'Sold',     Icon: Banknote,     color: 'text-blue-400',    border: 'border-blue-900/40',    bg: 'bg-blue-950/30' },
  deceased: { label: 'Deceased', Icon: CircleDashed, color: 'text-[#6B7280]',   border: 'border-[#2A2D35]',      bg: 'bg-[#0D0F14]' },
}

const inputCls = () =>
  'w-full px-3 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#0D0F14] text-white placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-emerald-700'

export default function CalfDetailClient({ calf }: { calf: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weaningDate, setWeaningDate] = useState(new Date().toISOString().split('T')[0])
  const [weaningWeight, setWeaningWeight] = useState('')
  const [showWeanForm, setShowWeanForm] = useState(false)

  const status = calf.status || 'nursing'
  const meta = STATUS_META[status] || STATUS_META.nursing
  const { Icon } = meta

  async function handleWean(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await recordWeaning(calf.id, { weaning_date: weaningDate, weaning_weight: weaningWeight })
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Could not save')
      return
    }
    router.refresh()
    setShowWeanForm(false)
  }

  async function handlePromote() {
    setLoading(true)
    setError(null)
    const result = await promoteToHerd(calf.id)
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Could not promote')
      return
    }
    router.push(`/dashboard/dairy/cows/${result.cowId}`)
  }

  async function handleStatus(newStatus: 'sold' | 'deceased') {
    setLoading(true)
    setError(null)
    const result = await updateCalfStatus(calf.id, newStatus)
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Could not update')
      return
    }
    router.refresh()
  }

  const canWean = status === 'nursing'
  const canPromote = status === 'weaned' && calf.sex !== 'male'
  const canClose = status === 'nursing' || status === 'weaned'

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <Link href="/dashboard/dairy/calves" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-white transition-colors">
          <ChevronLeft size={14} /> Calves
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight capitalize">
              {calf.sex || 'Calf'} of {calf.dam?.name || calf.dam?.cow_tag || 'Unknown dam'}
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Born {new Date(calf.birth_date).toLocaleDateString()}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium flex-shrink-0 ${meta.border} ${meta.bg} ${meta.color}`}>
            <Icon size={12} /> {meta.label}
          </div>
        </div>

        <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[#6B7280] text-xs">Dam</span>
              <p className="font-medium text-white mt-0.5">{calf.dam?.name || calf.dam?.cow_tag}</p>
            </div>
            <div>
              <span className="text-[#6B7280] text-xs">Sire</span>
              <p className="font-medium text-white mt-0.5">{calf.sire_code || '—'}</p>
            </div>
            <div>
              <span className="text-[#6B7280] text-xs">Birth weight</span>
              <p className="font-medium text-white mt-0.5">{calf.birth_weight ? `${calf.birth_weight}kg` : '—'}</p>
            </div>
            <div>
              <span className="text-[#6B7280] text-xs">Weaning</span>
              <p className="font-medium text-white mt-0.5">
                {calf.weaning_date
                  ? `${new Date(calf.weaning_date).toLocaleDateString()}${calf.weaning_weight ? ` · ${calf.weaning_weight}kg` : ''}`
                  : '—'}
              </p>
            </div>
          </div>
          {calf.notes && (
            <div className="mt-4 pt-4 border-t border-[#1F2128]">
              <span className="text-[#6B7280] text-xs">Notes</span>
              <p className="text-sm text-[#9CA3AF] mt-1">{calf.notes}</p>
            </div>
          )}
        </section>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-md px-3 py-2">{error}</p>
        )}

        {(canWean || canPromote || canClose) && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-4">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Actions</h2>

            {canWean && !showWeanForm && (
              <button
                onClick={() => setShowWeanForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-sky-800 hover:bg-sky-700 rounded-md transition-colors"
              >
                <Milk size={14} /> Record weaning
              </button>
            )}

            {canWean && showWeanForm && (
              <form onSubmit={handleWean} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-[#9CA3AF] mb-1.5">Weaning date</span>
                    <div className="relative">
                      <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                      <input
                        type="date"
                        value={weaningDate}
                        onChange={e => setWeaningDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className={`${inputCls()} pl-8`}
                        style={{ WebkitTextFillColor: 'white', color: 'white' }}
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-[#9CA3AF] mb-1.5">Weaning weight (kg)</span>
                    <div className="relative">
                      <Scale size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                      <input
                        type="number"
                        value={weaningWeight}
                        onChange={e => setWeaningWeight(e.target.value)}
                        min="0"
                        step="0.5"
                        className={`${inputCls()} pl-8`}
                        style={{ WebkitTextFillColor: 'white', color: 'white' }}
                      />
                    </div>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-md transition-colors"
                >
                  {loading ? 'Saving…' : 'Save weaning'}
                </button>
              </form>
            )}

            {canPromote && (
              <button
                onClick={handlePromote}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-md transition-colors"
              >
                <Sparkles size={14} /> Promote to herd (register as heifer)
              </button>
            )}

            {status === 'weaned' && calf.sex === 'male' && (
              <p className="text-xs text-[#6B7280]">
                Male calves aren&rsquo;t promoted into the milking herd here — mark as sold when it leaves the farm.
              </p>
            )}

            {canClose && (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => handleStatus('sold')}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-blue-300 border border-blue-900/40 bg-blue-950/20 hover:bg-blue-950/40 disabled:opacity-50 rounded-md transition-colors"
                >
                  <Banknote size={12} /> Mark as sold
                </button>
                <button
                  onClick={() => handleStatus('deceased')}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-[#9CA3AF] border border-[#2A2D35] bg-[#0D0F14] hover:bg-[#1A1D24] disabled:opacity-50 rounded-md transition-colors"
                >
                  <CircleDashed size={12} /> Record loss
                </button>
              </div>
            )}
          </section>
        )}

        {status === 'promoted' && calf.cow_id && (
          <Link
            href={`/dashboard/dairy/cows/${calf.cow_id}`}
            className="block text-center py-2.5 text-sm font-medium text-emerald-500 hover:text-emerald-400 border border-[#2A2D35] rounded-md transition-colors"
          >
            View herd record →
          </Link>
        )}
      </div>
    </div>
  )
}

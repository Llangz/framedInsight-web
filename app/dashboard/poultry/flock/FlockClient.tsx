'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bird, ArrowLeft, PlusCircle, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Batch {
  id: string
  batch_name: string
  bird_type: 'layer' | 'broiler' | 'kienyeji' | 'dual_purpose'
  breed: string | null
  date_of_placement: string
  initial_count: number
  current_count: number
  status: 'active' | 'sold' | 'culled' | 'closed'
  source: string | null
  purchase_price_per_bird: number | null
  house_number: string | null
  housing_system: string | null
  expected_laying_date: string | null
  target_weight_kg: number | null
  notes: string | null
}

interface Props {
  initialBatches: Batch[]
  farmId: string
}

const TYPE_COLOR: Record<string, string> = {
  layer:        'text-amber-400 border-amber-900/40 bg-amber-950/30',
  broiler:      'text-sky-400 border-sky-900/40 bg-sky-950/30',
  kienyeji:     'text-emerald-400 border-emerald-900/40 bg-emerald-950/30',
  dual_purpose: 'text-purple-400 border-purple-900/40 bg-purple-950/30',
}

const TYPE_LABEL: Record<string, string> = {
  layer: 'Layer', broiler: 'Broiler', kienyeji: 'Kienyeji', dual_purpose: 'Dual',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20',
  sold:   'text-[#6B7280] border-[#2A2D35] bg-[#0A0C10]',
  culled: 'text-red-400 border-red-900/40 bg-red-950/20',
  closed: 'text-[#6B7280] border-[#2A2D35] bg-[#0A0C10]',
}

function ageDisplay(placementDate: string): string {
  const days  = Math.floor((Date.now() - new Date(placementDate).getTime()) / 86400000)
  const weeks = Math.floor(days / 7)
  if (weeks < 4)  return `${weeks}w old`
  const months = Math.floor(weeks / 4.33)
  const remW   = Math.round(weeks % 4.33)
  return remW > 0 ? `${months}mo ${remW}w old` : `${months}mo old`
}

function mortalityRate(initial: number, current: number): string {
  if (!initial) return '0'
  return (((initial - current) / initial) * 100).toFixed(1)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white focus:outline-none focus:border-[#4B5563] transition-colors'

export default function FlockClient({ initialBatches, farmId }: Props) {
  const supabase = createClient()
  const [batches, setBatches]         = useState(initialBatches)
  const [filter, setFilter]           = useState<'all' | 'active' | 'closed'>('active')
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [closingId, setClosingId]     = useState<string | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [closingLoading, setClosingLoading] = useState(false)
  const [msg, setMsg]                 = useState('')

  const visible = batches.filter(b => {
    if (filter === 'active') return b.status === 'active'
    if (filter === 'closed') return b.status !== 'active'
    return true
  })

  const selected = batches.find(b => b.id === selectedId)

  async function closeBatch() {
    if (!closingId || !closeReason) return
    setClosingLoading(true)
    const { error } = await supabase
      .from('poultry_batches' as any)
      .update({ status: closeReason } as any)
      .eq('id', closingId)
    setClosingLoading(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setBatches(prev => prev.map(b => b.id === closingId ? { ...b, status: closeReason as any } : b))
    setClosingId(null)
    setCloseReason('')
    setMsg('Batch closed successfully.')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/poultry" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">Flock Management</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">{batches.filter(b => b.status === 'active').length} active batch{batches.filter(b => b.status === 'active').length !== 1 ? 'es' : ''}</p>
        </div>
        <Link href="/dashboard/poultry/add-batch"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors">
          <PlusCircle size={12} /> New batch
        </Link>
      </div>

      {msg && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg border border-emerald-900/40 bg-emerald-950/30">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <p className="text-sm text-emerald-300">{msg}</p>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 mb-6">
        {([['active', 'Active'], ['all', 'All batches'], ['closed', 'Closed']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === k ? 'bg-white/10 text-white' : 'text-[#6B7280] hover:text-white'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* Close batch modal */}
      {closingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-[#2A2D35] rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Close batch</h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Select how this batch ended. This cannot be easily undone.
            </p>
            <div className="space-y-2 mb-4">
              {[
                { value: 'sold',   label: 'Sold (all birds sold)' },
                { value: 'culled', label: 'Culled (end of cycle / disease)' },
                { value: 'closed', label: 'Closed (other reason)' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer ${
                  closeReason === opt.value ? 'border-emerald-600/60 bg-emerald-950/20' : 'border-[#2A2D35] bg-[#0A0C10]'
                }`}>
                  <input type="radio" className="hidden" checked={closeReason === opt.value}
                    onChange={() => setCloseReason(opt.value)} />
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    closeReason === opt.value ? 'border-emerald-500 bg-emerald-500' : 'border-[#4B5563]'
                  }`} />
                  <span className="text-sm text-white">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setClosingId(null); setCloseReason('') }}
                className="flex-1 px-3 py-2 rounded-md border border-[#2A2D35] text-sm text-[#9CA3AF] hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={closeBatch} disabled={!closeReason || closingLoading}
                className="flex-1 px-3 py-2 rounded-md bg-red-700 hover:bg-red-600 disabled:opacity-40 text-sm text-white transition-colors">
                {closingLoading ? 'Closing…' : 'Close batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch list */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2A2D35] p-10 text-center">
          <Bird size={28} className="text-[#2A2D35] mx-auto mb-3" />
          <p className="text-sm text-[#6B7280] mb-3">
            {filter === 'active' ? 'No active batches' : 'No batches found'}
          </p>
          {filter === 'active' && (
            <Link href="/dashboard/poultry/add-batch" className="text-sm text-emerald-500 hover:text-emerald-400">
              + Register a batch
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(b => {
            const mort  = mortalityRate(b.initial_count, b.current_count)
            const isExp = selectedId === b.id
            return (
              <div key={b.id} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
                {/* Row */}
                <button
                  onClick={() => setSelectedId(isExp ? null : b.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-white/5 transition-colors">
                  <Bird size={15} className="text-[#4B5563] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{b.batch_name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${TYPE_COLOR[b.bird_type]}`}>
                        {TYPE_LABEL[b.bird_type]}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLOR[b.status]}`}>
                        {b.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {b.breed || 'Mixed'} · {b.house_number ? `House ${b.house_number}` : 'No house assigned'} · {ageDisplay(b.date_of_placement)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-white">{b.current_count.toLocaleString()}</p>
                    <p className="text-[11px] text-[#6B7280]">/ {b.initial_count.toLocaleString()} placed</p>
                  </div>
                  <ArrowRight size={12} className={`text-[#4B5563] transition-transform flex-shrink-0 ${isExp ? 'rotate-90' : ''}`} />
                </button>

                {/* Expanded details */}
                {isExp && (
                  <div className="border-t border-[#2A2D35] px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Placed',          value: fmtDate(b.date_of_placement) },
                        { label: 'Source',           value: b.source || '—' },
                        { label: 'Cost / bird',      value: b.purchase_price_per_bird ? `KES ${b.purchase_price_per_bird}` : '—' },
                        { label: 'Total invest.',    value: b.purchase_price_per_bird
                          ? `KES ${(b.initial_count * b.purchase_price_per_bird).toLocaleString()}` : '—' },
                        { label: 'Housing',          value: b.housing_system || '—' },
                        { label: 'Mortality',        value: `${mort}% (${b.initial_count - b.current_count} birds)` },
                        { label: b.bird_type === 'broiler' ? 'Target weight' : 'Laying start',
                          value: b.bird_type === 'broiler'
                            ? (b.target_weight_kg ? `${b.target_weight_kg} kg` : '—')
                            : (b.expected_laying_date ? fmtDate(b.expected_laying_date) : '—') },
                        { label: 'Birds remaining',  value: `${b.current_count.toLocaleString()} of ${b.initial_count.toLocaleString()}` },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] text-[#6B7280] mb-0.5">{label}</p>
                          <p className="text-xs font-medium text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    {parseFloat(mort) > 5 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-red-900/40 bg-red-950/20">
                        <AlertTriangle size={12} className="text-red-400" />
                        <p className="text-xs text-red-300">Mortality {mort}% – above 5% threshold. Investigate health and biosecurity.</p>
                      </div>
                    )}

                    {b.notes && (
                      <p className="text-xs text-[#6B7280] italic">{b.notes}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Link href={`/dashboard/poultry/eggs`}
                        className="px-3 py-1.5 rounded-md border border-[#2A2D35] text-xs text-[#9CA3AF] hover:text-white hover:border-[#4B5563] transition-colors">
                        Record eggs
                      </Link>
                      <Link href={`/dashboard/poultry/feed`}
                        className="px-3 py-1.5 rounded-md border border-[#2A2D35] text-xs text-[#9CA3AF] hover:text-white hover:border-[#4B5563] transition-colors">
                        Feed intake
                      </Link>
                      <Link href={`/dashboard/poultry/health`}
                        className="px-3 py-1.5 rounded-md border border-[#2A2D35] text-xs text-[#9CA3AF] hover:text-white hover:border-[#4B5563] transition-colors">
                        Health / Vax
                      </Link>
                      {b.status === 'active' && (
                        <button
                          onClick={() => setClosingId(b.id)}
                          className="ml-auto px-3 py-1.5 rounded-md border border-red-900/40 text-xs text-red-400 hover:bg-red-950/30 transition-colors">
                          Close batch
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
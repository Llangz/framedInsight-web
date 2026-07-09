// 📁 FILE PATH: app/dashboard/coffee/harvest/HarvestClient.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Package, PlusCircle, CheckCircle2, Clock, MapPin } from 'lucide-react'

interface HarvestRecord {
  id: string
  harvest_date: string
  harvest_year: number | null
  harvest_season: string | null
  plot_name: string
  cherry_kg: number
  produce_kg: number
  produce_type: string | null
  processing_method: string | null
  quality_grade: string | null
  price_per_kg: number | null
  total_value: number | null
  payment_status: string | null
  payment_date: string | null
  cooperative_name: string | null
  factory_code: string | null
  lot_number: string | null
  mbuni_accepted: boolean | null
  notes: string | null
}

interface Plot { id: string; plot_name: string }

interface Props {
  farmId: string
  initialHarvests: HarvestRecord[]
  plots: Plot[]
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAYMENT_STYLE: Record<string, string> = {
  paid:    'text-emerald-400 border-emerald-900/40 bg-emerald-950/30',
  pending: 'text-amber-400 border-amber-900/40 bg-amber-950/30',
}

export default function HarvestClient({ initialHarvests, plots }: Props) {
  const [yearFilter, setYearFilter] = useState<string>('all')

  const years = useMemo(() => {
    const set = new Set(initialHarvests.map(h => String(h.harvest_year ?? new Date(h.harvest_date).getFullYear())))
    return Array.from(set).sort((a, b) => Number(b) - Number(a))
  }, [initialHarvests])

  const filtered = useMemo(() => {
    if (yearFilter === 'all') return initialHarvests
    return initialHarvests.filter(h => String(h.harvest_year ?? new Date(h.harvest_date).getFullYear()) === yearFilter)
  }, [initialHarvests, yearFilter])

  const totals = filtered.reduce(
    (acc, h) => ({
      cherry: acc.cherry + Number(h.cherry_kg || 0),
      produce: acc.produce + Number(h.produce_kg || 0),
      value: acc.value + Number(h.total_value || 0),
      deliveries: acc.deliveries + 1,
    }),
    { cherry: 0, produce: 0, value: 0, deliveries: 0 }
  )

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Harvest</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Cherry deliveries, quality grades and cooperative payments
            </p>
          </div>
          <Link
            href="/dashboard/coffee/harvest/record"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 transition-colors flex-shrink-0"
          >
            <PlusCircle size={13} /> Record harvest
          </Link>
        </div>

        {/* Season totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Cherry delivered', value: `${totals.cherry.toLocaleString()} kg` },
            { label: 'Clean coffee',     value: `${totals.produce.toLocaleString()} kg` },
            { label: 'Value',            value: `KES ${totals.value.toLocaleString()}` },
            { label: 'Deliveries',       value: totals.deliveries.toLocaleString() },
          ].map(c => (
            <div key={c.label} className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4">
              <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">{c.label}</p>
              <p className="text-lg font-semibold text-white mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Year filter */}
        {years.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setYearFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                yearFilter === 'all' ? 'bg-white/10 text-white' : 'text-[#6B7280] hover:text-white'
              }`}
            >
              All seasons
            </button>
            {years.map(y => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  yearFilter === y ? 'bg-white/10 text-white' : 'text-[#6B7280] hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {/* Records */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-10 text-center">
            <Package size={22} className="text-[#4B5563] mx-auto mb-3" />
            <p className="text-sm text-white font-medium">No harvest records yet</p>
            <p className="text-xs text-[#6B7280] mt-1 mb-4">
              {plots.length === 0
                ? 'Add a coffee plot first, then record your first delivery.'
                : 'Record your first cherry delivery to start tracking yield and payments.'}
            </p>
            <Link
              href={plots.length === 0 ? '/dashboard/coffee/plots/add' : '/dashboard/coffee/harvest/record'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 transition-colors"
            >
              <PlusCircle size={13} />
              {plots.length === 0 ? 'Add plot' : 'Record harvest'}
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(h => (
              <div key={h.id} className="flex items-start gap-4 px-4 py-3 rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
                <Package size={14} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white flex items-center gap-1">
                      <MapPin size={11} className="text-[#4B5563]" /> {h.plot_name}
                    </p>
                    {h.quality_grade && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#2A2D35] text-[#9CA3AF]">
                        {h.quality_grade}
                      </span>
                    )}
                    {h.payment_status && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                        PAYMENT_STYLE[h.payment_status] || 'text-[#9CA3AF] border-[#2A2D35]'
                      }`}>
                        {h.payment_status === 'paid' ? <CheckCircle2 size={9} /> : <Clock size={9} />}
                        {h.payment_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {fmtDate(h.harvest_date)} · {Number(h.cherry_kg).toLocaleString()} kg cherry
                    {h.cooperative_name ? ` · ${h.cooperative_name}` : ''}
                    {h.lot_number ? ` · Lot ${h.lot_number}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-white">
                    {h.total_value ? `KES ${Number(h.total_value).toLocaleString()}` : '—'}
                  </p>
                  {h.price_per_kg && (
                    <p className="text-[11px] text-[#6B7280]">KES {h.price_per_kg}/kg</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

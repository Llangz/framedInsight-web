'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PlusCircle, Search, Baby, Milk, Sparkles, Banknote, CircleDashed } from 'lucide-react'

type StatusFilter = 'all' | 'nursing' | 'weaned' | 'promoted' | 'sold' | 'deceased'

const STATUS_META: Record<string, { label: string; Icon: any; color: string; border: string; bg: string }> = {
  nursing:  { label: 'Nursing',  Icon: Baby,         color: 'text-emerald-400', border: 'border-emerald-900/40', bg: 'bg-emerald-950/30' },
  weaned:   { label: 'Weaned',   Icon: Milk,          color: 'text-sky-400',     border: 'border-sky-900/40',     bg: 'bg-sky-950/30' },
  promoted: { label: 'Promoted', Icon: Sparkles,      color: 'text-amber-400',   border: 'border-amber-900/40',   bg: 'bg-amber-950/30' },
  sold:     { label: 'Sold',     Icon: Banknote,      color: 'text-blue-400',    border: 'border-blue-900/40',    bg: 'bg-blue-950/30' },
  deceased: { label: 'Deceased', Icon: CircleDashed,  color: 'text-[#6B7280]',   border: 'border-[#2A2D35]',      bg: 'bg-[#0D0F14]' },
}

function ageLabel(birthDate: string) {
  if (!birthDate) return 'Unknown age'
  const birth = new Date(birthDate)
  const now = new Date()
  const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'Not born yet'
  if (days < 60) return `${days}d old`
  const months = Math.floor(days / 30)
  return `${months}mo old`
}

export default function CalvesClient({ initialCalves }: { initialCalves: any[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    let list = [...initialCalves]
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(c =>
        c.dam_name?.toLowerCase().includes(q) ||
        c.sire_code?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') list = list.filter(c => (c.status || 'nursing') === statusFilter)
    return list
  }, [initialCalves, query, statusFilter])

  const activeCount = initialCalves.filter(c => {
    const s = c.status || 'nursing'
    return s !== 'promoted' && s !== 'sold' && s !== 'deceased'
  }).length

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Calves</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {activeCount} in development · {initialCalves.length} total
            </p>
          </div>
          <Link
            href="/dashboard/dairy/calves/add"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors"
          >
            <PlusCircle size={14} /> Record birth
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by dam or sire code…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#0D0F14] text-white placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-emerald-700"
              style={{ WebkitTextFillColor: 'white', color: 'white' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#0D0F14] text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-emerald-700"
            style={{ WebkitTextFillColor: '#9CA3AF', color: '#9CA3AF' }}
          >
            {['all', 'nursing', 'weaned', 'promoted', 'sold', 'deceased'].map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All statuses' : STATUS_META[s].label}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#2A2D35] p-12 text-center">
            <p className="text-sm text-[#6B7280] mb-4">
              {query || statusFilter !== 'all' ? 'No calves match your filters' : 'No calves recorded yet'}
            </p>
            {!query && statusFilter === 'all' && (
              <Link href="/dashboard/dairy/calves/add" className="inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400">
                <PlusCircle size={14} /> Record your first calving
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(calf => {
              const meta = STATUS_META[calf.status || 'nursing'] || STATUS_META.nursing
              const { Icon } = meta
              return (
                <Link
                  key={calf.id}
                  href={`/dashboard/dairy/calves/${calf.id}`}
                  className="block rounded-lg border border-[#2A2D35] bg-[#0D0F14] hover:border-[#3A3D45] transition-colors p-4"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate capitalize">
                        {calf.sex || 'Calf'} of {calf.dam_name}
                      </h3>
                      <p className="text-xs text-[#6B7280]">{ageLabel(calf.birth_date)}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium flex-shrink-0 ${meta.border} ${meta.bg} ${meta.color}`}>
                      <Icon size={11} /> {meta.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#6B7280]">Birth weight:</span>
                      <p className="font-medium text-white mt-0.5">{calf.birth_weight ? `${calf.birth_weight}kg` : '—'}</p>
                    </div>
                    <div>
                      <span className="text-[#6B7280]">Sire:</span>
                      <p className="font-medium text-white mt-0.5">{calf.sire_code || '—'}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#1F2128] flex items-center justify-between text-[11px] text-[#4B5563]">
                    <span>Born {new Date(calf.birth_date).toLocaleDateString()}</span>
                    <span className="text-emerald-500 font-medium">View details →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

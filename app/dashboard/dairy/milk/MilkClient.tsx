// 📁 FILE PATH: app/dashboard/dairy/milk/MilkClient.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import Link from 'next/link'
import { PlusCircle, Droplets, ChevronLeft, ChevronRight } from 'lucide-react'
import type { MilkRecord, Cow } from '@/lib/database.types'

interface MilkClientProps {
  records: MilkRecord[]
  cows: Cow[]
  pagination: {
    currentPage: number
    totalPages: number
    totalRecords: number
    hasPrev: boolean
    hasNext: boolean
  }
  filters: {
    cowId?: string
    startDate?: string
    endDate?: string
  }
}

const FIELD = 'px-3 py-2 w-full rounded-md bg-[#0A0C10] border border-[#2A2D35] text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#4B5563] transition-colors'
const LABEL = 'block text-xs font-medium text-[#9CA3AF] mb-1'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MilkClient({ records, cows, pagination, filters }: MilkClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', newPage.toString())
      router.push(`/dashboard/dairy/milk?${params.toString()}`, { scroll: false })
    })
  }

  const handleFilterChange = (key: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams()
      params.set('page', '1')
      if (value) params.set(key, value)
      if (filters.cowId && key !== 'cowId') params.set('cowId', filters.cowId)
      if (filters.startDate && key !== 'startDate') params.set('startDate', filters.startDate)
      if (filters.endDate && key !== 'endDate') params.set('endDate', filters.endDate)
      router.push(`/dashboard/dairy/milk?${params.toString()}`)
    })
  }

  const handleClearFilters = () => {
    startTransition(() => router.push('/dashboard/dairy/milk'))
  }

  const getCowDisplay = (cowId: string) => {
    const cow = cows.find(c => c.id === cowId)
    if (!cow) return cowId
    return `${cow.cow_tag}${cow.name ? ` (${cow.name})` : ''}`
  }

  const hasFilters = !!(filters.cowId || filters.startDate || filters.endDate)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Milk records</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">{pagination.totalRecords} total records</p>
        </div>
        <Link
          href="/dashboard/dairy/milk/record"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors"
        >
          <PlusCircle size={12} /> Record milk
        </Link>
      </div>

      {/* Filters */}
      <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2D35]">
          <div className="flex items-center gap-2">
            <Droplets size={13} className="text-[#6B7280]" />
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Filter records</h2>
          </div>
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-[#6B7280] hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={LABEL}>Cow</label>
            <select
              value={filters.cowId || ''}
              onChange={e => handleFilterChange('cowId', e.target.value)}
              className={FIELD}
            >
              <option value="">All cows</option>
              {cows.map(cow => (
                <option key={cow.id} value={cow.id}>
                  {cow.cow_tag}{cow.name ? ` (${cow.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>From date</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={e => handleFilterChange('startDate', e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>To date</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={e => handleFilterChange('endDate', e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
      </section>

      {/* Records */}
      <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-6 gap-2 px-4 py-2.5 border-b border-[#2A2D35] bg-[#0A0C10]">
          {['Date', 'Cow', 'Morning (L)', 'Midday (L)', 'Evening (L)', 'Total (L)'].map(h => (
            <p key={h} className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest">{h}</p>
          ))}
        </div>

        {records.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#6B7280]">
              {hasFilters ? 'No records match your filters' : 'No milk records yet'}
            </p>
            {!hasFilters && (
              <Link
                href="/dashboard/dairy/milk/record"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-emerald-500 hover:text-emerald-400"
              >
                <PlusCircle size={13} /> Record first entry
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#1F2128]">
            {records.map(record => (
              <div key={record.id} className="grid grid-cols-6 gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <p className="text-sm text-white">{fmt(record.record_date)}</p>
                <p className="text-sm font-medium text-white truncate">{getCowDisplay(record.cow_id)}</p>
                <p className="text-sm text-[#9CA3AF]">{record.morning_milk?.toFixed(2) ?? '—'}</p>
                <p className="text-sm text-[#9CA3AF]">{record.midday_milk?.toFixed(2) ?? '—'}</p>
                <p className="text-sm text-[#9CA3AF]">{record.evening_milk?.toFixed(2) ?? '—'}</p>
                <p className="text-sm font-semibold text-white">{record.total_milk?.toFixed(2) ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">
            Showing {records.length} of {pagination.totalRecords} records
            {pagination.totalPages > 1 && ` · Page ${pagination.currentPage} of ${pagination.totalPages}`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrev || isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#2A2D35] text-xs text-[#9CA3AF] hover:text-white hover:border-[#3A3D45] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} /> Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNext || isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#2A2D35] text-xs text-[#9CA3AF] hover:text-white hover:border-[#3A3D45] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
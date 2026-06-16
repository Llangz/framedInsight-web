'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
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
      params.set('page', '1') // Reset to first page on filter change
      
      if (value) params.set(key, value)
      if (filters.cowId && key !== 'cowId') params.set('cowId', filters.cowId)
      if (filters.startDate && key !== 'startDate') params.set('startDate', filters.startDate)
      if (filters.endDate && key !== 'endDate') params.set('endDate', filters.endDate)
      
      router.push(`/dashboard/dairy/milk?${params.toString()}`)
    })
  }

  const handleClearFilters = () => {
    startTransition(() => {
      router.push('/dashboard/dairy/milk')
    })
  }

  const getCowDisplay = (cowId: string) => {
    const cow = cows.find(c => c.id === cowId)
    if (!cow) return cowId
    return `${cow.cow_tag}${cow.name ? ` (${cow.name})` : ''}`
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Clear all
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filters.cowId || ''}
            onChange={(e) => handleFilterChange('cowId', e.target.value)}
            className="border border-gray-300 rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Cows</option>
            {cows.map(cow => (
              <option key={cow.id} value={cow.id}>
                {cow.cow_tag} {cow.name ? `(${cow.name})` : ''}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="border border-gray-300 rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="border border-gray-300 rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cow</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Morning (L)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Midday (L)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evening (L)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (L)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No milk records found
                    {(filters.cowId || filters.startDate || filters.endDate) && (
                      <span className="block mt-1 text-sm">Try adjusting your filters</span>
                    )}
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.record_date).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {getCowDisplay(record.cow_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {record.morning_milk?.toFixed(2) ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {record.midday_milk?.toFixed(2) ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {record.evening_milk?.toFixed(2) ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {record.total_milk?.toFixed(2) ?? '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{records.length}</span> of{' '}
          <span className="font-medium">{pagination.totalRecords}</span> records
          {pagination.totalPages > 0 && (
            <span className="ml-2">
              (Page <span className="font-medium">{pagination.currentPage}</span> of{' '}
              <span className="font-medium">{pagination.totalPages}</span>)
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrev || isPending}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>
          
          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNext || isPending}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
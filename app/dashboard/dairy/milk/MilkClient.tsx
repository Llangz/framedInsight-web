'use client'

import { useState } from 'react'
import Link from 'next/link'
import DailyMilkSummary from '../components/DailyMilkSummary'
import MilkChart from '../components/MilkChart'

interface MilkClientProps {
  initialRecords: any[]
  initialCows: any[]
}

export default function MilkClient({ initialRecords, initialCows }: MilkClientProps) {
  const [records] = useState<any[]>(initialRecords)
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('week')
  const [selectedCow, setSelectedCow] = useState<string>('all')
  const [cows] = useState<any[]>(initialCows)

  // Client-side filtering logic
  const filteredRecords = records.filter(record => {
    // Cow filter
    if (selectedCow !== 'all' && record.cow_id !== selectedCow) return false

    // Date filter
    const today = new Date()
    today.setHours(0,0,0,0)
    const recordDate = new Date(record.record_date)
    recordDate.setHours(0,0,0,0)

    if (filter === 'today') {
      return recordDate.getTime() === today.getTime()
    } else if (filter === 'week') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return recordDate >= weekAgo
    } else if (filter === 'month') {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return recordDate >= monthAgo
    }
    return true
  })

  function calculateTotal(record: any): number {
    return (record.morning_milk || 0) + (record.evening_milk || 0)
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Milk Records</h1>
            <p className="text-gray-600 text-sm mt-1">Track your daily milk production</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/dairy"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <Link
              href="/dashboard/dairy/milk/record"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <span>+</span>
              <span>Record Milk</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="mb-6">
        <DailyMilkSummary records={filteredRecords} />
      </div>

      {/* Chart */}
      <div className="mb-6">
        <MilkChart records={filteredRecords} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Time Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
            <div className="flex gap-2">
              {(['today', 'week', 'month', 'all'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setFilter(period)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter === period
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period === 'today' && 'Today'}
                  {period === 'week' && 'Last 7 Days'}
                  {period === 'month' && 'Last 30 Days'}
                  {period === 'all' && 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {/* Cow Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Cow</label>
            <select
              value={selectedCow}
              onChange={(e) => setSelectedCow(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Cows</option>
              {cows.map(cow => (
                <option key={cow.id} value={cow.id}>
                  {cow.name || cow.cow_tag}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Records Table */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-4">🥛</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No milk records yet</h3>
          <p className="text-gray-600 mb-4">Start recording your daily milk production</p>
          <Link
            href="/dashboard/dairy/milk/record"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Record First Milk Production
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cow</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">🌅 Morning</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">🌆 Evening</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(record.record_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {record.cows?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">{record.cows?.cow_tag}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                      {record.morning_milk?.toFixed(1) || '0.0'}L
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                      {record.evening_milk?.toFixed(1) || '0.0'}L
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-gray-900">
                        {calculateTotal(record).toFixed(1)}L
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

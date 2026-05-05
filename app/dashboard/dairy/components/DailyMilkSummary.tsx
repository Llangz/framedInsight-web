'use client'

interface DailyMilkSummaryProps {
  records: any[]
}

export default function DailyMilkSummary({ records }: DailyMilkSummaryProps) {
  const today = new Date().toISOString().split('T')[0]
  
  const todayRecords = records.filter(r => r.record_date === today)
  
  const morningTotal = todayRecords.reduce((sum, r) => sum + (r.morning_milk || 0), 0)
  const eveningTotal = todayRecords.reduce((sum, r) => sum + (r.evening_milk || 0), 0)
  const grandTotal = morningTotal + eveningTotal

  const cowsMilkedToday = new Set(todayRecords.map(r => r.cow_id)).size

  // Calculate yesterday's total for comparison
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDate = yesterday.toISOString().split('T')[0]
  
  const yesterdayRecords = records.filter(r => r.record_date === yesterdayDate)
  const yesterdayTotal = yesterdayRecords.reduce((sum, r) => 
    sum + (r.morning_milk || 0) + (r.evening_milk || 0), 0
  )

  const percentChange = yesterdayTotal > 0 
    ? ((grandTotal - yesterdayTotal) / yesterdayTotal) * 100 
    : 0

  const stats = [
    {
      label: 'Morning',
      value: `${morningTotal.toFixed(1)}L`,
      icon: '🌅',
      color: 'bg-orange-50 border-orange-200 text-orange-700'
    },
    {
      label: 'Evening',
      value: `${eveningTotal.toFixed(1)}L`,
      icon: '🌆',
      color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      label: 'Total Today',
      value: `${grandTotal.toFixed(1)}L`,
      icon: '📊',
      color: 'bg-green-50 border-green-200 text-green-700'
    },
    {
      label: 'Cows Milked',
      value: cowsMilkedToday,
      icon: '🐄',
      color: 'bg-purple-50 border-purple-200 text-purple-700'
    },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Today's Production</h2>
        {percentChange !== 0 && (
          <div className={`flex items-center gap-1 text-sm ${
            percentChange > 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            <span>{percentChange > 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(percentChange).toFixed(1)}%</span>
            <span className="text-gray-500 text-xs">vs yesterday</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border-2 ${stat.color}`}
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs font-medium opacity-80 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {todayRecords.length === 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">No milk recorded yet today</p>
        </div>
      )}
    </div>
  )
}

'use client'

interface MilkChartProps {
  records: any[]
}

export default function MilkChart({ records }: MilkChartProps) {
  // Get last 7 days
  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    last7Days.push(date.toISOString().split('T')[0])
  }

  // Aggregate data by date
  const dailyTotals = last7Days.map(date => {
    const dayRecords = records.filter(r => r.record_date === date)
    const total = dayRecords.reduce((sum, r) => 
      sum + (r.morning_milk || 0) + (r.evening_milk || 0), 0
    )
    return {
      date,
      total,
      morning: dayRecords.reduce((sum, r) => sum + (r.morning_milk || 0), 0),
      evening: dayRecords.reduce((sum, r) => sum + (r.evening_milk || 0), 0),
    }
  })

  const maxValue = Math.max(...dailyTotals.map(d => d.total), 50)
  const average = dailyTotals.reduce((sum, d) => sum + d.total, 0) / dailyTotals.length

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">7-Day Production Trend</h2>
        <div className="text-sm text-gray-600">
          Avg: <span className="font-semibold text-gray-900">{average.toFixed(1)}L/day</span>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-4 mb-6">
        {dailyTotals.map((day, index) => {
          const percentage = maxValue > 0 ? (day.total / maxValue) * 100 : 0
          const isToday = day.date === new Date().toISOString().split('T')[0]

          return (
            <div key={day.date} className="relative">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-16 text-xs text-gray-600 text-right">
                  {formatDate(day.date)}
                </div>
                <div className="flex-1">
                  <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                    {/* Stacked bars */}
                    <div className="absolute inset-y-0 left-0 flex">
                      {day.morning > 0 && (
                        <div
                          className="bg-orange-400 flex items-center justify-center text-xs text-white font-medium"
                          style={{ width: `${(day.morning / maxValue) * 100}%` }}
                          title={`Morning: ${day.morning.toFixed(1)}L`}
                        >
                          {day.morning > 2 && `${day.morning.toFixed(1)}`}
                        </div>
                      )}
                      {day.evening > 0 && (
                        <div
                          className="bg-blue-400 flex items-center justify-center text-xs text-white font-medium"
                          style={{ width: `${(day.evening / maxValue) * 100}%` }}
                          title={`Evening: ${day.evening.toFixed(1)}L`}
                        >
                          {day.evening > 2 && `${day.evening.toFixed(1)}`}
                        </div>
                      )}
                    </div>
                    {isToday && (
                      <div className="absolute inset-0 border-2 border-primary-600 rounded-lg pointer-events-none"></div>
                    )}
                  </div>
                </div>
                <div className="w-16 text-sm font-semibold text-gray-900">
                  {day.total.toFixed(1)}L
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-400 rounded"></div>
          <span className="text-xs text-gray-600">Morning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-400 rounded"></div>
          <span className="text-xs text-gray-600">Evening</span>
        </div>
      </div>

      {dailyTotals.every(d => d.total === 0) && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No milk records in the last 7 days
        </div>
      )}
    </div>
  )
}

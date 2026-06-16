'use client'

import type { Cow, MilkRecord, VetVisit, BreedingEvent, HealthRecord } from '@/lib/database.types'

interface DairyDashboardProps {
  cows: Cow[]
  milkRecords: MilkRecord[]
  vetVisits: VetVisit[]
  breedingEvents: BreedingEvent[]
  healthRecords: HealthRecord[]
  stats: {
    totalCows: number
    milkingCows: number
    totalMilkToday: number
    avgMilkLast7Days: number
    pendingBreedings: number
    recentHealthIssues: number
    upcomingVetVisits: number
  }
}

export default function DairyDashboard({ 
  cows, 
  milkRecords, 
  vetVisits, 
  breedingEvents, 
  healthRecords,
  stats 
}: DairyDashboardProps) {
  const getCowDisplay = (cowId: string) => {
    const cow = cows.find(c => c.id === cowId)
    if (!cow) return cowId
    return `${cow.cow_tag}${cow.name ? ` (${cow.name})` : ''}`
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Cows</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.totalCows}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Milking</h3>
          <p className="text-3xl font-bold text-green-600">{stats.milkingCows}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Today's Milk (L)</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalMilkToday.toFixed(2)}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Avg Daily (L)</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.avgMilkLast7Days.toFixed(2)}</p>
        </div>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Milk Records */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Milk Records</h3>
          <div className="space-y-3">
            {milkRecords.slice(0, 5).map(record => (
              <div key={record.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm text-gray-600">
                  {new Date(record.record_date).toLocaleDateString('en-KE', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
                <span className="font-medium text-gray-900">{record.total_milk?.toFixed(2) || '0.00'} L</span>
              </div>
            ))}
            {milkRecords.length === 0 && (
              <p className="text-gray-500 text-sm">No recent milk records</p>
            )}
          </div>
        </div>

        {/* Pending Breeding Events */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Pending Breeding Events</h3>
          <div className="space-y-3">
            {breedingEvents.slice(0, 5).map(event => (
              <div key={event.id} className="py-2 border-b last:border-0">
                <p className="font-medium text-gray-900">{getCowDisplay(event.cow_id)}</p>
                <p className="text-sm text-gray-600">
                  Service: {new Date(event.service_date).toLocaleDateString('en-KE')}
                  {event.expected_calving_date && (
                    <span> • Due: {new Date(event.expected_calving_date).toLocaleDateString('en-KE')}</span>
                  )}
                </p>
                {event.pregnancy_result && (
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                    {event.pregnancy_result}
                  </span>
                )}
              </div>
            ))}
            {breedingEvents.length === 0 && (
              <p className="text-gray-500 text-sm">No pending breeding events</p>
            )}
          </div>
        </div>
      </div>

      {/* Health & Vet Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Health Issues */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Health Issues</h3>
          <div className="space-y-3">
            {healthRecords.slice(0, 5).map(record => (
              <div key={record.id} className="py-2 border-b last:border-0">
                <p className="font-medium text-gray-900">{getCowDisplay(record.cow_id)}</p>
                <p className="text-sm text-gray-600">{record.disease || 'Health check'}</p>
                <p className="text-xs text-gray-500">
                  {new Date(record.treatment_date).toLocaleDateString('en-KE')}
                  {record.cost && ` • KES ${record.cost}`}
                </p>
              </div>
            ))}
            {healthRecords.length === 0 && (
              <p className="text-gray-500 text-sm">No recent health issues</p>
            )}
          </div>
        </div>

        {/* Upcoming Vet Visits */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Upcoming Vet Visits</h3>
          <div className="space-y-3">
            {vetVisits.filter(v => v.next_visit_date).slice(0, 5).map(visit => (
              <div key={visit.id} className="py-2 border-b last:border-0">
                {visit.cow_id && (
                  <p className="font-medium text-gray-900">{getCowDisplay(visit.cow_id)}</p>
                )}
                <p className="text-sm text-gray-600">{visit.visit_reason || 'Routine check'}</p>
                {visit.vet_name && <p className="text-sm text-gray-600">Dr. {visit.vet_name}</p>}
                {visit.next_visit_date && (
                  <p className="text-xs text-blue-600 font-medium">
                    Next: {new Date(visit.next_visit_date).toLocaleDateString('en-KE')}
                  </p>
                )}
              </div>
            ))}
            {vetVisits.filter(v => v.next_visit_date).length === 0 && (
              <p className="text-gray-500 text-sm">No upcoming vet visits</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DairyDashboard from './DairyDashboard'
import { validateFarmAccess } from '@/lib/validate-farm-access'
import type { Cow } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function DairyDashboardPage() {
  const access = await validateFarmAccess()
  
  if (!access.success) {
    redirect('/auth/login')
  }

  const supabase = await createClient()
  
  // Fetch cows first to get cowIds
  const { data: cows, error: cowsError } = await supabase
    .from('cows')
    .select('*')  // ✅ Select ALL fields
    .eq('farm_id', access.farmId!)
    .eq('status', 'active')

  if (cowsError || !cows) {
    console.error('Failed to fetch cows:', cowsError)
    return <div className="p-4 text-red-600">Failed to load dairy data</div>
  }

  const cowIds = cows.map(c => c.id)
  
  // If no cows, return empty dashboard
  if (cowIds.length === 0) {
    return (
      <DairyDashboard
        cows={[]}
        milkRecords={[]}
        breedingEvents={[]}
        vetVisits={[]}
        healthRecords={[]}
        stats={{
          totalCows: 0,
          milkingCows: 0,
          totalMilkToday: 0,
          avgMilkLast7Days: 0,
          pendingBreedings: 0,
          recentHealthIssues: 0,
          upcomingVetVisits: 0,
        }}
      />
    )
  }

  // ⚡ PARALLEL FETCH: Execute all heavy queries concurrently
  const [milkRecordsResult, breedingEventsResult, vetVisitsResult, healthRecordsResult] = await Promise.all([
    // Milk records (last 30 days)
    supabase
      .from('milk_records')
      .select('*')  // ✅ Select ALL fields
      .in('cow_id', cowIds)
      .gte('record_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('record_date', { ascending: false }),
    
    // Breeding events
    supabase
      .from('breeding_events')
      .select('*')  // ✅ Select ALL fields
      .in('cow_id', cowIds)
      .or('pregnancy_result.is.null,pregnancy_result.eq.pending')
      .order('service_date', { ascending: false }),
    
    // Vet visits (last 90 days)
    supabase
      .from('vet_visits')
      .select('*')  // ✅ Select ALL fields
      .eq('farm_id', access.farmId!)
      .in('cow_id', cowIds)
      .gte('visit_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('visit_date', { ascending: false }),
    
    // Health records (last 90 days)
    supabase
      .from('health_records')
      .select('*')  // ✅ Select ALL fields
      .in('cow_id', cowIds)
      .gte('treatment_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('treatment_date', { ascending: false }),
  ])

  // ✅ Don't force types - let TypeScript infer from the query results
  const milkRecords = milkRecordsResult.data ?? []
  const breedingEvents = breedingEventsResult.data ?? []
  const vetVisits = vetVisitsResult.data ?? []
  const healthRecords = healthRecordsResult.data ?? []

  // Log any errors for debugging
  if (milkRecordsResult.error) console.error('Milk records error:', milkRecordsResult.error)
  if (breedingEventsResult.error) console.error('Breeding events error:', breedingEventsResult.error)
  if (vetVisitsResult.error) console.error('Vet visits error:', vetVisitsResult.error)
  if (healthRecordsResult.error) console.error('Health records error:', healthRecordsResult.error)

  // Calculate stats
  const today = new Date().toISOString().split('T')[0]
  const stats = {
    totalCows: cows.length,
    milkingCows: cows.filter(c => c.purpose === 'dairy').length,
    totalMilkToday: milkRecords
      .filter(r => r.record_date === today)
      .reduce((sum, r) => sum + (r.total_milk || 0), 0),
    avgMilkLast7Days: calculateAvgMilk(milkRecords, 7),
    pendingBreedings: breedingEvents.length,
    recentHealthIssues: healthRecords.length,
    upcomingVetVisits: vetVisits.filter(v => v.next_visit_date).length,
  }

  return (
    <DairyDashboard
      cows={cows}
      milkRecords={milkRecords}
      breedingEvents={breedingEvents}
      vetVisits={vetVisits}
      healthRecords={healthRecords}
      stats={stats}
    />
  )
}

function calculateAvgMilk(
  records: Array<{ record_date: string; total_milk: number | null }>, 
  days: number
): number {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const recentRecords = records.filter(r => r.record_date >= cutoff)
  
  if (recentRecords.length === 0) return 0
  
  const total = recentRecords.reduce((sum, r) => sum + (r.total_milk || 0), 0)
  const uniqueDays = new Set(recentRecords.map(r => r.record_date)).size
  
  return uniqueDays > 0 ? parseFloat((total / uniqueDays).toFixed(2)) : 0
}
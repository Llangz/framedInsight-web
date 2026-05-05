import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DairyClient from './DairyClient'

export default async function DairyPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!farmManager) {
    redirect('/onboarding')
  }

  const farmId = farmManager.farm_id

  // 1. Get all cows for this farm
  const { data: cows } = await supabase
    .from('cows')
    .select('id, status, cow_tag')
    .eq('farm_id', farmId)

  const cowIds = cows?.map(c => c.id) || []
  const todayDate = new Date().toISOString().split('T')[0]
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  // 2. Milk Records
  let milkRecords: any[] = []
  if (cowIds.length > 0) {
    const { data } = await supabase
      .from('milk_records')
      .select('total_milk, record_date')
      .in('cow_id', cowIds)
      .gte('record_date', weekAgoStr)
    milkRecords = data || []
  }

  const todayMilk = milkRecords
    .filter(r => r.record_date === todayDate)
    .reduce((sum, r) => sum + (r.total_milk || 0), 0)

  const weekTotalMilk = milkRecords.reduce((sum, r) => sum + (r.total_milk || 0), 0)
  const uniqueDays = new Set(milkRecords.map(r => r.record_date)).size || 1
  const avgDailyMilk = weekTotalMilk / uniqueDays

  // 3. Upcoming Events (Breeding)
  let upcomingEvents: any[] = []
  if (cowIds.length > 0) {
    const { data } = await supabase
      .from('breeding_events')
      .select('id, expected_calving_date, cow_id')
      .in('cow_id', cowIds)
      .gte('expected_calving_date', todayDate)
      .order('expected_calving_date', { ascending: true })
      .limit(3)
    upcomingEvents = data || []
  }

  // 4. Health Alerts (Vet Visits)
  const { data: recentHealth } = await supabase
    .from('vet_visits')
    .select('id, visit_reason, cow_id')
    .eq('farm_id', farmId)
    .gte('visit_date', weekAgoStr)
    .order('visit_date', { ascending: false })
    .limit(3)

  const cowMap = Object.fromEntries(cows?.map(c => [c.id, c.cow_tag]) || [])

  const stats = {
    total_cows: cows?.length || 0,
    producing_cows: cows?.filter(c => c.status === 'active').length || 0,
    dry_cows: cows?.filter(c => c.status === 'dry').length || 0,
    today_milk: todayMilk,
    avg_daily_milk: parseFloat(avgDailyMilk.toFixed(1)),
    calves: cows?.filter(c => c.status === 'heifer').length || 0,
  }

  const alerts = recentHealth?.map(alert => ({
    id: alert.id,
    message: `${(alert.cow_id ? cowMap[alert.cow_id] : null) || 'Cow'} - ${alert.visit_reason || 'Vet Visit'}`,
    subMessage: 'Recent health issue',
    type: 'health'
  })) || []

  const upcoming = upcomingEvents.map(event => {
    const daysTo = Math.ceil(
      (new Date(event.expected_calving_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
    )
    return {
      id: event.id,
      message: `${cowMap[event.cow_id] || 'Cow'} - Expected Calving`,
      subMessage: `In ${daysTo} days`,
      type: 'calving'
    }
  })

  return (
    <div className="min-h-screen">
      <DairyClient stats={stats} alerts={alerts} upcoming={upcoming} />
    </div>
  )
}


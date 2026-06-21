import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoultryClient from './PoultryClient'

export default async function PoultryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) redirect('/onboarding')

  const farmId = farmManager.farm_id
  const todayDate = new Date().toISOString().split('T')[0]
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  // Fetch all active batches
  const { data: batchesRaw } = await supabase
    .from('poultry_batches' as any)
    .select('id, batch_name, bird_type, breed, current_count, date_of_placement, status, house_number')
    .eq('farm_id', farmId)
    .eq('status', 'active')
    .order('date_of_placement', { ascending: false })

  const batches = (batchesRaw as any[] || []).map((b: any) => {
    const batch: any = b
    return {
      ...batch,
      age_weeks: Math.floor(
        (new Date().getTime() - new Date(batch.date_of_placement).getTime()) / (1000 * 60 * 60 * 24 * 7)
      ),
    }
  })

  const batchIds = batches.map(b => b.id)

  // Egg production
  let eggRecords: any[] = []
  if (batchIds.length > 0) {
    const { data } = await supabase
      .from('poultry_egg_records' as any)
      .select('batch_id, record_date, total_eggs, broken_eggs, collected_eggs')
      .in('batch_id', batchIds)
      .gte('record_date', weekAgoStr)
    eggRecords = data as any[] || []
  }

  const todayEggs = eggRecords
    .filter(r => r.record_date === todayDate)
    .reduce((s, r) => s + (r.total_eggs || 0), 0)

  const weekTotalEggs = eggRecords.reduce((s, r) => s + (r.total_eggs || 0), 0)
  const uniqueEggDays = new Set(eggRecords.map(r => r.record_date)).size || 1
  const avgDailyEggs = Math.round(weekTotalEggs / uniqueEggDays)

  // Hen-day production: layers only
  const layerCount = batches
    .filter(b => b.bird_type === 'layer' || b.bird_type === 'dual_purpose')
    .reduce((s, b) => s + b.current_count, 0)
  const henDayProduction = layerCount > 0
    ? Math.round((avgDailyEggs / layerCount) * 100)
    : 0

  // Mortality this week
  let mortalityCount = 0
  if (batchIds.length > 0) {
    const { data } = await supabase
      .from('poultry_mortality' as any)
      .select('count_dead')
      .in('batch_id', batchIds)
      .gte('record_date', weekAgoStr)
    mortalityCount = (data as any[] || []).reduce((s: number, r: any) => s + (r.count_dead || 0), 0)

  }

  // Feed stock - get latest feed stock record
  let feedStockDays = 0
  const { data: feedStock } = await supabase
    .from('poultry_feed_records' as any)
    .select('days_remaining')
    .eq('farm_id', farmId)
    .not('days_remaining', 'is', null)
    .order('record_date', { ascending: false })
    .limit(1)
  if (feedStock && feedStock.length > 0) {
    feedStockDays = (feedStock[0] as any).days_remaining || 0
  }

  // Health events upcoming
  const { data: upcomingVax } = await supabase
    .from('poultry_health_records' as any)
    .select('id, event_type, batch_id, next_due_date')
    .eq('farm_id', farmId)
    .not('next_due_date', 'is', null)
    .gte('next_due_date', todayDate)
    .order('next_due_date', { ascending: true })
    .limit(4)

  const batchMap = Object.fromEntries(batches.map(b => [b.id, b.batch_name]))

  const stats = {
    total_birds: batches.reduce((s, b) => s + b.current_count, 0),
    layers: batches.filter(b => b.bird_type === 'layer').reduce((s, b) => s + b.current_count, 0),
    broilers: batches.filter(b => b.bird_type === 'broiler').reduce((s, b) => s + b.current_count, 0),
    kienyeji: batches.filter(b => b.bird_type === 'kienyeji').reduce((s, b) => s + b.current_count, 0),
    today_eggs: todayEggs,
    avg_daily_eggs: avgDailyEggs,
    hen_day_production: henDayProduction,
    active_batches: batches.length,
    mortality_this_week: mortalityCount,
    feed_stock_days: feedStockDays,
  }

  // Build alerts
  const alerts: { id: string; message: string; subMessage: string; type: string }[] = []
  if (feedStockDays > 0 && feedStockDays <= 7) {
    alerts.push({
      id: 'feed-low',
      message: 'Feed stock running low',
      subMessage: `Only ${feedStockDays} day${feedStockDays !== 1 ? 's' : ''} remaining`,
      type: 'feed',
    })
  }
  if (mortalityCount > 0) {
    alerts.push({
      id: 'mortality',
      message: `${mortalityCount} bird${mortalityCount !== 1 ? 's' : ''} lost this week`,
      subMessage: 'Review mortality log and check flock health',
      type: 'mortality',
    })
  }
  if (henDayProduction > 0 && henDayProduction < 60) {
    alerts.push({
      id: 'low-production',
      message: 'Low egg production',
      subMessage: `${henDayProduction}% hen-day – below 60% target`,
      type: 'production',
    })
  }

  const upcoming = (upcomingVax as any[] || []).map((v: any) => {
    const daysTo = Math.ceil(
      (new Date(v.next_due_date!).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
    )
    return {
      id: v.id,
      message: `${batchMap[v.batch_id] || 'Batch'} – ${v.event_type}`,
      subMessage: daysTo === 0 ? 'Due today' : `In ${daysTo} day${daysTo !== 1 ? 's' : ''}`,
      type: 'vaccination',
    }
  })

  return (
    <div className="min-h-screen">
      <PoultryClient
        stats={stats}
        batches={batches as any}
        alerts={alerts}
        upcoming={upcoming}
      />
    </div>
  )
}
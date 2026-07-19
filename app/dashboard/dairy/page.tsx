// 📁 FILE PATH: app/dashboard/dairy/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DairyClient from './DairyClient'
import { validateFarmAccess } from '@/lib/validate-farm-access'

export const dynamic = 'force-dynamic'

export default async function DairyDashboardPage() {
  const access = await validateFarmAccess()

  if (!access.success) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  // Fetch cows. Sold/deceased cows are excluded from the herd entirely, but
  // dry/heifer cows must stay in — the old .eq('status','active') here meant
  // dry_cows could never be non-zero below, since dry cows were filtered out
  // before the count ever ran.
  const { data: cows } = await supabase
    .from('cows')
    .select('id, cow_tag, name, purpose, status')
    .eq('farm_id', access.farmId!)
    .not('status', 'in', '(sold,deceased)')

  const allCowsRaw = cows ?? []
  // dam_id scoping for calves below needs every cow this farm has ever
  // owned (including sold/deceased dams), not just the still-present ones.
  const { data: allFarmCowIdsRows } = await supabase
    .from('cows')
    .select('id')
    .eq('farm_id', access.farmId!)
  const allFarmCowIds = (allFarmCowIdsRows ?? []).map(c => c.id)

  const allCows = allCowsRaw
  const cowIds = allCows.map(c => c.id)

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  if (cowIds.length === 0) {
    return (
      <DairyClient
        stats={{
          total_cows: 0,
          producing_cows: 0,
          dry_cows: 0,
          today_milk: 0,
          avg_daily_milk: 0,
          calves: 0,
        }}
        alerts={[]}
        upcoming={[]}
      />
    )
  }

  const [milkRes, breedingRes, vetRes, healthRes, calvesRes] = await Promise.all([
    supabase
      .from('milk_records')
      .select('record_date, total_milk')
      .in('cow_id', cowIds)
      .gte('record_date', thirtyDaysAgo)
      .order('record_date', { ascending: false }),
    supabase
      .from('breeding_events')
      .select('id, cow_id, expected_calving_date, pregnancy_result')
      .in('cow_id', cowIds)
      .or('pregnancy_result.is.null,pregnancy_result.eq.pending'),
    supabase
      .from('vet_visits')
      .select('id, cow_id, visit_reason, next_visit_date, vet_name')
      .eq('farm_id', access.farmId!)
      .in('cow_id', cowIds)
      .gte('visit_date', ninetyDaysAgo)
      .not('next_visit_date', 'is', null)
      .order('next_visit_date', { ascending: true }),
    supabase
      .from('health_records')
      .select('id, cow_id, disease, treatment_date')
      .in('cow_id', cowIds)
      .gte('treatment_date', ninetyDaysAgo)
      .order('treatment_date', { ascending: false }),
    // calves has no farm_id column and no tracked RLS migration in this
    // repo — scope explicitly by dam_id membership rather than trusting
    // an unverified RLS policy to do it.
    allFarmCowIds.length > 0
      ? supabase.from('calves').select('id, status').in('dam_id', allFarmCowIds)
      : Promise.resolve({ data: [] as { id: string; status: string | null }[] }),
  ])

  const milkRecords = milkRes.data ?? []
  const breedingEvents = breedingRes.data ?? []
  const vetVisits = vetRes.data ?? []
  const healthRecords = healthRes.data ?? []
  const calvesInDevelopment = (calvesRes.data ?? []).filter(
    c => c.status !== 'promoted' && c.status !== 'sold' && c.status !== 'deceased'
  )

  // Stats
  const todayMilk = milkRecords
    .filter(r => r.record_date === today)
    .reduce((sum, r) => sum + (r.total_milk || 0), 0)

  const last7Records = milkRecords.filter(r => r.record_date >= sevenDaysAgo)
  const avgDailyMilk =
    last7Records.length > 0
      ? parseFloat(
          (
            last7Records.reduce((s, r) => s + (r.total_milk || 0), 0) /
            new Set(last7Records.map(r => r.record_date)).size
          ).toFixed(1)
        )
      : 0

  const stats = {
    total_cows: allCows.length,
    producing_cows: allCows.filter(c => c.status === 'active').length,
    dry_cows: allCows.filter(c => c.status === 'dry').length,
    today_milk: parseFloat(todayMilk.toFixed(1)),
    avg_daily_milk: avgDailyMilk,
    calves: calvesInDevelopment.length,
  }

  // Alerts from health records
  const getCowTag = (cowId: string) =>
    allCows.find(c => c.id === cowId)?.cow_tag ?? cowId

  const alerts = healthRecords.slice(0, 5).map(h => ({
    id: h.id,
    message: getCowTag(h.cow_id),
    subMessage: h.disease ?? 'Health treatment',
    type: 'health',
  }))

  // Upcoming from vet visits and expected calvings
  const upcoming: { id: string; message: string; subMessage: string; type: string }[] = []

  vetVisits.slice(0, 3).forEach(v => {
    upcoming.push({
      id: v.id,
      message: v.visit_reason ?? 'Vet visit',
      subMessage: v.next_visit_date
        ? new Date(v.next_visit_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
        : '',
      type: 'vet',
    })
  })

  breedingEvents
    .filter(b => b.expected_calving_date)
    .slice(0, 3)
    .forEach(b => {
      upcoming.push({
        id: b.id,
        message: `Calving due — ${getCowTag(b.cow_id)}`,
        subMessage: new Date(b.expected_calving_date!).toLocaleDateString('en-KE', {
          day: 'numeric',
          month: 'short',
        }),
        type: 'calving',
      })
    })

  return <DairyClient stats={stats} alerts={alerts} upcoming={upcoming} />
}
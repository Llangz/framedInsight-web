import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unwrapOr } from '@/lib/safe-query'
import HealthClient from './HealthClient'

export default async function PoultryHealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!fm) redirect('/onboarding')

  const farmId = fm.farm_id

  const [batchesRes, healthRes] = await Promise.all([
    supabase
      .from('poultry_batches' as any)
      .select('id, batch_name, bird_type, current_count')
      .eq('farm_id', farmId)
      .eq('status', 'active')
      .order('batch_name'),
    supabase
      .from('poultry_health_records' as any)
      .select('*, poultry_batches(batch_name)')
      .eq('farm_id', farmId)
      // BUG FIX (critical): was .order('record_date', ...) — that column
      // doesn't exist on poultry_health_records (confirmed via
      // information_schema; the real column is event_date). Ordering by a
      // nonexistent column fails the query outright, which — same failure
      // class as the dairy/finance dead page — meant this page likely
      // couldn't load at all, on top of HealthClient's insert using the
      // same wrong name on the write side.
      .order('event_date', { ascending: false })
      .limit(50),
  ])

  // unwrapOr throws into app/dashboard/error.tsx on a real query failure,
  // instead of silently treating it the same as "this farm genuinely has
  // no batches / no health records yet" (see lib/safe-query.ts).
  const batches = unwrapOr(batchesRes as any, [] as any[], 'poultry_batches')
  const health = unwrapOr(healthRes as any, [] as any[], 'poultry_health_records')

  // select('*') already returns the real event_date column directly — no
  // remapping needed. The previous `event_date: e.record_date` line was
  // itself a bug: e.record_date is undefined (that column doesn't exist),
  // so it would have overwritten the correct event_date with undefined on
  // every row even if the query above hadn't failed first.
  const healthEvents = health as any[]

  return <HealthClient farmId={farmId} initialBatches={batches as any} initialEvents={healthEvents} />
}
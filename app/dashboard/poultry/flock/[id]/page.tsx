import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BatchDetailClient from './BatchDetailClient'

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()
  if (!fm) redirect('/onboarding')

  const farmId = fm.farm_id

  // Fetch the batch — verify it belongs to this farm
  const { data: batch } = await (supabase as any)
    .from('poultry_batches')
    .select(`
      id, batch_name, bird_type, breed, date_of_placement,
      initial_count, current_count, status, source,
      purchase_price_per_bird, house_number, housing_system,
      expected_laying_date, target_weight_kg, notes
    `)
    .eq('id', id)
    .eq('farm_id', farmId)
    .single()

  if (!batch) notFound()

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

  const [
    { data: eggRecords },
    { data: feedRecords },
    { data: mortRecords },
    { data: healthRecords },
    { data: salesRecords },
  ] = await Promise.all([
    (supabase as any)
      .from('poultry_egg_records')
      .select('id, record_date, total_eggs, eggs_collected, notes')
      .eq('batch_id', id)
      .gte('record_date', ninetyDaysAgo)
      .order('record_date', { ascending: false }),

    (supabase as any)
      .from('poultry_feed_records')
      .select('id, record_date, feed_type, quantity_kg, days_remaining, notes')
      .eq('batch_id', id)
      .gte('record_date', ninetyDaysAgo)
      .order('record_date', { ascending: false }),

    (supabase as any)
      .from('poultry_mortality')
      .select('id, record_date, count_dead, notes')
      .eq('batch_id', id)
      .gte('record_date', ninetyDaysAgo)
      .order('record_date', { ascending: false }),

    (supabase as any)
      .from('poultry_health_records')
      .select('id, record_date, event_type, next_due_date, notes')
      .eq('batch_id', id)
      .order('record_date', { ascending: false }),

    (supabase as any)
      .from('poultry_sales')
      .select('id, sale_date, sale_type, quantity, unit, price_per_unit, total_price, buyer_name, market, payment_method, notes')
      .eq('batch_id', id)
      .order('sale_date', { ascending: false }),
  ])

  return (
    <BatchDetailClient
      batch={batch}
      farmId={farmId}
      eggRecords={eggRecords   ?? []}
      feedRecords={feedRecords ?? []}
      mortRecords={mortRecords ?? []}
      healthRecords={healthRecords ?? []}
      salesRecords={salesRecords   ?? []}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BatchDetailClient from './BatchDetailClient'

interface Props { params: { id: string } }

export default async function BatchDetailPage({ params }: Props) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()
  if (!fm) redirect('/onboarding')

  const farmId  = fm.farm_id
  const batchId = params.id

  // ── Batch ────────────────────────────────────────────────────────────────
  const { data: batch } = await (supabase as any)
    .from('poultry_batches')
    .select('*')
    .eq('id', batchId)
    .eq('farm_id', farmId)
    .single()

  if (!batch) notFound()

  const thirtyAgo = new Date(Date.now() - 30  * 86400000).toISOString().split('T')[0]
  const ninetyAgo = new Date(Date.now() - 90  * 86400000).toISOString().split('T')[0]

  // ── Egg records (last 90 days) ───────────────────────────────────────────
  const { data: eggRecords } = await (supabase as any)
    .from('poultry_egg_records')
    .select('id, record_date, total_eggs, eggs_collected, notes')
    .eq('batch_id', batchId)
    .gte('record_date', ninetyAgo)
    .order('record_date', { ascending: false })

  // ── Feed records (last 90 days) ──────────────────────────────────────────
  const { data: feedRecords } = await (supabase as any)
    .from('poultry_feed_records')
    .select('id, record_date, feed_type, quantity_kg, days_remaining, notes')
    .eq('batch_id', batchId)
    .gte('record_date', ninetyAgo)
    .order('record_date', { ascending: false })

  // ── Mortality records (last 90 days) ─────────────────────────────────────
  const { data: mortRecords } = await (supabase as any)
    .from('poultry_mortality')
    .select('id, record_date, count_dead, notes')
    .eq('batch_id', batchId)
    .gte('record_date', ninetyAgo)
    .order('record_date', { ascending: false })

  // ── Health records (all time for this batch) ──────────────────────────────
  const { data: healthRecords } = await (supabase as any)
    .from('poultry_health_records')
    .select('id, record_date, event_type, next_due_date, notes')
    .eq('batch_id', batchId)
    .order('record_date', { ascending: false })
    .limit(50)

  // ── Sales records ────────────────────────────────────────────────────────
  const { data: salesRecords } = await (supabase as any)
    .from('poultry_sales')
    .select('id, sale_date, sale_type, quantity, unit, price_per_unit, total_price, buyer_name, market, payment_method, notes')
    .eq('batch_id', batchId)
    .order('sale_date', { ascending: false })

  return (
    <BatchDetailClient
      batch={batch}
      farmId={farmId}
      eggRecords={eggRecords      ?? []}
      feedRecords={feedRecords     ?? []}
      mortRecords={mortRecords     ?? []}
      healthRecords={healthRecords ?? []}
      salesRecords={salesRecords   ?? []}
    />
  )
}
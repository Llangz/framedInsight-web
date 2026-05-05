import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MilkClient from './MilkClient'

export default async function MilkRecordsPage() {
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

  // Load cows
  const { data: cowsData } = await supabase
    .from('cows')
    .select('id, name, cow_tag')
    .eq('farm_id', farmManager.farm_id)
    .eq('status', 'active')
    .order('name')

  const cows = cowsData || []
  const cowIds = cows.map(c => c.id)

  // Load milk records via cow_ids (milk_records has no farm_id column)
  let records: any[] = []
  let error = null
  if (cowIds.length > 0) {
    const result = await supabase
      .from('milk_records')
      .select(`
        *,
        cows (name, cow_tag)
      `)
      .in('cow_id', cowIds)
      .order('record_date', { ascending: false })
    records = result.data || []
    error = result.error
  }

  if (error) {
    console.error('Error loading milk records:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MilkClient initialRecords={records || []} initialCows={cows} />
    </div>
  )
}


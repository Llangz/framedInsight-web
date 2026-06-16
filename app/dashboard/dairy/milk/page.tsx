import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MilkClient from './MilkClient'
import { validateFarmAccess } from '@/lib/validate-farm-access'
import type { MilkRecord, Cow } from '@/lib/database.types'

interface MilkPageProps {
  searchParams: Promise<{
    page?: string
    cowId?: string
    startDate?: string
    endDate?: string
  }>
}

export default async function MilkRecordsPage({ searchParams }: MilkPageProps) {
  const params = await searchParams
  const access = await validateFarmAccess()
  
  if (!access.success) {
    redirect('/auth/login')
  }

  const supabase = await createClient()
  const page = Number(params.page) || 1
  const limit = 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Get cow IDs for this farm first (milk_records has no farm_id)
  const { data: farmCows } = await supabase
    .from('cows')
    .select('id')
    .eq('farm_id', access.farmId!)

  const cowIds = farmCows?.map(c => c.id) ?? []

  // If no cows, return empty results
  if (cowIds.length === 0) {
    return (
      <MilkClient
        records={[]}
        cows={[]}
        pagination={{
          currentPage: page,
          totalPages: 0,
          totalRecords: 0,
          hasPrev: false,
          hasNext: false,
        }}
        filters={{
          cowId: params.cowId,
          startDate: params.startDate,
          endDate: params.endDate,
        }}
      />
    )
  }

  // Build query with filters
  let query = supabase
    .from('milk_records')
    .select('*', { count: 'exact' })
    .in('cow_id', cowIds)

  // Apply cow filter
  if (params.cowId) {
    query = query.eq('cow_id', params.cowId)
  }

  // Apply date range filters
  if (params.startDate) {
    query = query.gte('record_date', params.startDate)
  }
  if (params.endDate) {
    query = query.lte('record_date', params.endDate)
  }

  // Execute paginated query
  const { data: records, error, count } = await query
    .order('record_date', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Failed to fetch milk records:', error)
    return <div className="p-4 text-red-600">Failed to load milk records</div>
  }

  // Fetch FULL cow objects for filter dropdown and display
  const { data: cows } = await supabase
    .from('cows')
    .select('*')  // ✅ Select ALL fields to match Cow type
    .eq('farm_id', access.farmId!)
    .eq('status', 'active')
    .order('cow_tag')

  const totalPages = count ? Math.ceil(count / limit) : 0

  return (
    <MilkClient
      records={records ?? []}
      cows={cows ?? []}
      pagination={{
        currentPage: page,
        totalPages,
        totalRecords: count ?? 0,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      }}
      filters={{
        cowId: params.cowId,
        startDate: params.startDate,
        endDate: params.endDate,
      }}
    />
  )
}
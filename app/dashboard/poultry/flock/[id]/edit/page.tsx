import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EditBatchClient from './EditBatchClient'

export default async function EditBatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) redirect('/onboarding')

  const { data: batchRaw, error } = await supabase
    .from('poultry_batches')
    .select('*')
    .eq('id', id)
    .eq('farm_id', farmManager.farm_id)
    .single()

  if (error || !batchRaw) notFound()

  // Cast to the richer type that EditBatchClient expects (optional columns may be absent from generated types)
  const batch = batchRaw as any

  return <EditBatchClient batch={batch} />
}
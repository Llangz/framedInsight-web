import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { ArrowLeft } from 'lucide-react'
import FarmDetailClient from './FarmDetailClient'

export const dynamic = 'force-dynamic'

export default async function AdminFarmDetailPage({
  params,
}: {
  params: Promise<{ farmId: string }>
}) {
  const { farmId } = await params
  const sb = await createAdminServiceClient()

  const { data: farm } = await sb.from('farms').select('*').eq('id', farmId).maybeSingle()
  if (!farm) notFound()

  const [{ data: plots }, { data: transactions }, { data: recentAudit }] = await Promise.all([
    sb.from('coffee_plots').select('id, plot_name, total_trees').eq('farm_id', farmId),
    sb.from('transactions').select('id, amount, status, mpesa_receipt_number, months_added, created_at')
      .eq('farm_id', farmId).order('created_at', { ascending: false }).limit(10),
    (sb as any).from('audit_log').select('action, created_at, details')
      .eq('farm_id', farmId).order('created_at', { ascending: false }).limit(15),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/admin/farms" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white">
        <ArrowLeft size={13} /> All farms
      </Link>

      <FarmDetailClient
        farm={farm}
        plots={plots || []}
        transactions={transactions || []}
        recentAudit={recentAudit || []}
      />
    </div>
  )
}

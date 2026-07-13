import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { ArrowLeft } from 'lucide-react'
import CoopDetailClient from './CoopDetailClient'

export const dynamic = 'force-dynamic'

export default async function AdminCoopDetailPage({
  params,
}: {
  params: Promise<{ coopId: string }>
}) {
  const { coopId } = await params
  const sb = await createAdminServiceClient()

  const { data: coop } = await sb.from('cooperatives').select('*').eq('id', coopId).maybeSingle()
  if (!coop) notFound()

  const [{ data: officers }, { data: farms }] = await Promise.all([
    sb.from('cooperative_officers').select('id, role, email, created_at, user_id').eq('cooperative_id', coopId),
    sb.from('farms').select('id, farm_name, owner_name, phone').eq('managed_by_coop_id', coopId).limit(20),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/admin/cooperatives" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white">
        <ArrowLeft size={13} /> All cooperatives
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">{coop.cooperative_name}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {[coop.sub_county, coop.county].filter(Boolean).join(', ') || 'No location set'}
          {coop.registration_number ? ` · Reg. ${coop.registration_number}` : ''}
        </p>
      </div>

      <CoopDetailClient coopId={coopId} officers={officers || []} />

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Member farms {farms && farms.length === 20 ? '(first 20)' : ''}</h2>
        <div className="space-y-2 text-sm">
          {(farms || []).map((f) => (
            <Link key={f.id} href={`/admin/farms/${f.id}`} className="flex items-center justify-between text-zinc-400 hover:text-white">
              <span>{f.farm_name} · {f.owner_name}</span>
              <span className="text-xs">{f.phone}</span>
            </Link>
          ))}
          {(farms || []).length === 0 && <p className="text-zinc-600">No member farms yet.</p>}
        </div>
      </div>
    </div>
  )
}

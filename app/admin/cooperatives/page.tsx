import Link from 'next/link'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { Building2, MapPin, Users2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminCooperativesPage() {
  const sb = await createAdminServiceClient()

  const { data: coops } = await sb
    .from('cooperatives')
    .select('id, cooperative_name, county, sub_county, registration_number, created_at')
    .order('cooperative_name')

  // Two extra counts per cooperative (officers, member farms). Small N of
  // cooperatives platform-wide makes N+1-shaped parallel counts fine here;
  // this isn't a hot path like the farms list, which is why that one uses
  // a single filtered query instead.
  const withCounts = await Promise.all(
    (coops || []).map(async (c) => {
      const [{ count: officerCount }, { count: farmCount }] = await Promise.all([
        sb.from('cooperative_officers').select('id', { count: 'exact', head: true }).eq('cooperative_id', c.id),
        sb.from('farms').select('id', { count: 'exact', head: true }).eq('managed_by_coop_id', c.id),
      ])
      return { ...c, officerCount: officerCount || 0, farmCount: farmCount || 0 }
    })
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Cooperatives</h1>
        <p className="text-sm text-zinc-500 mt-1">Every registered cooperative society on the platform.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {withCounts.map((c) => (
          <Link
            key={c.id}
            href={`/admin/cooperatives/${c.id}`}
            className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center text-emerald-500 shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{c.cooperative_name}</p>
                <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={11} /> {[c.sub_county, c.county].filter(Boolean).join(', ') || 'No location set'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><Users2 size={12} /> {c.officerCount} officer{c.officerCount === 1 ? '' : 's'}</span>
              <span>{c.farmCount} member farm{c.farmCount === 1 ? '' : 's'}</span>
            </div>
          </Link>
        ))}
      </div>
      {withCounts.length === 0 && <p className="text-sm text-zinc-600">No cooperatives registered yet.</p>}
    </div>
  )
}

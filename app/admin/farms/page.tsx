import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Search, MapPin, CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminFarmsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  // Covered by "Platform admins can view all farms" in
  // supabase/migrations/20260714_platform_admin_rls.sql — this is the
  // caller's own session, not a service-role bypass.
  const sb = await createClient()

  let query = sb
    .from('farms')
    .select('id, farm_name, owner_name, phone, county, sub_county, is_active, subscription_tier, is_coop_managed, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // A single text box searching four different columns is friendlier for
  // support/ops triage than separate filter fields — most lookups here
  // are "someone called about farm/phone X", not structured browsing.
  if (q.trim()) {
    const term = q.trim()
    query = query.or(
      `farm_name.ilike.%${term}%,owner_name.ilike.%${term}%,phone.ilike.%${term}%,county.ilike.%${term}%`
    )
  }

  const { data: farms, error } = await query

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Farms</h1>
        <p className="text-sm text-zinc-500 mt-1">Search across every farm on the platform, cooperative-managed or independent.</p>
      </div>

      <form className="relative max-w-md" action="/admin/farms" method="get">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name, owner, phone, or county..."
          className="w-full bg-[#0D0F14] border border-[#2A2D35] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-700"
        />
      </form>

      {error && (
        <p className="text-sm text-red-400">Couldn't load farms: {error.message}</p>
      )}

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2D35] text-left text-xs text-zinc-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Farm</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(farms || []).map((f) => (
              <tr key={f.id} className="border-b border-[#2A2D35] last:border-0 hover:bg-zinc-900/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/farms/${f.id}`} className="text-white font-medium hover:text-emerald-400">
                    {f.farm_name}
                  </Link>
                  <p className="text-xs text-zinc-500 mt-0.5">{f.owner_name}{f.is_coop_managed ? ' · Coop-managed' : ''}</p>
                </td>
                <td className="px-4 py-3 text-zinc-400">{f.phone}</td>
                <td className="px-4 py-3 text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} className="text-zinc-600" />
                    {[f.sub_county, f.county].filter(Boolean).join(', ') || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 capitalize">{f.subscription_tier || 'none'}</td>
                <td className="px-4 py-3">
                  {f.is_active ? (
                    <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-medium">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
                      <XCircle size={12} /> Suspended
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(farms || []).length === 0 && !error && (
          <p className="text-sm text-zinc-600 px-4 py-8 text-center">
            {q ? `No farms match "${q}".` : 'No farms yet.'}
          </p>
        )}
      </div>
      {(farms || []).length === 100 && (
        <p className="text-xs text-zinc-600">Showing the first 100 results — narrow your search for more specific matches.</p>
      )}
    </div>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { Users2, Building2, CreditCard, AlertTriangle, Satellite, ArrowUpRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getOverviewData() {
  // farms/cooperatives are now covered by the "Platform admins can view
  // all ..." policies from supabase/migrations/20260714_platform_admin_rls.sql,
  // so these go through the caller's own RLS-scoped session — a page that
  // forgot to call validateAdminAccess() would get zero rows here, not
  // every farm on the platform. alerts and coffee_satellite_fetch_log
  // don't have RLS policies yet (see that migration's SCOPE note for why),
  // so those two specifically still go through the service-role client.
  const supabase = await createClient()
  const sbService = await createAdminServiceClient()

  const [
    farmsTotal, farmsActive, coopsTotal,
    pendingAlerts, satelliteFailures24h, recentFarms,
  ] = await Promise.all([
    supabase.from('farms').select('id', { count: 'exact', head: true }),
    supabase.from('farms').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('cooperatives').select('id', { count: 'exact', head: true }),
    sbService.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sbService.from('coffee_satellite_fetch_log').select('id', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('fetch_attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('farms').select('id, farm_name, owner_name, phone, county, subscription_tier, created_at')
      .order('created_at', { ascending: false }).limit(6),
  ])

  const tierCounts: Record<string, number> = {}
  const { data: tierRows } = await supabase.from('farms').select('subscription_tier')
  for (const row of tierRows || []) {
    const tier = row.subscription_tier || 'none'
    tierCounts[tier] = (tierCounts[tier] || 0) + 1
  }

  return {
    farmsTotal: farmsTotal.count || 0,
    farmsActive: farmsActive.count || 0,
    coopsTotal: coopsTotal.count || 0,
    pendingAlerts: pendingAlerts.count || 0,
    satelliteFailures24h: satelliteFailures24h.count || 0,
    recentFarms: recentFarms.data || [],
    tierCounts,
  }
}

function StatCard({ label, value, icon: Icon, tone = 'default', href }: {
  label: string; value: number | string; icon: any; tone?: 'default' | 'warning'; href?: string
}) {
  const inner = (
    <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tone === 'warning' ? 'bg-red-900/20 text-red-400 border border-red-800/40' : 'bg-emerald-900/20 text-emerald-500 border border-emerald-800/40'}`}>
          <Icon size={16} />
        </div>
        {href && <ArrowUpRight size={14} className="text-zinc-600" />}
      </div>
      <p className="mt-4 text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default async function AdminOverviewPage() {
  const data = await getOverviewData()

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">Platform-wide snapshot across every farm and cooperative.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total farms" value={data.farmsTotal} icon={Users2} href="/admin/farms" />
        <StatCard label="Active farms" value={data.farmsActive} icon={Users2} href="/admin/farms" />
        <StatCard label="Cooperatives" value={data.coopsTotal} icon={Building2} href="/admin/cooperatives" />
        <StatCard
          label="Pending alerts"
          value={data.pendingAlerts}
          icon={AlertTriangle}
          tone={data.pendingAlerts > 0 ? 'warning' : 'default'}
          href="/admin/system"
        />
        <StatCard
          label="Satellite failures (24h)"
          value={data.satelliteFailures24h}
          icon={Satellite}
          tone={data.satelliteFailures24h > 0 ? 'warning' : 'default'}
          href="/admin/system"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Subscription tiers</h2>
          <div className="space-y-2.5">
            {Object.entries(data.tierCounts).sort((a, b) => b[1] - a[1]).map(([tier, count]) => (
              <div key={tier} className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 capitalize">{tier}</span>
                <span className="text-white font-semibold">{count}</span>
              </div>
            ))}
          </div>
          <Link href="/admin/subscriptions" className="mt-4 inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400">
            View billing detail <ArrowUpRight size={12} />
          </Link>
        </div>

        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Recently signed up</h2>
          <div className="space-y-3">
            {data.recentFarms.map((f) => (
              <Link
                key={f.id}
                href={`/admin/farms/${f.id}`}
                className="flex items-center justify-between text-sm hover:bg-zinc-900/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{f.farm_name}</p>
                  <p className="text-xs text-zinc-500 truncate">{f.owner_name} · {f.county || 'No county set'}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-zinc-500 capitalize shrink-0 ml-2">
                  {f.subscription_tier || 'none'}
                </span>
              </Link>
            ))}
            {data.recentFarms.length === 0 && <p className="text-sm text-zinc-600">No farms yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

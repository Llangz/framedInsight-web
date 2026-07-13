import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { Satellite, AlertTriangle } from 'lucide-react'

// This is the cooperative-officer counterpart to app/admin/system — same
// idea, scoped to just this cooperative's own farms rather than the whole
// platform. It reads coffee_satellite_fetch_log and alerts through the
// service-role client rather than the officer's own RLS-scoped session:
// as of this page, neither table has an RLS policy granting cooperative
// officers read access (unlike farms/coffee_plots, which already do — see
// app/dashboard/cooperative/farmers/page.tsx), and getting that scoping
// right for two more tables felt like the wrong place to introduce new
// RLS policy risk. Access is still fully gated: validateCoopAccess() runs
// first, and every query below is explicitly filtered to this coop's own
// farm ids in application code — the same pattern app/admin/** uses for
// platform-wide reads, just narrowed to one cooperative.
export const dynamic = 'force-dynamic'

export default async function CooperativeSystemPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()
  const { data: farms } = await supabase.from('farms').select('id, farm_name').eq('managed_by_coop_id', access.coopId)
  const farmIds = (farms || []).map((f) => f.id)
  const farmNameMap = new Map((farms || []).map((f) => [f.id, f.farm_name]))

  let satFailures: any[] = []
  let pendingAlerts: any[] = []

  if (farmIds.length > 0) {
    const sb = await createAdminServiceClient()
    const [{ data: plots }, { data: alertRows }] = await Promise.all([
      sb.from('coffee_plots').select('id, farm_id').in('farm_id', farmIds),
      sb.from('alerts').select('id, farm_id, plot_id, alert_type, alert_priority, message, alert_date, sent_at')
        .in('farm_id', farmIds).eq('status', 'pending')
        .order('alert_date', { ascending: false }).limit(30),
    ])
    pendingAlerts = alertRows || []

    const plotIds = (plots || []).map((p) => p.id)
    if (plotIds.length > 0) {
      const { data: fetchLog } = await sb
        .from('coffee_satellite_fetch_log')
        .select('id, plot_id, error_message, fetch_attempted_at')
        .in('plot_id', plotIds).eq('status', 'error')
        .order('fetch_attempted_at', { ascending: false }).limit(25)
      satFailures = fetchLog || []
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">
      <div className="border-b border-[#2A2D35] pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">System Health</h1>
        <p className="text-zinc-400 text-sm mt-1">Satellite monitoring and alerts across your cooperative's member farms.</p>
      </div>

      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <Satellite size={14} /> Satellite fetch failures ({satFailures.length})
        </h2>
        <div className="space-y-2 text-sm">
          {satFailures.map((s) => (
            <div key={s.id} className="border-b border-[#2A2D35] last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Plot {s.plot_id.slice(0, 8)}</span>
                <span className="text-xs">{new Date(s.fetch_attempted_at).toLocaleString('en-KE')}</span>
              </div>
              <p className="text-xs text-red-400 mt-0.5">{s.error_message || 'Unknown error'}</p>
            </div>
          ))}
          {satFailures.length === 0 && <p className="text-zinc-600">No recent satellite fetch failures for your farms.</p>}
        </div>
      </div>

      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <AlertTriangle size={14} /> Pending alerts ({pendingAlerts.length})
        </h2>
        <div className="space-y-2 text-sm">
          {pendingAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-[#2A2D35] last:border-0 pb-2 last:pb-0">
              <div className="min-w-0">
                <p className="text-zinc-300 truncate">{farmNameMap.get(a.farm_id) || 'Unknown farm'}: {a.message}</p>
                <p className="text-xs text-zinc-600">{a.sent_at ? 'WhatsApp sent' : 'Not yet delivered'}</p>
              </div>
              <span className={`text-xs shrink-0 ml-2 capitalize ${
                a.alert_priority === 'critical' ? 'text-red-400' : a.alert_priority === 'high' ? 'text-amber-400' : 'text-zinc-500'
              }`}>
                {a.alert_priority}
              </span>
            </div>
          ))}
          {pendingAlerts.length === 0 && <p className="text-zinc-600">No pending alerts for your member farms.</p>}
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { Satellite, AlertTriangle, ScrollText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminSystemPage() {
  const sb = await createAdminServiceClient()

  const [{ data: satFailures }, { data: pendingAlerts }, { data: auditRows }] = await Promise.all([
    sb.from('coffee_satellite_fetch_log')
      .select('id, plot_id, status, error_message, fetch_attempted_at, cloud_cover_pct')
      .eq('status', 'error')
      .order('fetch_attempted_at', { ascending: false })
      .limit(25),
    sb.from('alerts')
      .select('id, farm_id, plot_id, alert_type, alert_priority, message, alert_date, sent_at')
      .eq('status', 'pending')
      .order('alert_date', { ascending: false })
      .limit(30),
    (sb as any).from('audit_log')
      .select('action, resource, farm_id, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">System health</h1>
        <p className="text-sm text-zinc-500 mt-1">Satellite pipeline failures, unsent alerts, and the platform activity log.</p>
      </div>

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <Satellite size={14} /> Satellite fetch failures ({(satFailures || []).length})
        </h2>
        <div className="space-y-2 text-sm max-h-80 overflow-y-auto">
          {(satFailures || []).map((s) => (
            <div key={s.id} className="border-b border-[#2A2D35] last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between text-zinc-400">
                <Link href={`/admin/farms`} className="text-zinc-300 hover:text-white">Plot {s.plot_id.slice(0, 8)}</Link>
                <span className="text-xs">{new Date(s.fetch_attempted_at!).toLocaleString('en-KE')}</span>
              </div>
              <p className="text-xs text-red-400 mt-0.5">{s.error_message || 'Unknown error'}</p>
            </div>
          ))}
          {(satFailures || []).length === 0 && <p className="text-zinc-600">No recent satellite fetch failures.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <AlertTriangle size={14} /> Pending alerts ({(pendingAlerts || []).length})
        </h2>
        <div className="space-y-2 text-sm max-h-80 overflow-y-auto">
          {(pendingAlerts || []).map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-[#2A2D35] last:border-0 pb-2 last:pb-0">
              <div className="min-w-0">
                <p className="text-zinc-300 truncate">{a.message}</p>
                <p className="text-xs text-zinc-600">
                  {a.alert_type} · {a.sent_at ? 'Delivered' : 'Not yet delivered — will retry in next digest'}
                </p>
              </div>
              <span className={`text-xs shrink-0 ml-2 capitalize ${
                a.alert_priority === 'critical' ? 'text-red-400' : a.alert_priority === 'high' ? 'text-amber-400' : 'text-zinc-500'
              }`}>
                {a.alert_priority}
              </span>
            </div>
          ))}
          {(pendingAlerts || []).length === 0 && <p className="text-zinc-600">No pending alerts.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <ScrollText size={14} /> Recent platform activity
        </h2>
        <div className="space-y-2 text-xs text-zinc-500 max-h-96 overflow-y-auto">
          {(auditRows || []).map((a: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-zinc-300">{a.action} <span className="text-zinc-600">· {a.resource}</span></span>
              <span>{new Date(a.created_at).toLocaleString('en-KE')}</span>
            </div>
          ))}
          {(auditRows || []).length === 0 && <p className="text-zinc-600">No activity logged yet.</p>}
        </div>
      </div>
    </div>
  )
}

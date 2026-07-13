import Link from 'next/link'
import { createAdminServiceClient } from '@/lib/supabase/admin-client'
import { AlertTriangle, CreditCard } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  const sb = await createAdminServiceClient()

  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const [{ data: expiringSoon }, { data: expired }, { data: transactions }, { data: tierRows }] = await Promise.all([
    sb.from('farms').select('id, farm_name, phone, subscription_tier, subscription_end_date')
      .eq('is_active', true).not('subscription_end_date', 'is', null)
      .gte('subscription_end_date', now).lte('subscription_end_date', in7Days)
      .order('subscription_end_date'),
    sb.from('farms').select('id, farm_name, phone, subscription_tier, subscription_end_date')
      .eq('is_active', true).not('subscription_end_date', 'is', null)
      .lt('subscription_end_date', now)
      .order('subscription_end_date', { ascending: false }).limit(20),
    sb.from('transactions').select('id, farm_id, amount, status, mpesa_receipt_number, phone_number, created_at')
      .order('created_at', { ascending: false }).limit(20),
    sb.from('farms').select('subscription_tier'),
  ])

  const tierCounts: Record<string, number> = {}
  for (const row of tierRows || []) {
    const tier = row.subscription_tier || 'none'
    tierCounts[tier] = (tierCounts[tier] || 0) + 1
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Subscriptions &amp; billing</h1>
        <p className="text-sm text-zinc-500 mt-1">Tier breakdown, renewals coming due, and recent M-Pesa activity.</p>
      </div>

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
        <h2 className="text-sm font-semibold text-white mb-4">By tier</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).map(([tier, count]) => (
            <div key={tier} className="rounded-lg border border-[#2A2D35] bg-zinc-900/50 p-3">
              <p className="text-lg font-bold text-white">{count}</p>
              <p className="text-xs text-zinc-500 capitalize">{tier}</p>
            </div>
          ))}
        </div>
      </div>

      {(expired && expired.length > 0) && (
        <div className="rounded-xl border border-red-800/40 bg-red-950/10 p-5">
          <h2 className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Expired but still marked active ({expired.length})
          </h2>
          <div className="space-y-2 text-sm">
            {expired.map((f) => (
              <Link key={f.id} href={`/admin/farms/${f.id}`} className="flex items-center justify-between text-zinc-300 hover:text-white">
                <span>{f.farm_name} · {f.phone}</span>
                <span className="text-xs text-red-400">{new Date(f.subscription_end_date!).toLocaleDateString('en-KE')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Renewing within 7 days</h2>
        <div className="space-y-2 text-sm">
          {(expiringSoon || []).map((f) => (
            <Link key={f.id} href={`/admin/farms/${f.id}`} className="flex items-center justify-between text-zinc-400 hover:text-white">
              <span>{f.farm_name} · {f.phone} <span className="capitalize text-zinc-600">({f.subscription_tier})</span></span>
              <span className="text-xs">{new Date(f.subscription_end_date!).toLocaleDateString('en-KE')}</span>
            </Link>
          ))}
          {(expiringSoon || []).length === 0 && <p className="text-zinc-600">Nothing renewing in the next 7 days.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5"><CreditCard size={14} /> Recent M-Pesa transactions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide border-b border-[#2A2D35]">
              <th className="py-2 font-medium">Phone</th>
              <th className="py-2 font-medium">Amount</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Receipt</th>
              <th className="py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {(transactions || []).map((t) => (
              <tr key={t.id} className="border-b border-[#2A2D35] last:border-0 text-zinc-400">
                <td className="py-2">{t.phone_number}</td>
                <td className="py-2 text-white">KES {t.amount}</td>
                <td className="py-2 capitalize">
                  <span className={t.status === 'completed' || t.status === 'success' ? 'text-emerald-500' : t.status === 'failed' ? 'text-red-400' : 'text-amber-400'}>
                    {t.status}
                  </span>
                </td>
                <td className="py-2">{t.mpesa_receipt_number || '—'}</td>
                <td className="py-2">{new Date(t.created_at!).toLocaleString('en-KE')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(transactions || []).length === 0 && <p className="text-zinc-600 text-sm pt-2">No transactions yet.</p>}
      </div>
    </div>
  )
}

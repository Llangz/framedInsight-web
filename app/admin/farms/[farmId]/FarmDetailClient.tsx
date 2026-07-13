'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, Phone, MapPin, Trees, CreditCard } from 'lucide-react'
import { setFarmActive, updateFarmSubscription } from './actions'

const TIERS = ['smallholder', 'commercial', 'enterprise', 'enterprise_plus'] as const

export default function FarmDetailClient({ farm, plots, transactions, recentAudit }: {
  farm: any; plots: any[]; transactions: any[]; recentAudit: any[]
}) {
  const [isPending, startTransition] = useTransition()
  const [tier, setTier] = useState(farm.subscription_tier || 'smallholder')
  const [endDate, setEndDate] = useState(farm.subscription_end_date?.slice(0, 10) || '')
  const [notice, setNotice] = useState<string | null>(null)

  const toggleActive = () => {
    startTransition(async () => {
      try {
        await setFarmActive(farm.id, !farm.is_active)
        setNotice(farm.is_active ? 'Farm suspended.' : 'Farm reactivated.')
      } catch (e: any) {
        setNotice(`Error: ${e.message}`)
      }
    })
  }

  const saveSubscription = () => {
    startTransition(async () => {
      try {
        await updateFarmSubscription(farm.id, tier, endDate || null)
        setNotice('Subscription updated.')
      } catch (e: any) {
        setNotice(`Error: ${e.message}`)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{farm.farm_name}</h1>
          <p className="text-sm text-zinc-500 mt-1">{farm.owner_name}</p>
        </div>
        {farm.is_active ? (
          <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-medium bg-emerald-900/20 border border-emerald-800/40 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={12} /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium bg-red-900/20 border border-red-800/40 px-2.5 py-1 rounded-full">
            <AlertTriangle size={12} /> Suspended
          </span>
        )}
      </div>

      {notice && (
        <div className="text-sm rounded-lg border border-[#2A2D35] bg-zinc-900 px-3 py-2 text-zinc-300">{notice}</div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 text-sm">
        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-4">
          <p className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1"><Phone size={12} /> Phone</p>
          <p className="text-white font-medium">{farm.phone}</p>
        </div>
        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-4">
          <p className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1"><MapPin size={12} /> Location</p>
          <p className="text-white font-medium">{[farm.sub_county, farm.county].filter(Boolean).join(', ') || '—'}</p>
        </div>
        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-4">
          <p className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1"><Trees size={12} /> Coffee plots</p>
          <p className="text-white font-medium">{plots.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5"><CreditCard size={14} /> Subscription</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="mt-1 w-full bg-zinc-900 border border-[#2A2D35] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-700"
            >
              {TIERS.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Valid until</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full bg-zinc-900 border border-[#2A2D35] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-700"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveSubscription}
            disabled={isPending}
            className="text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Save subscription
          </button>
          <button
            onClick={toggleActive}
            disabled={isPending}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              farm.is_active
                ? 'bg-red-900/20 border border-red-800/40 text-red-300 hover:bg-red-900/30'
                : 'bg-emerald-900/20 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/30'
            }`}
          >
            {farm.is_active ? 'Suspend farm' : 'Reactivate farm'}
          </button>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Recent M-Pesa transactions</h2>
          <div className="space-y-2 text-sm">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-zinc-400">
                <span>{t.mpesa_receipt_number || t.status} · {t.months_added}mo</span>
                <span className="text-white">KES {t.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentAudit.length > 0 && (
        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Recent activity</h2>
          <div className="space-y-2 text-xs text-zinc-500">
            {recentAudit.map((a, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-zinc-300">{a.action}</span>
                <span>{new Date(a.created_at).toLocaleString('en-KE')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

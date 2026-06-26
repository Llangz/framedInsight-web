/**
 * app/dashboard/cooperative/intake/page.tsx
 *
 * Factory intake list — server component.
 * Shows all intake lots for the cooperative, grouped by season,
 * with status badges and a button to open a new lot.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getIntakeLots, getCoopFactories } from './actions'
import {
  ClipboardList, Plus, Scale, Users, Package,
  CheckCircle2, Clock, Loader2, Archive, ChevronRight,
  Coffee, AlertCircle, Ship,
} from 'lucide-react'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  open:        { label: 'Open',        color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-900/30', icon: CheckCircle2 },
  processing:  { label: 'Processing',  color: 'text-blue-400',    bg: 'bg-blue-950/40 border-blue-900/30',       icon: Loader2      },
  milled:      { label: 'Milled',      color: 'text-purple-400',  bg: 'bg-purple-950/40 border-purple-900/30',   icon: Package      },
  exported:    { label: 'Exported',    color: 'text-[#C9A96E]',   bg: 'bg-amber-950/40 border-amber-900/30',    icon: Coffee       },
  closed:      { label: 'Closed',      color: 'text-zinc-500',    bg: 'bg-zinc-900/40 border-zinc-800/30',      icon: Archive      },
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Stage tabs shared across the intake → mill → export pipeline ────────────
function StageTabs({ active }: { active: 'intake' | 'mill' | 'export' }) {
  const tabs = [
    { key: 'intake', label: 'Factory Intake', href: '/dashboard/cooperative/intake',              icon: ClipboardList },
    { key: 'mill',   label: 'Mill Lots',      href: '/dashboard/cooperative/intake/mill-lots',     icon: Package       },
    { key: 'export', label: 'Export Lots',    href: '/dashboard/cooperative/intake/export-lots',   icon: Ship          },
  ] as const
  return (
    <div className="flex items-center gap-1 bg-[#0D0F14] border border-[#2A2D35] rounded-xl p-1 w-fit">
      {tabs.map(t => {
        const Icon = t.icon
        const isActive = t.key === active
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              isActive ? 'bg-[#C9A96E] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Icon size={12} />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}

export default async function IntakePage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const [{ lots }, { factories }] = await Promise.all([
    getIntakeLots(),
    getCoopFactories(),
  ])

  const factoryMap = new Map(factories.map(f => [f.id, { name: f.factory_name, code: f.factory_code }]))

  // Season totals
  const totalCherryKg  = lots.reduce((s, l) => s + (l.total_cherry_kg ?? 0), 0)
  const totalFarmers   = lots.reduce((s, l) => s + (l.total_farmers ?? 0), 0)
  const openLots       = lots.filter(l => l.status === 'open').length
  const exportedLots   = lots.filter(l => l.status === 'exported' || l.status === 'closed').length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="space-y-4 border-b border-[#2A2D35] pb-6">
        <StageTabs active="intake" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <ClipboardList size={26} className="text-[#C9A96E]" />
            Factory Intake
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Record cherry deliveries from member farmers. Each lot tracks the full chain to export.
          </p>
        </div>
        <Link
          href="/dashboard/cooperative/intake/new"
          className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold px-4 py-2.5 rounded-xl text-sm transition shrink-0"
        >
          <Plus size={15} /> Open new lot
        </Link>
        </div>
      </div>

      {/* ── Season summary stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total lots',       value: lots.length,                        sub: 'this season' },
          { label: 'Cherry received',  value: `${totalCherryKg.toLocaleString()} kg`, sub: 'across all lots' },
          { label: 'Farmer deliveries',value: totalFarmers.toLocaleString(),       sub: 'cumulative' },
          { label: 'Exported / closed',value: exportedLots,                        sub: `${openLots} still open` },
        ].map(s => (
          <div key={s.label} className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-1">{s.label}</span>
            <span className="block text-2xl font-bold text-[#C9A96E] leading-none">{s.value}</span>
            <span className="block text-[10px] text-zinc-600 mt-1">{s.sub}</span>
          </div>
        ))}
      </div>

      {/* ── No factories warning ─────────────────────────────────────────── */}
      {factories.length === 0 && (
        <div className="bg-amber-950/30 border border-amber-900/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            No washing stations configured.{' '}
            <Link href="/dashboard/cooperative/factories" className="underline font-semibold">
              Add a factory first
            </Link>{' '}
            before opening an intake lot — the factory code is required to generate lot numbers.
          </p>
        </div>
      )}

      {/* ── Lots list ───────────────────────────────────────────────────── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
        {lots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2D35] bg-[#0A0C10]/60 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Lot number</th>
                  <th className="px-6 py-4">Washing station</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Cherry kg</th>
                  <th className="px-6 py-4 text-center">Farmers</th>
                  <th className="px-6 py-4 text-center">Outturn</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35] text-sm">
                {lots.map(lot => {
                  const factory = factoryMap.get(lot.factory_id)
                  const s = STATUS[lot.status] ?? STATUS.closed
                  const StatusIcon = s.icon
                  return (
                    <tr key={lot.id} className="hover:bg-zinc-900/30 transition-colors group">
                      {/* Lot number */}
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-[#C9A96E] text-xs">{lot.lot_number}</span>
                        {lot.season && (
                          <span className="block text-[10px] text-zinc-500 mt-0.5">
                            {lot.season === 'main' ? 'Main Crop' : 'Fly Crop'} {lot.harvest_year}
                          </span>
                        )}
                      </td>

                      {/* Factory */}
                      <td className="px-6 py-4 text-zinc-300">
                        {factory?.name ?? '—'}
                        {factory?.code && (
                          <span className="block text-[10px] font-mono text-zinc-600">{factory.code}</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-zinc-400 text-xs">{fmt(lot.intake_date)}</td>

                      {/* Cherry kg */}
                      <td className="px-6 py-4 text-right font-semibold text-zinc-200">
                        {lot.total_cherry_kg ? lot.total_cherry_kg.toLocaleString() : '—'}
                      </td>

                      {/* Farmers */}
                      <td className="px-6 py-4 text-center text-zinc-300">
                        {lot.total_farmers ?? '—'}
                      </td>

                      {/* Outturn */}
                      <td className="px-6 py-4 text-center">
                        {lot.outturn_ratio ? (
                          <span className={`text-xs font-bold ${
                            lot.outturn_ratio >= 0.18 ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {(lot.outturn_ratio * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.color}`}>
                          <StatusIcon size={9} />
                          {s.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/cooperative/intake/${lot.id}`}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#C9A96E] transition font-semibold"
                        >
                          View <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-zinc-900 border border-[#2A2D35] flex items-center justify-center mx-auto">
              <Scale size={20} className="text-zinc-600" />
            </div>
            <h3 className="text-base font-bold text-white">No intake lots yet</h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              Open your first intake lot to start recording farmer cherry deliveries and tracking the chain to export.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/cooperative/intake/new"
                className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                <Plus size={14} /> Open first lot
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
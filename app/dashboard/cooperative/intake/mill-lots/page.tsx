/**
 * app/dashboard/cooperative/intake/mill-lots/page.tsx
 *
 * Mill lots list — server component.
 * Shows dry-mill runs (parchment → clean coffee) and lets officers
 * open a new mill lot from milled processing batches.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getMillLots } from './actions'
import {
  Package, Plus, ChevronRight, ClipboardList, Ship,
  Clock, Award, Gavel, DollarSign,
} from 'lucide-react'

const STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',   color: 'text-zinc-400',     bg: 'bg-zinc-900/40 border-zinc-800/30',       icon: Clock      },
  milled:    { label: 'Milled',    color: 'text-purple-400',   bg: 'bg-purple-950/40 border-purple-900/30',   icon: Package    },
  graded:    { label: 'Graded',    color: 'text-sky-400',      bg: 'bg-sky-950/40 border-sky-900/30',         icon: Award      },
  auctioned: { label: 'Auctioned', color: 'text-blue-400',     bg: 'bg-blue-950/40 border-blue-900/30',       icon: Gavel      },
  sold:      { label: 'Sold',      color: 'text-emerald-400',  bg: 'bg-emerald-950/40 border-emerald-900/30', icon: DollarSign },
  exported:  { label: 'Exported',  color: 'text-[#C9A96E]',    bg: 'bg-amber-950/40 border-amber-900/30',     icon: Ship       },
}

function fmt(d: string | null) {
  if (!d) return '—'
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

export default async function MillLotsPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const { millLots } = await getMillLots()

  const totalParchment = millLots.reduce((s, m) => s + (m.total_parchment_kg_in ?? 0), 0)
  const totalClean = millLots.reduce((s, m) => s + (m.clean_coffee_kg_out ?? 0), 0)
  const outturnSamples = millLots.filter(m => m.milling_outturn_ratio)
  const avgOutturn = outturnSamples.length > 0
    ? outturnSamples.reduce((s, m) => s + (m.milling_outturn_ratio ?? 0), 0) / outturnSamples.length
    : 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="space-y-4 border-b border-[#2A2D35] pb-6">
        <StageTabs active="mill" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Package size={26} className="text-[#C9A96E]" />
              Mill Lots
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Dry-mill runs that turn parchment from one or more processing batches into clean export-grade coffee.
            </p>
          </div>
          <Link
            href="/dashboard/cooperative/intake/mill-lots/new"
            className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold px-4 py-2.5 rounded-xl text-sm transition shrink-0"
          >
            <Plus size={15} /> New mill lot
          </Link>
        </div>
      </div>

      {/* ── Summary stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Mill lots',        value: millLots.length },
          { label: 'Parchment in',     value: `${totalParchment.toLocaleString()} kg` },
          { label: 'Clean coffee out', value: `${totalClean.toLocaleString()} kg` },
          { label: 'Avg outturn',      value: avgOutturn ? `${(avgOutturn * 100).toFixed(1)}%` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-1">{s.label}</span>
            <span className="block text-2xl font-bold text-[#C9A96E] leading-none">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
        {millLots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2D35] bg-[#0A0C10]/60 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Mill lot</th>
                  <th className="px-6 py-4">Milling date</th>
                  <th className="px-6 py-4 text-center">Batches</th>
                  <th className="px-6 py-4 text-right">Parchment in</th>
                  <th className="px-6 py-4 text-right">Clean out</th>
                  <th className="px-6 py-4 text-center">Outturn</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35] text-sm">
                {millLots.map(m => {
                  const s = STATUS[m.status] ?? STATUS.pending
                  const StatusIcon = s.icon
                  const batchCount = (m.mill_lot_batches as any[] | null)?.length ?? 0
                  return (
                    <tr key={m.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-[#C9A96E] text-xs">{m.mill_lot_number}</span>
                        {m.mill_name && (
                          <span className="block text-[10px] text-zinc-500 mt-0.5">{m.mill_name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-400 text-xs">{fmt(m.milling_date)}</td>
                      <td className="px-6 py-4 text-center text-zinc-300">{batchCount}</td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-200">
                        {m.total_parchment_kg_in ? m.total_parchment_kg_in.toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-200">
                        {m.clean_coffee_kg_out ? m.clean_coffee_kg_out.toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {m.milling_outturn_ratio ? (
                          <span className={`text-xs font-bold ${
                            m.milling_outturn_ratio >= 0.65 ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {(m.milling_outturn_ratio * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.color}`}>
                          <StatusIcon size={9} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href="/dashboard/cooperative/intake/export-lots/new"
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#C9A96E] transition font-semibold"
                        >
                          Export <ChevronRight size={12} />
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
              <Package size={20} className="text-zinc-600" />
            </div>
            <h3 className="text-base font-bold text-white">No mill lots yet</h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              Once a processing batch reaches the &lsquo;milled&rsquo; stage in the intake module,
              combine it here into a mill lot to record the dry-mill outturn before export.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/cooperative/intake/mill-lots/new"
                className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                <Plus size={14} /> Create first mill lot
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
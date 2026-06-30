/**
 * app/dashboard/cooperative/intake/export-lots/page.tsx
 *
 * Export lots list — server component.
 * Shows shipments to international buyers and lets officers create a
 * new export lot from milled, unlinked mill lots.
 */

import { Fragment } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { getExportLots } from './actions'
import BuyerAccessControls from './BuyerAccessControls'
import { DocumentsToggleButton, DocumentsRow } from './ExportLotDocumentsToggle'
import {
  Ship, Plus, ChevronRight, ClipboardList, Package,
  Clock, CheckCircle2, Anchor, Flag, Shield, ShieldAlert,
} from 'lucide-react'

const STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',   color: 'text-zinc-400',     bg: 'bg-zinc-900/40 border-zinc-800/30',       icon: Clock        },
  confirmed: { label: 'Confirmed', color: 'text-sky-400',      bg: 'bg-sky-950/40 border-sky-900/30',         icon: CheckCircle2 },
  shipped:   { label: 'Shipped',   color: 'text-blue-400',     bg: 'bg-blue-950/40 border-blue-900/30',       icon: Ship         },
  arrived:   { label: 'Arrived',   color: 'text-purple-400',   bg: 'bg-purple-950/40 border-purple-900/30',   icon: Anchor       },
  completed: { label: 'Completed', color: 'text-emerald-400',  bg: 'bg-emerald-950/40 border-emerald-900/30', icon: Flag         },
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

export default async function ExportLotsPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId) redirect('/auth/login')

  const { exportLots } = await getExportLots()

  const totalWeight = exportLots.reduce((s, e) => s + (e.net_weight_kg ?? 0), 0)
  const totalValue = exportLots.reduce((s, e) => s + (e.total_value_usd ?? 0), 0)
  const compliantCount = exportLots.filter(e => e.eudr_compliant).length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="space-y-4 border-b border-[#2A2D35] pb-6">
        <StageTabs active="export" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Ship size={26} className="text-[#C9A96E]" />
              Export Lots
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              The buyer-facing shipment record. Link one to a Coffee Passport to make grade,
              weight, and EUDR status visible to roasters and importers.
            </p>
          </div>
          <Link
            href="/dashboard/cooperative/intake/export-lots/new"
            className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold px-4 py-2.5 rounded-xl text-sm transition shrink-0"
          >
            <Plus size={15} /> New export lot
          </Link>
        </div>
      </div>

      {/* ── Summary stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Export lots',     value: exportLots.length },
          { label: 'Net weight',      value: `${totalWeight.toLocaleString()} kg` },
          { label: 'Total FOB value', value: totalValue ? `$${totalValue.toLocaleString()}` : '—' },
          { label: 'EUDR compliant',  value: `${compliantCount} / ${exportLots.length}` },
        ].map(s => (
          <div key={s.label} className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-1">{s.label}</span>
            <span className="block text-2xl font-bold text-[#C9A96E] leading-none">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
        {exportLots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2D35] bg-[#0A0C10]/60 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Export lot</th>
                  <th className="px-6 py-4">Buyer</th>
                  <th className="px-6 py-4 text-right">Net weight</th>
                  <th className="px-6 py-4 text-center">Grade</th>
                  <th className="px-6 py-4 text-center">EUDR</th>
                  <th className="px-6 py-4">Departure</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Buyer room</th>
                  <th className="px-6 py-4 text-right">Documents</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35] text-sm">
                {exportLots.map(e => {
                  const s = STATUS[e.status] ?? STATUS.pending
                  const StatusIcon = s.icon
                  const millLotCount = (e.export_lot_mill_lots as any[] | null)?.length ?? 0
                  return (
                    <Fragment key={e.id}>
                    <tr className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-[#C9A96E] text-xs">{e.export_lot_number}</span>
                        <span className="block text-[10px] text-zinc-500 mt-0.5">
                          {millLotCount} mill lot{millLotCount === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-300">
                        {e.buyer_name ?? '—'}
                        {e.buyer_country && <span className="block text-[10px] text-zinc-600">{e.buyer_country}</span>}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-200">
                        {e.net_weight_kg ? `${e.net_weight_kg.toLocaleString()} kg` : '—'}
                      </td>
                      <td className="px-6 py-4 text-center text-zinc-300 font-semibold">{e.grade ?? '—'}</td>
                      <td className="px-6 py-4 text-center">
                        {e.eudr_compliant ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold"><Shield size={10} /> Yes</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold"><ShieldAlert size={10} /> Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-400 text-xs">{fmt(e.departure_date)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.color}`}>
                          <StatusIcon size={9} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <BuyerAccessControls
                          exportLotId={e.id}
                          token={e.buyer_access_token}
                          revokedAt={e.buyer_access_revoked_at}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DocumentsToggleButton exportLotId={e.id} />
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href="/dashboard/cooperative/passports"
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#C9A96E] transition font-semibold"
                        >
                          Passport <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                    <DocumentsRow exportLotId={e.id} cooperativeId={access.coopId!} colSpan={10} />
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-zinc-900 border border-[#2A2D35] flex items-center justify-center mx-auto">
              <Ship size={20} className="text-zinc-600" />
            </div>
            <h3 className="text-base font-bold text-white">No export lots yet</h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              Once a mill lot is ready, combine it into an export lot here — buyer details,
              shipping documents, and EUDR status all live on this record.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/cooperative/intake/export-lots/new"
                className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8935C] text-black font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                <Plus size={14} /> Create first export lot
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

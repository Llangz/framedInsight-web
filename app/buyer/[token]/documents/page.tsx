/**
 * app/buyer/[token]/page.tsx
 *
 * Private buyer due-diligence data room.
 * Access is controlled by a high-entropy export_lots.buyer_access_token, not by
 * the public passport code printed on QR labels.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Award,
  CheckCircle2,
  Coffee,
  ExternalLink,
  FileCheck2,
  FileWarning,
  Globe2,
  KeyRound,
  Package,
  ShieldCheck,
  Ship,
} from 'lucide-react'
import { checkPublicPageRateLimit } from '@/lib/security'
import { getBuyerDataRoom } from '@/lib/passport/buyer-access.service'
import { DOCUMENT_TYPE_LABELS } from '@/lib/passport/document-types'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Buyer Due Diligence Room | framedInsight',
  robots: { index: false, follow: false },
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtNumber(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined) return '-'
  return `${value.toLocaleString()}${suffix}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#2A2D35] bg-[#0D0F14] rounded-xl p-4">
      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-1">{label}</span>
      <span className="block text-xl font-bold text-[#C9A96E]">{value}</span>
    </div>
  )
}

function TooManyRequests() {
  return (
    <div className="min-h-screen bg-[#08090C] flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-bold text-white mb-2">Too many requests</h1>
        <p className="text-sm text-zinc-400">
          This link has been accessed too many times in a short period. Please wait a moment and try again.
        </p>
      </div>
    </div>
  )
}

export default async function BuyerDataRoomPage({ params }: Props) {
  const { token } = await params

  // Unauthenticated, guessable-adjacent path — rate-limit lookups by IP
  // before hitting the DB. See lib/security.ts's checkPublicPageRateLimit.
  const allowed = await checkPublicPageRateLimit(`buyer-documents:${token}`)
  if (!allowed) return <TooManyRequests />

  const dataRoom = await getBuyerDataRoom(token)

  if (!dataRoom) notFound()

  const cooperative = (dataRoom.cooperatives ?? {}) as any
  const passports = Array.isArray(dataRoom.coffee_passports)
    ? dataRoom.coffee_passports
    : dataRoom.coffee_passports ? [dataRoom.coffee_passports] : []
  const publishedPassport = passports.find((passport: any) => passport.status === 'published') ?? passports[0]

  const eudrReady = !!dataRoom.eudr_compliant && !!dataRoom.eudr_dds_reference
  const documents = Array.isArray(dataRoom.export_lot_documents) ? dataRoom.export_lot_documents : []

  return (
    <main className="min-h-screen bg-[#0A0C10] text-white font-['Outfit']">
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        <header className="border-b border-[#2A2D35] pb-6 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#C9A96E]/25 bg-[#C9A96E]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A96E]">
            <KeyRound size={12} />
            Buyer Due Diligence Room
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{dataRoom.export_lot_number}</h1>
              <p className="mt-1 text-sm text-zinc-400">
                {cooperative.cooperative_name ?? 'Coffee cooperative'} · Kenya
              </p>
              {cooperative.registration_number && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300">
                  <ShieldCheck size={13} />
                  Registered cooperative: <span className="font-mono">{cooperative.registration_number}</span>
                </p>
              )}
            </div>

            {publishedPassport && (
              <Link
                href={`/trace/${publishedPassport.passport_code}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A96E] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#B8935C]"
              >
                Public passport <ExternalLink size={14} />
              </Link>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Grade" value={dataRoom.grade ?? '-'} />
          <Stat label="Net weight" value={fmtNumber(dataRoom.net_weight_kg, ' kg')} />
          <Stat label="SCA score" value={fmtNumber(dataRoom.sca_cupping_score)} />
          <Stat label="Departure" value={fmtDate(dataRoom.departure_date)} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-[#2A2D35] bg-[#0D0F14] rounded-2xl p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-zinc-400">
              <Ship size={15} className="text-[#C9A96E]" />
              Shipment
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-xs text-zinc-500">Exporter</span>
                <span className="text-zinc-200">{dataRoom.exporter_name ?? '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">Buyer country</span>
                <span className="text-zinc-200">{dataRoom.buyer_country ?? '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">Origin port</span>
                <span className="text-zinc-200">{dataRoom.origin_port ?? 'Mombasa'}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">Destination port</span>
                <span className="text-zinc-200">{dataRoom.destination_port ?? '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">Container</span>
                <span className="font-mono text-zinc-200">{dataRoom.container_number ?? '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">Bill of lading</span>
                <span className="font-mono text-zinc-200">{dataRoom.bill_of_lading ?? '-'}</span>
              </div>
            </div>
          </div>

          <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-2xl p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-zinc-400">
              <ShieldCheck size={15} className="text-emerald-300" />
              EUDR
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-emerald-900/20 pb-3">
                <span className="text-sm text-zinc-300">Lot compliance status</span>
                {dataRoom.eudr_compliant ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
                    <CheckCircle2 size={13} /> Compliant
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                    <FileWarning size={13} /> Pending
                  </span>
                )}
              </div>
              <div>
                <span className="block text-xs text-zinc-500">DDS reference</span>
                <span className="font-mono text-sm text-zinc-200">{dataRoom.eudr_dds_reference ?? '-'}</span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-500">
                Plot-level geolocation and DDS bundle downloads should be shared only through this private room,
                not through the public QR passport.
              </p>
            </div>
          </div>
        </section>

        <section className="border border-[#2A2D35] bg-[#0D0F14] rounded-2xl p-5 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-zinc-400">
            <FileCheck2 size={15} className="text-[#C9A96E]" />
            Due diligence pack
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: Globe2, label: 'Plot geolocation export', state: eudrReady ? 'Ready' : 'Generate DDS bundle' },
              { icon: Coffee, label: 'Public coffee passport', state: publishedPassport ? 'Published' : 'Not published' },
              { icon: Award, label: 'Quality and shipment details', state: dataRoom.grade || dataRoom.sca_cupping_score ? 'Available' : 'Incomplete' },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-xl border border-[#2A2D35] bg-[#0A0C10] p-4">
                  <Icon size={16} className="text-[#C9A96E]" />
                  <span className="mt-3 block text-sm font-semibold text-zinc-200">{item.label}</span>
                  <span className="mt-1 block text-xs text-zinc-500">{item.state}</span>
                </div>
              )
            })}
          </div>

          {documents.length > 0 ? (
            <div className="space-y-2 pt-2">
              <span className="block text-xs text-zinc-500">Government-issued documents</span>
              {documents.map((doc: any) => (
                <a
                  key={doc.id}
                  href={`/buyer/${dataRoom.buyer_access_token}/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-[#2A2D35] bg-[#0A0C10] px-4 py-3 hover:border-[#C9A96E]/40 transition"
                >
                  <div>
                    <span className="block text-sm font-medium text-zinc-200">
                      {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                      {doc.document_label && <span className="text-zinc-500 font-normal"> · {doc.document_label}</span>}
                    </span>
                    <span className="block text-[11px] text-zinc-600">{doc.file_name}</span>
                  </div>
                  {doc.verified_at ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-bold">
                      <ShieldCheck size={11} /> Verified
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">Unverified</span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">
              No regulatory documents have been uploaded for this lot yet.
            </p>
          )}
        </section>

        <footer className="flex items-center justify-between border-t border-[#2A2D35] pt-5 text-xs text-zinc-600">
          <span>framedInsight Coffee Traceability</span>
          <span className="inline-flex items-center gap-1.5">
            <Package size={12} />
            {dataRoom.status}
          </span>
        </footer>
      </div>
    </main>
  )
}

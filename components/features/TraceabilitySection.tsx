import Link from 'next/link'
import { QrCode, Link2, ShieldCheck, MapPin, ArrowRight, Fingerprint } from 'lucide-react'

/**
 * components/features/TraceabilitySection.tsx
 *
 * The buyer-facing counterpart to EUDRSection (which speaks to farmers/
 * cooperatives about compliance). This section speaks to the market side:
 * importers, roasters, and buyer compliance teams evaluating a lot.
 *
 * Deliberately styled in the Coffee Digital Passport's own palette
 * (#0A0C10 / #C9A96E parchment gold) rather than the marketing site's
 * light theme — the visual shift signals "this is what your buyer
 * actually sees" rather than another farmer-facing feature block.
 */

const chainSteps = [
  { label: 'Farm & Plot' },
  { label: 'Cherry Delivery' },
  { label: 'Wet Mill Processing' },
  { label: 'Cooperative Lot' },
  { label: 'Export' },
]

const buyerFeatures = [
  {
    icon: Fingerprint,
    title: 'Cryptographic chain of custody',
    description: 'Every handoff — farm to mill to export — is hash-chained. The passport page recomputes and verifies the chain in the buyer\u2019s own browser, so provenance claims aren\u2019t just asserted, they\u2019re checkable.',
  },
  {
    icon: MapPin,
    title: 'Plot-level EUDR geodata',
    description: 'GPS point or polygon boundaries per plot, deforestation-risk screening, and Kenya\u2019s standard-risk country status \u2014 the exact geolocation format EU due diligence requires.',
  },
  {
    icon: Link2,
    title: 'Revocable buyer data rooms',
    description: 'A unique, high-entropy link per export lot gives your buyer secure access to documents and plot GeoJSON \u2014 no shared login, and you can revoke or rotate access at any time.',
  },
  {
    icon: QrCode,
    title: 'One QR code, one bag',
    description: 'Print the passport link as a QR code on the shipment or bag. Anyone \u2014 buyer, auditor, or curious consumer \u2014 scans it and sees the full origin story instantly.',
  },
]

export function TraceabilitySection() {
  return (
    <section id="trace" className="bg-[#0A0C10] py-24 sm:py-32 text-white scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 items-start">

          {/* ── Left copy ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A96E] mb-3">
              For Buyers &amp; Importers
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Coffee Digital Passport —<br />origin your buyer can verify
            </h2>
            <p className="mt-5 text-base text-zinc-400 leading-relaxed max-w-xl">
              Every lot processed through framedInsight can carry a public, verifiable
              record of exactly where it came from \u2014 which cooperative, which factory,
              which farms and plots, processed how, and screened against EU deforestation
              requirements. Not a PDF a buyer has to trust. A ledger they can check themselves.
            </p>

            <ul className="mt-10 space-y-6">
              {buyerFeatures.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#C9A96E]/30 bg-[#C9A96E]/10">
                    <Icon size={16} className="text-[#C9A96E]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/auth/signup-cooperative"
                className="inline-flex items-center gap-2 rounded-lg bg-[#C9A96E] px-5 py-2.5 text-sm font-semibold text-[#0A0C10] hover:bg-[#D9BC85] transition-colors"
              >
                Issue passports for your cooperative
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
              >
                How the ledger works
              </Link>
            </div>
          </div>

          {/* ── Right: chain-of-custody card, mirrors the actual passport UI ── */}
          <div className="rounded-2xl border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
            <div className="border-b border-[#2A2D35] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-sm bg-[#C9A96E]/20 border border-[#C9A96E]/30 flex items-center justify-center">
                  <ShieldCheck size={11} className="text-[#C9A96E]" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-zinc-300">
                  KIAMBU-OTHAYA-2026-0142
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#4A7C59]/20 border border-[#4A7C59]/40 px-2.5 py-0.5 text-[10px] font-medium text-[#7EC49A]">
                Chain verified
              </span>
            </div>

            <div className="px-6 py-6 space-y-1">
              {chainSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A96E]/15 border border-[#C9A96E]/40 text-[10px] font-bold text-[#C9A96E]">
                      {i + 1}
                    </span>
                    {i < chainSteps.length - 1 && (
                      <span className="h-6 w-px bg-[#2A2D35]" />
                    )}
                  </div>
                  <span className="pb-6 text-sm text-zinc-300">{step.label}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#2A2D35] bg-[#0A0C10] px-6 py-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Origin</p>
                <p className="mt-1 text-sm font-medium text-zinc-200">Nyeri County, Kenya</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">EUDR status</p>
                <p className="mt-1 text-sm font-medium text-[#7EC49A]">Deforestation-free</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Farms</p>
                <p className="mt-1 text-sm font-medium text-zinc-200">214 smallholders</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Processing</p>
                <p className="mt-1 text-sm font-medium text-zinc-200">Fully washed</p>
              </div>
            </div>

            <div className="border-t border-[#2A2D35] px-6 py-4 flex items-center gap-2 text-xs text-zinc-500">
              <QrCode size={13} className="text-zinc-500" />
              Scan the bag QR code — or visit <span className="text-[#C9A96E]">/trace/[passportCode]</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
'use client'

/**
 * app/trace/[passportCode]/PassportClient.tsx
 *
 * Consumer-facing Coffee Digital Passport.
 * Palette: near-black #0A0C10 base, warm parchment #C9A96E accent,
 * muted sage #4A7C59 for sustainability signals.
 * Signature: animated provenance chain (plot → factory → mill → exporter → cup)
 */

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  MapPin, Leaf, Award, Users, Sprout, Package,
  Ship, Coffee, CheckCircle, XCircle, Globe,
  ChevronRight, Info, BarChart2, Layers, ShieldCheck, Building2
} from 'lucide-react'

// Leaflet must be dynamic-imported to avoid SSR issues
const PassportMap = dynamic(() => import('./PassportMap'), { ssr: false })

interface Props {
  passport: any
  passportCode: string
  ledger?: any[]
}

// ── Chain step definition ──────────────────────────────────────────────────────
const CHAIN_STEPS = [
  { key: 'plot',    label: 'Farm plots',        icon: Sprout,  color: '#4A7C59' },
  { key: 'factory', label: 'Washing station',   icon: Leaf,    color: '#C9A96E' },
  { key: 'mill',    label: 'Dry mill',          icon: Package, color: '#8B6914' },
  { key: 'export',  label: 'Export lot',        icon: Ship,    color: '#2563EB' },
  { key: 'cup',     label: 'Your cup',          icon: Coffee,  color: '#C9A96E' },
]

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-xl p-4">
      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A8A8A] mb-1">{label}</span>
      <span className="block text-2xl font-bold text-[#C9A96E] leading-none">{value}</span>
      {sub && <span className="block text-xs text-[#555] mt-1">{sub}</span>}
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────────────────────
function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
      ${ok
        ? 'bg-[#4A7C59]/20 border border-[#4A7C59]/40 text-[#7EC49A]'
        : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-500 line-through'}
    `}>
      {ok
        ? <CheckCircle size={11} className="text-[#7EC49A]" />
        : <XCircle size={11} className="text-zinc-600" />
      }
      {label}
    </span>
  )
}

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const pct = ((score - 70) / 30) * 100 // SCA: 70–100 range
  const circ = 2 * Math.PI * 38
  const dash = (pct / 100) * circ

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="38" fill="none" stroke="#1A1D24" strokeWidth="6" />
        <circle
          cx="44" cy="44" r="38" fill="none"
          stroke="#C9A96E" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
      </svg>
      <div className="text-center">
        <span className="block text-2xl font-bold text-[#C9A96E]">{score.toFixed(1)}</span>
        <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">SCA</span>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-[10px] text-zinc-500 hover:text-[#C9A96E] hover:underline cursor-pointer focus:outline-none select-none transition-colors"
    >
      {copied ? 'Copied!' : 'Copy Hash'}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PassportClient({ passport, passportCode, ledger = [] }: Props) {
  const [chainStep, setChainStep] = useState(0)
  const [activeTab, setActiveTab] = useState<'story'|'quality'|'sustainability'|'chain'>('story')

  const story       = (passport.public_story ?? {}) as any
  const sustain     = (passport.sustainability_metrics ?? {}) as any
  const quality     = (passport.quality_metrics ?? {}) as any
  const geo         = (passport.geo_summary ?? {}) as any

  // Animate the chain on load
  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      i++
      setChainStep(i)
      if (i >= CHAIN_STEPS.length - 1) clearInterval(timer)
    }, 350)
    return () => clearInterval(timer)
  }, [])

  const certifications: string[] = quality.certifications ?? []
  const varieties: string[]      = story.varieties ?? []

  return (
    <div className="min-h-screen bg-[#0A0C10] text-white font-['Outfit']">

      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div className="relative border-b border-[#1E2028] overflow-hidden">
        {/* Subtle grain texture via SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden>
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" /></filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>

        {/* Warm radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,_#C9A96E18,_transparent)] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-5 py-10">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-5">
            <div className="h-5 w-5 rounded-sm bg-[#C9A96E]/20 border border-[#C9A96E]/30 flex items-center justify-center">
              <Leaf size={10} className="text-[#C9A96E]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A96E]">
              Coffee Digital Passport
            </span>
            <span className="ml-auto text-[10px] font-mono text-zinc-600">{passportCode}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold leading-tight text-white">
            {story.cooperative ?? 'Cooperative Coffee'}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {story.factory && `${story.factory} · `}{story.county}{story.county ? ' County' : ''}, Kenya
          </p>
          {passport.registration_number && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#7EC49A]">
              <ShieldCheck size={11} />
              Registered cooperative society · <span className="font-mono">{passport.registration_number}</span>
            </p>
          )}

          {/* ── Provenance chain ────────────────────────────────────────────── */}
          <div className="mt-8 flex items-center gap-0">
            {CHAIN_STEPS.map((step, i) => {
              const Icon = step.icon
              const reached = i <= chainStep
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`
                    flex flex-col items-center gap-1 transition-all duration-500
                    ${reached ? 'opacity-100' : 'opacity-20'}
                  `}>
                    <div className={`
                      h-9 w-9 rounded-xl border flex items-center justify-center
                      transition-colors duration-500
                      ${reached
                        ? 'bg-[#C9A96E]/15 border-[#C9A96E]/40'
                        : 'bg-[#111] border-[#2A2D35]'}
                    `}>
                      <Icon size={14} style={{ color: reached ? step.color : '#444' }} />
                    </div>
                    <span className="text-[8px] font-semibold uppercase tracking-wider text-center leading-tight"
                      style={{ color: reached ? '#8A8A8A' : '#333', maxWidth: 52 }}>
                      {step.label}
                    </span>
                  </div>
                  {i < CHAIN_STEPS.length - 1 && (
                    <div className={`
                      h-px w-6 sm:w-10 mx-0.5 mb-4 transition-colors duration-500
                      ${i < chainStep ? 'bg-[#C9A96E]/40' : 'bg-[#2A2D35]'}
                    `} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Quick stats row */}
          <div className="mt-6 flex flex-wrap gap-3">
            {story.farm_count && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Users size={12} className="text-[#C9A96E]" />
                <span><strong className="text-white">{story.farm_count.toLocaleString()}</strong> farmers</span>
              </div>
            )}
            {varieties.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Sprout size={12} className="text-[#4A7C59]" />
                <span>{varieties.join(' · ')}</span>
              </div>
            )}
            {story.processing && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Package size={12} className="text-zinc-500" />
                <span>{story.processing}</span>
              </div>
            )}
            {sustain.eudr_compliant && (
              <div className="flex items-center gap-1.5 text-xs text-[#7EC49A]">
                <CheckCircle size={12} />
                <span>EUDR compliant</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <div className="border-b border-[#1E2028] sticky top-0 bg-[#0A0C10]/95 backdrop-blur z-10">
        <div className="max-w-2xl mx-auto px-5 flex gap-0 overflow-x-auto">
          {([
            { id: 'story',          label: 'Origin story', icon: Globe },
            { id: 'quality',        label: 'Quality',      icon: Award },
            { id: 'sustainability', label: 'Sustainability', icon: Leaf },
            { id: 'chain',         label: 'Supply chain', icon: Layers },
          ] as const).map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold whitespace-nowrap
                  border-b-2 transition-colors
                  ${active
                    ? 'border-[#C9A96E] text-[#C9A96E]'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'}
                `}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">

        {/* ORIGIN STORY TAB */}
        {activeTab === 'story' && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              {story.harvest_season && (
                <StatCard label="Harvest season" value={story.harvest_season} />
              )}
              {story.avg_farm_size_acres && (
                <StatCard
                  label="Avg farm size"
                  value={`${story.avg_farm_size_acres} ac`}
                  sub="Kenyan smallholder"
                />
              )}
              {geo.plot_count && (
                <StatCard label="Contributing plots" value={geo.plot_count.toLocaleString()} />
              )}
              {story.altitude_m && (
                <StatCard label="Altitude" value={`${story.altitude_m}m`} sub="Above sea level" />
              )}
            </div>

            {/* Farmer story */}
            {story.farmer_story && (
              <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  About this coffee
                </h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{story.farmer_story}</p>
              </div>
            )}

            {/* Map */}
            {geo.centroid_lat && geo.centroid_lng && (
              <div className="rounded-2xl overflow-hidden border border-[#2A2D35]">
                <div className="bg-[#0D0F14] px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
                  <MapPin size={13} className="text-[#C9A96E]" />
                  <span className="text-xs font-semibold text-zinc-300">Origin location</span>
                  <span className="ml-auto text-[10px] font-mono text-zinc-600">
                    {geo.centroid_lat.toFixed(4)}, {geo.centroid_lng.toFixed(4)}
                  </span>
                </div>
                <div className="h-56">
                  <PassportMap
                    lat={geo.centroid_lat}
                    lng={geo.centroid_lng}
                    label={story.factory ?? story.cooperative}
                  />
                </div>
              </div>
            )}

            {/* Tasting notes */}
            {story.tasting_notes && (
              <div className="border border-[#C9A96E]/20 bg-[#C9A96E]/5 rounded-2xl p-5">
                <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#C9A96E]/70 mb-2">
                  Tasting notes
                </span>
                <p className="text-sm text-zinc-200 italic">&ldquo;{story.tasting_notes}&rdquo;</p>
              </div>
            )}

            {/* Legal registration — cooperative legitimacy for buyer due diligence */}
            {(passport.registration_number || passport.registered_office) && (
              <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
                  <Building2 size={12} className="text-[#C9A96E]" />
                  Cooperative registration
                </h3>
                <div className="space-y-2.5 text-sm">
                  {passport.registration_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Registration number</span>
                      <span className="font-mono font-semibold text-[#7EC49A] flex items-center gap-1.5">
                        <ShieldCheck size={12} />
                        {passport.registration_number}
                      </span>
                    </div>
                  )}
                  {passport.registered_office && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500 shrink-0">Registered office</span>
                      <span className="text-zinc-200 text-right">{passport.registered_office}</span>
                    </div>
                  )}
                  {passport.commissioner_ref && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Commissioner reference</span>
                      <span className="font-mono text-zinc-300">{passport.commissioner_ref}</span>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
                  Issued by Kenya&apos;s Commissioner for Co-operative Development on incorporation —
                  this verifies {story.cooperative ?? 'this cooperative'} is a legally registered
                  Farmers&apos; Cooperative Society, not an informal trading group.
                </p>
              </div>
            )}
          </>
        )}

        {/* QUALITY TAB */}
        {activeTab === 'quality' && (
          <>
            {quality.sca_score && (
              <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex items-center gap-6">
                <ScoreRing score={quality.sca_score} />
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">SCA Cupping Score</span>
                  <span className="block text-2xl font-bold text-white">{quality.sca_score.toFixed(1)} / 100</span>
                  {quality.grade && (
                    <span className="inline-block px-2 py-0.5 bg-[#C9A96E]/15 border border-[#C9A96E]/30 rounded text-[10px] font-bold text-[#C9A96E] uppercase">
                      Grade {quality.grade}
                    </span>
                  )}
                  {quality.cupper_name && (
                    <span className="block text-xs text-zinc-500">
                      Cupped by {quality.cupper_name}
                      {quality.cupping_date && ` · ${quality.cupping_date}`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Score breakdown */}
            {(quality.aroma || quality.acidity || quality.body) && (
              <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">
                  Score breakdown
                </h3>
                {[
                  { label: 'Aroma', value: quality.aroma },
                  { label: 'Acidity', value: quality.acidity },
                  { label: 'Body', value: quality.body },
                ].filter(s => s.value).map(s => (
                  <div key={s.label} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{s.label}</span>
                      <span className="text-white font-semibold">{s.value?.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-[#1A1D24] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#C9A96E] rounded-full transition-all duration-700"
                        style={{ width: `${((s.value - 6) / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Certifications */}
            {certifications.length > 0 && (
              <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  Certifications
                </h3>
                <div className="flex flex-wrap gap-2">
                  {certifications.map(c => (
                    <Badge key={c} label={c} ok={true} />
                  ))}
                </div>
              </div>
            )}

            {quality.moisture_pct && (
              <StatCard
                label="Moisture content"
                value={`${quality.moisture_pct}%`}
                sub="Target: 10–12%"
              />
            )}
          </>
        )}

        {/* SUSTAINABILITY TAB */}
        {activeTab === 'sustainability' && (
          <>
            <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">
                EUDR & Deforestation
              </h3>
              <div className="flex items-center justify-between py-2 border-b border-[#1E2028]">
                <span className="text-sm text-zinc-300">EU Deforestation Regulation</span>
                {sustain.eudr_compliant
                  ? <span className="flex items-center gap-1 text-xs text-[#7EC49A] font-semibold"><CheckCircle size={12} /> Compliant</span>
                  : <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold"><Info size={12} /> Pending</span>
                }
              </div>
              {sustain.deforestation_free_plots_pct !== undefined && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-zinc-400">Deforestation-free plots</span>
                    <span className="text-white font-bold">{sustain.deforestation_free_plots_pct}%</span>
                  </div>
                  <div className="h-2 bg-[#1A1D24] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${sustain.deforestation_free_plots_pct}%`,
                        background: sustain.deforestation_free_plots_pct === 100 ? '#4A7C59' : '#C9A96E'
                      }}
                    />
                  </div>
                </div>
              )}
              {sustain.avg_forest_cover_pct && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-zinc-400">Avg tree/shade cover</span>
                  <span className="text-zinc-200 font-semibold">{sustain.avg_forest_cover_pct}%</span>
                </div>
              )}
            </div>

            <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                Certifications & practices
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge label="EUDR Compliant" ok={!!sustain.eudr_compliant} />
                <Badge label="Organic" ok={!!sustain.organic_certified} />
                <Badge label="Rainforest Alliance" ok={!!sustain.rainforest_alliance} />
                <Badge label="Fair Trade" ok={!!sustain.fair_trade} />
              </div>
            </div>

            {sustain.total_plot_area_acres && (
              <StatCard
                label="Total farm area"
                value={`${sustain.total_plot_area_acres} ac`}
                sub={`${(sustain.total_plot_area_acres * 0.4047).toFixed(1)} hectares`}
              />
            )}
          </>
        )}

        {/* SUPPLY CHAIN TAB */}
        {activeTab === 'chain' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Every step in this coffee&apos;s journey has been recorded and is verifiable.
              </p>
              {CHAIN_STEPS.map((step, i) => {
                const Icon = step.icon
                const isLast = i === CHAIN_STEPS.length - 1
                const details = {
                  plot:    `${geo.plot_count ?? story.farm_count ?? '—'} plots · ${story.county ?? ''} County`,
                  factory: story.factory ? `${story.factory} · ${story.county ?? 'Kenya'}` : 'Cooperative washing station',
                  mill:    'Dry mill — parchment to clean coffee',
                  export:  `${passport.destination_port ? `Shipped to ${passport.destination_port}` : 'Mombasa export'}`,
                  cup:     'Consumer scan confirmed',
                }[step.key] ?? ''

                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0"
                        style={{ background: `${step.color}15`, borderColor: `${step.color}40` }}
                      >
                        <Icon size={14} style={{ color: step.color }} />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-[#2A2D35] mt-1" style={{ minHeight: 20 }} />}
                    </div>
                    <div className={`pb-4 ${isLast ? '' : ''}`}>
                      <span className="block text-sm font-semibold text-white">{step.label}</span>
                      <span className="block text-xs text-zinc-500 mt-0.5">{details}</span>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#4A7C59]">
                        <CheckCircle size={9} />
                        <span>Recorded on framedInsight</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Cryptographic Hash Ledger Visualizer */}
            {ledger && ledger.length > 0 && (
              <div className="mt-8 border-t border-[#1E2028] pt-6 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#C9A96E] flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#C9A96E]" />
                  Verify Cryptographic Ledger
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  This coffee&apos;s chain of custody is secured on an immutable, hash-chained ledger.
                  Altering any historical record invalidates subsequent hashes, providing mathematical proof of origin.
                </p>

                <div className="space-y-3 mt-4">
                  {ledger.map((event, idx) => {
                    const eventName = {
                      passport_created: 'Origin Passport Registry Created',
                      passport_published: 'Origin Passport Published to Public',
                      delivery_added: 'Farmer Cherry Delivery Registered',
                      parchment_recorded: 'Parchment Intake Processed',
                      nce_linked: 'Nairobi Coffee Exchange Outturn Linked',
                      status_changed: 'Batch Status Changed'
                    }[event.event_type] || event.event_type

                    const formattedDate = new Date(event.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })

                    return (
                      <div key={idx} className="bg-[#0D0F14] border border-[#2A2D35] rounded-xl p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-200">{eventName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{formattedDate}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
                          <span className="text-zinc-500">
                            Actor: <strong className="text-zinc-300 font-normal">{event.actor_name}</strong>
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-1.5 border-t border-[#1E2028] text-[10px] font-mono text-zinc-500">
                          <div className="flex flex-wrap justify-between items-center gap-1">
                            <span>Prev Hash: <span className="text-zinc-400">{event.previous_hash ? `${event.previous_hash.slice(0, 16)}...` : 'GENESIS'}</span></span>
                            {event.previous_hash && <CopyButton text={event.previous_hash} />}
                          </div>
                          <div className="flex flex-wrap justify-between items-center gap-1">
                            <span>Curr Hash: <span className="text-[#7EC49A]">{event.current_hash.slice(0, 16)}...</span></span>
                            <CopyButton text={event.current_hash} />
                          </div>
                        </div>

                        {event.event_data && Object.keys(event.event_data).length > 0 && (
                          <details className="text-[11px] text-zinc-400 group cursor-pointer">
                            <summary className="text-[10px] text-zinc-500 hover:text-zinc-300 select-none py-1">
                              View Event Payload
                            </summary>
                            <pre className="mt-1.5 p-3 rounded-lg bg-black/60 border border-[#2A2D35] overflow-x-auto text-[10px] text-zinc-400 font-mono cursor-default">
                              {JSON.stringify(event.event_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-[#1E2028] mt-8">
        <div className="max-w-2xl mx-auto px-5 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-sm bg-[#C9A96E]/20 border border-[#C9A96E]/30 flex items-center justify-center">
              <Leaf size={9} className="text-[#C9A96E]" />
            </div>
            <span className="text-xs text-zinc-500">
              framed<strong className="text-[#C9A96E]">Insight</strong>
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-700">{passportCode}</span>
        </div>
      </div>

    </div>
  )
}
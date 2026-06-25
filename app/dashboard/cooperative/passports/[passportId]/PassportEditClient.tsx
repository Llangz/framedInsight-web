'use client'

/**
 * app/dashboard/cooperative/passports/[passportId]/PassportEditClient.tsx
 *
 * Lets cooperative officers enrich the auto-assembled passport JSON blobs
 * (farmer story, hero image, tasting notes, altitude, certifications)
 * before publishing. Also shows the traceability chain summary and
 * a live preview link.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Coffee, Globe, Eye, CheckCircle, Clock,
  Leaf, Award, Users, MapPin, AlertCircle, Save,
  ExternalLink, Info, Image as ImageIcon, Star,
} from 'lucide-react'
import { publishPassportAction } from '../actions'
import { savePassportEditsAction } from './actions'

interface Passport {
  id: string
  passport_code: string
  status: string
  view_count: number
  published_at: string | null
  public_story: any
  quality_metrics: any
  sustainability_metrics: any
  geo_summary: any
  qr_url: string | null
  export_lots?: {
    export_lot_number: string
    buyer_name: string | null
    buyer_country: string | null
    grade: string | null
    net_weight_kg: number | null
    departure_date: string | null
  } | null
}

interface Props {
  passport: Passport
  userId: string
  coopId: string
}

const FIELD = 'w-full px-4 py-2.5 bg-[#0A0C10] border border-[#2A2D35] rounded-xl text-white placeholder-zinc-600 text-sm outline-none focus:ring-2 focus:ring-[#C9A96E]/40 transition'
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5'
const SECTION = 'bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 space-y-4'

const CERT_OPTIONS = ['Organic', 'Fair Trade', 'Rainforest Alliance', 'UTZ', '4C', 'SAN']

export default function PassportEditClient({ passport, userId, coopId }: Props) {
  const story    = passport.public_story    ?? {}
  const quality  = passport.quality_metrics ?? {}
  const sustain  = passport.sustainability_metrics ?? {}
  const geo      = passport.geo_summary     ?? {}

  // Story fields
  const [farmerStory, setFarmerStory]     = useState<string>(story.farmer_story ?? '')
  const [heroImageUrl, setHeroImageUrl]   = useState<string>(story.hero_image_url ?? '')
  const [tastingNotes, setTastingNotes]   = useState<string>(story.tasting_notes ?? '')
  const [altitudeM, setAltitudeM]         = useState<string>(story.altitude_m?.toString() ?? '')
  const [femalefarmerPct, setFemalefarmerPct] = useState<string>(story.female_farmer_pct?.toString() ?? '')

  // Quality fields
  const [scaScore, setScaScore]           = useState<string>(quality.sca_score?.toString() ?? '')
  const [cupperName, setCupperName]       = useState<string>(quality.cupper_name ?? '')
  const [cuppingDate, setCuppingDate]     = useState<string>(quality.cupping_date ?? '')
  const [flavorNotes, setFlavorNotes]     = useState<string>(quality.flavor_notes ?? '')
  const [certs, setCerts]                 = useState<string[]>(quality.certifications ?? [])

  // Sustainability
  const [chemInputs, setChemInputs]       = useState<string>((sustain.chemical_inputs ?? []).join(', '))

  // Save/publish state
  const [saving, setSaving]           = useState(false)
  const [publishing, setPublishing]   = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)

  const traceUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/trace/${passport.passport_code}`
  const isPublished = passport.status === 'published'

  const toggleCert = (cert: string) => {
    setCerts(prev => prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert])
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    const res = await savePassportEditsAction({
      passportId: passport.id,
      coopId,
      publicStoryPatch: {
        farmer_story:       farmerStory.trim() || undefined,
        hero_image_url:     heroImageUrl.trim() || undefined,
        tasting_notes:      tastingNotes.trim() || undefined,
        altitude_m:         altitudeM ? parseInt(altitudeM) : undefined,
        female_farmer_pct:  femalefarmerPct ? parseFloat(femalefarmerPct) : undefined,
      },
      qualityMetricsPatch: {
        sca_score:      scaScore ? parseFloat(scaScore) : undefined,
        cupper_name:    cupperName.trim() || undefined,
        cupping_date:   cuppingDate || undefined,
        flavor_notes:   flavorNotes.trim() || undefined,
        certifications: certs,
      },
      sustainabilityMetricsPatch: {
        chemical_inputs: chemInputs.trim()
          ? chemInputs.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
      },
    })

    setSaving(false)
    if (!res.success) { setSaveError(res.error ?? 'Failed to save'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handlePublish = async () => {
    if (!confirm('Publish this passport? It will be publicly visible via the QR code URL.')) return
    setPublishing(true)
    const res = await publishPassportAction(passport.id, coopId, userId)
    setPublishing(false)
    if (!res.success) { alert(res.error); return }
    window.location.reload()
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#2A2D35] pb-6">
        <Link href="/dashboard/cooperative/passports"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-4">
          <ArrowLeft size={12} /> All passports
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C9A96E]/10 border border-[#C9A96E]/20 flex items-center justify-center shrink-0">
              <Coffee size={16} className="text-[#C9A96E]" />
            </div>
            <div>
              <span className="block font-mono text-sm font-bold text-[#C9A96E]">{passport.passport_code}</span>
              <span className="block text-xs text-zinc-400 mt-0.5">{story.factory ?? story.cooperative ?? 'Cooperative'}</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
              isPublished
                ? 'bg-emerald-950/40 border-emerald-900/30 text-emerald-400'
                : 'bg-amber-950/40 border-amber-900/30 text-amber-400'
            }`}>
              {isPublished ? <Globe size={9} /> : <Clock size={9} />}
              {isPublished ? 'Published' : 'Draft'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link href={traceUrl} target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 border border-[#2A2D35] text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition">
              <Eye size={11} /> Preview <ExternalLink size={10} />
            </Link>
            {!isPublished && (
              <button onClick={handlePublish} disabled={publishing}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition">
                <Globe size={11} />
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Auto-assembled summary ─────────────────────────────────────────── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
          <Info size={10} /> Auto-assembled from your farm data — enrich below before publishing
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { icon: Users,  label: 'Farmers',    value: story.farm_count ?? '—' },
            { icon: Leaf,   label: 'EUDR',        value: sustain.eudr_compliant ? '✓ Compliant' : 'Pending' },
            { icon: Award,  label: 'Defor-free',  value: sustain.deforestation_free_plots_pct != null ? `${sustain.deforestation_free_plots_pct}%` : '—' },
            { icon: MapPin, label: 'Plots',       value: geo.plot_count ?? '—' },
          ].map(m => {
            const Icon = m.icon
            return (
              <div key={m.label} className="flex items-center gap-2">
                <Icon size={11} className="text-zinc-600 shrink-0" />
                <div>
                  <span className="block text-[9px] text-zinc-600 uppercase tracking-wider">{m.label}</span>
                  <span className="block text-zinc-200 font-semibold">{m.value}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Edit form ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="space-y-5">

        {/* Origin story */}
        <div className={SECTION}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe size={14} className="text-[#C9A96E]" /> Origin story
          </h3>

          <div>
            <label className={LABEL}>Farmer / cooperative story</label>
            <textarea
              value={farmerStory}
              onChange={e => setFarmerStory(e.target.value)}
              rows={4}
              placeholder="Describe the cooperative, the farmers, the landscape, the tradition. This is what a specialty buyer in Japan or Germany will read when they scan the QR code…"
              className={`${FIELD} resize-none`}
            />
            <p className="text-[10px] text-zinc-600 mt-1">Shown on the public trace page. 100–300 words is ideal.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Altitude (metres above sea level)</label>
              <input type="number" value={altitudeM} onChange={e => setAltitudeM(e.target.value)}
                placeholder={story.altitude_m?.toString() ?? 'e.g. 1850'} className={FIELD} min={500} max={3000} />
            </div>
            <div>
              <label className={LABEL}>Women farmers %</label>
              <input type="number" value={femalefarmerPct} onChange={e => setFemalefarmerPct(e.target.value)}
                placeholder={story.female_farmer_pct?.toString() ?? 'e.g. 48'} className={FIELD} min={0} max={100} step={0.1} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Tasting notes <span className="text-zinc-600 normal-case font-normal">(shown in flavour section)</span></label>
            <input type="text" value={tastingNotes} onChange={e => setTastingNotes(e.target.value)}
              placeholder={story.tasting_notes ?? 'e.g. Bright citrus, blackcurrant, silky body'} className={FIELD} />
          </div>

          <div>
            <label className={LABEL}>Hero image URL <span className="text-zinc-600 normal-case font-normal">(farm / washing station photo)</span></label>
            <div className="relative">
              <ImageIcon size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input type="url" value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)}
                placeholder="https://… (Supabase storage, Cloudinary, etc.)"
                className={`${FIELD} pl-9`} />
            </div>
          </div>
        </div>

        {/* Quality */}
        <div className={SECTION}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award size={14} className="text-[#C9A96E]" /> Quality record
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>SCA cupping score</label>
              <div className="relative">
                <Star size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input type="number" value={scaScore} onChange={e => setScaScore(e.target.value)}
                  placeholder={quality.sca_score?.toString() ?? '85.0'} className={`${FIELD} pl-9`}
                  min={70} max={100} step={0.25} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Cupping date</label>
              <input type="date" value={cuppingDate} onChange={e => setCuppingDate(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Cupper name</label>
              <input type="text" value={cupperName} onChange={e => setCupperName(e.target.value)}
                placeholder={quality.cupper_name ?? 'e.g. Samuel Kamau'} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Flavour descriptor</label>
              <input type="text" value={flavorNotes} onChange={e => setFlavorNotes(e.target.value)}
                placeholder={quality.flavor_notes ?? 'e.g. Bright citrus, blackcurrant'} className={FIELD} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Certifications</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CERT_OPTIONS.map(cert => (
                <button
                  key={cert}
                  type="button"
                  onClick={() => toggleCert(cert)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                    certs.includes(cert)
                      ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
                      : 'bg-[#0A0C10] border-[#2A2D35] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {certs.includes(cert) && <CheckCircle size={9} className="inline mr-1" />}
                  {cert}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sustainability */}
        <div className={SECTION}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Leaf size={14} className="text-[#C9A96E]" /> Sustainability inputs
          </h3>
          <div>
            <label className={LABEL}>Chemical / input list <span className="text-zinc-600 normal-case font-normal">(comma-separated)</span></label>
            <input type="text" value={chemInputs} onChange={e => setChemInputs(e.target.value)}
              placeholder={sustain.chemical_inputs?.join(', ') ?? 'e.g. CAN fertilizer, copper fungicide'}
              className={FIELD} />
            <p className="text-[10px] text-zinc-600 mt-1">
              Shown to buyers for residue transparency. Leave blank if none applied.
            </p>
          </div>
        </div>

        {/* Save / error */}
        {saveError && (
          <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/30 border border-red-900/30 px-4 py-3 rounded-xl">
            <AlertCircle size={12} /> {saveError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#C9A96E] hover:bg-[#B8935C] disabled:opacity-40 text-black font-bold rounded-xl text-sm transition"
          >
            <Save size={13} />
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
          {!isPublished && (
            <p className="text-xs text-zinc-500">Save first, then publish when ready.</p>
          )}
        </div>

      </form>
    </div>
  )
}
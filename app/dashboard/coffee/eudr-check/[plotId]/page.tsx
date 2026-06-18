// 📁 FILE PATH: app/dashboard/coffee/eudr-check/[plotId]/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { EventStore, PhotoEvidenceUploadedEvent, EudrAssessmentRunEvent } from '@/lib/event-sourcing'
import {
  ArrowLeft, MapPin, ShieldCheck, ShieldAlert, AlertTriangle,
  FileText, Satellite, RefreshCw, Download, Camera, CheckCircle2,
  XCircle, HelpCircle, Clock, ChevronRight,
} from 'lucide-react'
import CoffeeSubNav from '../../components/CoffeeSubNav'

type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown'

interface PlotData {
  id: string; plot_name: string; area_hectares: number | null
  gps_polygon: any; region_name: string | null
}
type EudrData = Database['public']['Tables']['coffee_eudr_compliance']['Row'] | null
interface SatData { ndvi_mean: number | null; health_label: string | null; image_date: string }
type AuditEvent = Database['public']['Views']['v_compliance_timeline']['Row']

function getRisk(eudr: EudrData): RiskLevel {
  if (!eudr) return 'unknown'
  if (eudr.risk_level === 'high') return 'red'
  if (eudr.risk_level === 'medium') return 'yellow'
  if (eudr.deforestation_risk === true) return 'red'
  if (eudr.compliance_status === 'verified' && eudr.risk_level === 'low') return 'green'
  return 'yellow'
}

// Risk config — Lucide icons, no emoji
const RISK_CONFIG = {
  green:   { Icon: ShieldCheck,  label: 'Ready for export',         sub: 'No deforestation detected. All documents clear.',              border: 'border-emerald-900/40', bg: 'bg-emerald-950/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  yellow:  { Icon: AlertTriangle, label: 'Action required',         sub: 'Verify boundary, upload land title, or review forest baseline.', border: 'border-amber-900/40',   bg: 'bg-amber-950/30',   text: 'text-amber-400',   dot: 'bg-amber-500'   },
  red:     { Icon: XCircle,       label: 'Potential forest conflict', sub: 'Significant tree-cover loss detected after Jan 1, 2021.',      border: 'border-red-900/40',     bg: 'bg-red-950/30',     text: 'text-red-400',     dot: 'bg-red-500'     },
  unknown: { Icon: HelpCircle,    label: 'Not assessed yet',         sub: 'Run validation to assess this plot against EUDR baseline.',     border: 'border-[#2A2D35]',      bg: 'bg-[#0D0F14]',      text: 'text-[#6B7280]',   dot: 'bg-[#4B5563]'   },
}

const EUDR_REQS = [
  { key: 'gps',   label: 'GPS polygon',        desc: 'Plot boundary recorded' },
  { key: 'land',  label: 'Land document',       desc: 'Title or ownership evidence uploaded' },
  { key: 'forest',label: 'Forest baseline',     desc: 'No deforestation since Dec 31 2020' },
]

function PlotMap({ polygon, risk }: { polygon: any; risk: RiskLevel }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!polygon || typeof window === 'undefined') return
    if ((window as any).L) { initMap(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = initMap
    document.head.appendChild(script)
  }, [polygon])

  function initMap() {
    if (!mapRef.current || !polygon) return
    const L = (window as any).L
    if ((mapRef.current as any)._leaflet_id) return
    const coords = polygon?.coordinates?.[0] || polygon?.geometry?.coordinates?.[0] || []
    if (!coords.length) return
    const latlngs = coords.map((c: number[]) => [c[1], c[0]])
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
    const color = risk === 'red' ? '#ef4444' : risk === 'yellow' ? '#f59e0b' : '#10b981'
    const poly = L.polygon(latlngs, { color, weight: 3, fillOpacity: 0.12, fillColor: color }).addTo(map)
    map.fitBounds(poly.getBounds(), { padding: [28, 28] })
    setMapLoaded(true)
  }

  if (!polygon) return (
    <div className="h-52 rounded-lg border border-dashed border-[#2A2D35] flex flex-col items-center justify-center gap-2">
      <MapPin size={20} className="text-[#4B5563]" />
      <p className="text-sm text-[#6B7280]">No GPS polygon recorded</p>
      <p className="text-xs text-[#4B5563]">Draw plot boundary to enable map view</p>
    </div>
  )
  return (
    <div className="relative rounded-lg overflow-hidden border border-[#2A2D35]">
      <div ref={mapRef} style={{ height: 240 }} />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-[#0D0F14] flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-[#2A2D35] border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs text-[#6B7280]">Loading map…</p>
        </div>
      )}
    </div>
  )
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  photo_evidence_uploaded: Camera,
  eudr_assessment_run:     RefreshCw,
  plot_boundary_recorded:  MapPin,
}

export default function EUDRPlotDetailPage() {
  const router = useRouter()
  const params = useParams()
  const plotId = params?.plotId as string

  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [plot, setPlot] = useState<PlotData | null>(null)
  const [eudr, setEudr] = useState<EudrData | null>(null)
  const [sat, setSat] = useState<SatData | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (plotId) loadData() }, [plotId])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (!session) { router.push('/login'); return }
      const [plotRes, eudrRes, satRes, auditRes] = await Promise.all([
        supabase.from('coffee_plots').select('id,plot_name,area_hectares,gps_polygon,region_name').eq('id', plotId).single(),
        supabase.from('coffee_eudr_compliance').select('*').eq('plot_id', plotId).maybeSingle(),
        supabase.from('coffee_satellite_indices').select('ndvi_mean,health_label,image_date').eq('plot_id', plotId).order('image_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('v_compliance_timeline').select('*').eq('plot_id', plotId).order('created_at', { ascending: false }).limit(10),
      ])
      setPlot(plotRes.data); setEudr(eudrRes.data); setSat(satRes.data)
      setAuditTrail(auditRes.data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handlePhotoEvidence(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (!session) throw new Error('Not authenticated')
      const path = `eudr-evidence/${plotId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('farm-photos').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('farm-photos').getPublicUrl(path)
      await supabase.from('coffee_eudr_compliance').upsert({
        plot_id: plotId, farm_id: eudr?.farm_id || '',
        notes: (eudr?.notes ? eudr.notes + '\n' : '') + `Evidence: ${publicUrl}`,
        updated_at: new Date().toISOString(),
        assessment_date: eudr?.assessment_date || new Date().toISOString(),
      }, { onConflict: 'plot_id' })
      const eventStore = new EventStore()
      await eventStore.recordEvent({
        id: crypto.randomUUID(), farm_id: eudr?.farm_id || '',
        event_type: 'photo_evidence_uploaded', actor_id: session.user.id, actor_type: 'farmer',
        created_at: new Date().toISOString(),
        event_data: { plot_id: plotId, photo_url: publicUrl, gps_lat: 0, gps_lng: 0, captured_at: new Date().toISOString(), file_size_bytes: file.size, photo_hash: '', farmer_notes: 'EUDR evidence photo' }
      } as PhotoEvidenceUploadedEvent)
      setMsg({ text: 'Photo evidence uploaded and recorded in audit trail.', ok: true })
      loadData()
    } catch (err: any) {
      setMsg({ text: `Upload failed: ${err.message}`, ok: false })
    } finally { setUploading(false) }
  }

  async function handleRevalidate() {
    setValidating(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (!session) throw new Error('Not authenticated')
      const response = await fetch('https://vwevegzvqjoppsbkowfl.supabase.co/functions/v1/smart-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ plot_id: plotId })
      })
      const result = await response.json()
      const eventStore = new EventStore()
      await eventStore.recordEvent({
        id: crypto.randomUUID(), farm_id: eudr?.farm_id || '',
        event_type: 'eudr_assessment_run', actor_id: session.user.id, actor_type: 'system',
        created_at: new Date().toISOString(),
        event_data: { plot_id: plotId, assessment_service: 'afa_api', risk_level: result.risk_level || 'unknown', forest_cover_pct: result.forest_cover_pct || 0, deforestation_detected_since: result.deforestation_detected_since || null, api_response: result, assessment_duration_ms: result.duration_ms || 0 }
      } as EudrAssessmentRunEvent)
      await loadData()
    } catch (e) {
      setMsg({ text: `Revalidation failed: ${(e as Error).message}`, ok: false })
    } finally { setValidating(false) }
  }

  function exportGeoJSON() {
    if (!plot?.gps_polygon) return
    const geojson = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { plot_id: plot.id, plot_name: plot.plot_name, area_hectares: plot.area_hectares, eudr_compliance_status: eudr?.compliance_status || 'unknown', deforestation_risk: eudr?.risk_level || 'unknown', last_check: eudr?.assessment_date || null, exported_at: new Date().toISOString() }, geometry: plot.gps_polygon }]
    }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${plot.plot_name.replace(/\s+/g, '_')}_EUDR.geojson`; a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2A2D35] border-t-emerald-500 rounded-full animate-spin" />
    </div>
  )

  const risk = getRisk(eudr)
  const cfg = RISK_CONFIG[risk]
  const RiskIcon = cfg.Icon

  const areaAcres = plot?.area_hectares ? (plot.area_hectares / 0.404686).toFixed(2) : null

  const checks = {
    gps:    !!plot?.gps_polygon,
    land:   !!eudr?.notes,
    forest: eudr ? eudr.risk_level === 'low' : false,
  }

  const resolutionSteps = [
    !checks.gps   && { label: 'Record GPS boundary',       desc: 'Walk the farm perimeter with the app open to capture the plot polygon.', href: `/dashboard/coffee/plots/${plotId}/edit` },
    !checks.land  && { label: 'Upload land title document', desc: 'Photograph your title deed and upload it using the camera button below.',  href: null },
    risk === 'red' && { label: 'Upload photo evidence',     desc: 'Take a photo of the coffee trees to prove land use. The camera button captures GPS and timestamp.', href: null },
  ].filter(Boolean) as { label: string; desc: string; href: string | null }[]

  return (
    <div className="min-h-screen bg-obsidian pb-24">
      <CoffeeSubNav />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Breadcrumb + title */}
        <div className="flex items-center gap-2 text-xs text-[#4B5563]">
          <Link href="/dashboard/coffee/eudr-check" className="hover:text-white transition-colors">EUDR</Link>
          <ChevronRight size={12} />
          <span className="text-[#9CA3AF]">{plot?.plot_name || '—'}</span>
        </div>

        {/* Status banner */}
        <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-4 flex items-start gap-3`}>
          <RiskIcon size={18} className={`${cfg.text} flex-shrink-0 mt-0.5`} />
          <div>
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Deforestation risk</p>
            <h1 className={`text-base font-semibold mt-0.5 ${cfg.text}`}>{cfg.label}</h1>
            <p className="text-xs text-[#6B7280] mt-1">{cfg.sub}</p>
          </div>
        </div>

        {/* Plot meta */}
        <div className="flex items-center gap-4 text-xs text-[#6B7280]">
          {areaAcres && <span>{areaAcres} acres</span>}
          {plot?.region_name && <span>{plot.region_name}</span>}
          {eudr?.assessment_date && (
            <span>Last checked {new Date(eudr.assessment_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          )}
        </div>

        {/* Map */}
        <PlotMap polygon={plot?.gps_polygon} risk={risk} />

        {/* Compliance checklist */}
        <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
          <div className="px-4 py-3 border-b border-[#2A2D35]">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Compliance requirements</h2>
          </div>
          <div className="divide-y divide-[#1F2128]">
            {EUDR_REQS.map(req => {
              const ok = checks[req.key as keyof typeof checks]
              return (
                <div key={req.key} className="flex items-center gap-3 px-4 py-3">
                  {ok
                    ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                    : <XCircle size={15} className="text-red-500 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{req.label}</p>
                    <p className="text-xs text-[#6B7280]">{req.desc}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border flex-shrink-0 ${
                    ok
                      ? 'text-emerald-400 border-emerald-900/40 bg-emerald-950/30'
                      : 'text-red-400 border-red-900/40 bg-red-950/30'
                  }`}>{ok ? 'Clear' : 'Missing'}</span>
                </div>
              )
            })}
          </div>

          {/* Forest cover detail */}
          {eudr?.forest_cover_pct != null && (
            <div className="px-4 py-3 border-t border-[#2A2D35]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B7280]">Forest cover at baseline</span>
                <span className="text-white font-medium">{eudr.forest_cover_pct}%</span>
              </div>
            </div>
          )}
        </section>

        {/* Satellite reading */}
        {sat && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
              <Satellite size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Satellite reading</h2>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">NDVI {sat.ndvi_mean?.toFixed(3) ?? '—'}</p>
                <p className="text-xs text-[#6B7280]">{sat.health_label ?? 'Unknown health'}</p>
              </div>
              <p className="text-xs text-[#4B5563]">{sat.image_date ? new Date(sat.image_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
            </div>
          </section>
        )}

        {/* Resolution steps */}
        {resolutionSteps.length > 0 && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35]">
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Resolution steps</h2>
            </div>
            <div className="divide-y divide-[#1F2128]">
              {resolutionSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-5 h-5 rounded-full border border-[#2A2D35] text-[10px] text-[#6B7280] flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{s.label}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{s.desc}</p>
                  </div>
                  {s.href && (
                    <Link href={s.href} className="text-xs text-emerald-500 hover:text-emerald-400 flex-shrink-0">Fix →</Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Message */}
        {msg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${
            msg.ok ? 'border-emerald-900/40 bg-emerald-950/30' : 'border-red-900/40 bg-red-950/30'
          }`}>
            {msg.ok
              ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              : <XCircle size={14} className="text-red-400 flex-shrink-0" />
            }
            <p className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>
          </div>
        )}

        {/* Audit trail */}
        {auditTrail.length > 0 && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
              <Clock size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Compliance audit trail</h2>
            </div>
            <div className="divide-y divide-[#1F2128]">
              {auditTrail.map((event, idx) => {
                const EventIcon = EVENT_ICONS[event.event_type ?? ''] ?? FileText
                return (
                  <div key={idx} className="flex items-start gap-3 px-4 py-3">
                    <EventIcon size={13} className="text-[#4B5563] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white capitalize">{event.event_type?.replace(/_/g, ' ')}</p>
                      {event.risk_level && (
                        <p className={`text-xs mt-0.5 ${
                          event.risk_level === 'low' ? 'text-emerald-400' :
                          event.risk_level === 'medium' ? 'text-amber-400' : 'text-red-400'
                        }`}>Risk: {event.risk_level.toUpperCase()}</p>
                      )}
                    </div>
                    {event.created_at_local_tz && (
                      <p className="text-[11px] text-[#4B5563] flex-shrink-0">
                        {new Date(event.created_at_local_tz).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRevalidate}
            disabled={validating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-[#2A2D35] bg-[#0D0F14] text-sm font-medium text-white hover:border-[#3A3D45] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={validating ? 'animate-spin' : ''} />
            {validating ? 'Checking…' : 'Re-validate'}
          </button>
          <button
            onClick={exportGeoJSON}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-sm font-medium text-white transition-colors"
          >
            <Download size={13} /> Export GeoJSON
          </button>
        </div>
      </div>

      {/* FAB: camera */}
      <div className="fixed bottom-6 right-5 z-30 flex flex-col items-center gap-1">
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoEvidence} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-14 h-14 rounded-full bg-[#0D0F14] border border-[#2A2D35] hover:border-emerald-600 flex items-center justify-center shadow-xl transition-colors disabled:opacity-50"
          title="Upload photo evidence"
        >
          {uploading
            ? <div className="w-5 h-5 border-2 border-[#2A2D35] border-t-emerald-500 rounded-full animate-spin" />
            : <Camera size={18} className="text-[#9CA3AF]" />
          }
        </button>
        <p className="text-[10px] text-[#4B5563]">Evidence</p>
      </div>
    </div>
  )
}
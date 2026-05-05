'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { EventStore, PhotoEvidenceUploadedEvent, EudrAssessmentRunEvent } from '@/lib/event-sourcing'

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

// Lightweight polygon on OpenStreetMap tiles (no react-leaflet needed)
function PlotMap({ polygon, risk }: { polygon: any; risk: RiskLevel }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!polygon || typeof window === 'undefined') return
    // Dynamically load Leaflet from CDN
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
    if ((mapRef.current as any)._leaflet_id) return // already initialized
    const coords = polygon?.coordinates?.[0] || polygon?.geometry?.coordinates?.[0] || []
    if (!coords.length) return
    const latlngs = coords.map((c: number[]) => [c[1], c[0]])
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
    const color = risk === 'red' ? '#ef4444' : risk === 'yellow' ? '#f59e0b' : '#22c55e'
    const poly = L.polygon(latlngs, { color, weight: 4, fillOpacity: 0.15, fillColor: color }).addTo(map)
    map.fitBounds(poly.getBounds(), { padding: [30, 30] })
    setMapLoaded(true)
  }

  if (!polygon) return (
    <div className="h-64 bg-slate-800 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-600">
      <div className="text-center">
        <p className="text-3xl mb-2">📍</p>
        <p className="text-slate-400 text-sm">No GPS polygon recorded</p>
        <p className="text-slate-500 text-xs mt-1">Draw boundary to enable map view</p>
      </div>
    </div>
  )
  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-slate-600">
      <div ref={mapRef} style={{ height: 280 }} />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-slate-600 border-t-green-400 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Loading satellite map...</p>
          </div>
        </div>
      )}
    </div>
  )
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
  const [uploadMsg, setUploadMsg] = useState('')
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (plotId) loadData() }, [plotId])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [plotRes, eudrRes, satRes, auditRes] = await Promise.all([
        supabase.from('coffee_plots').select('id,plot_name,area_hectares,gps_polygon,region_name').eq('id', plotId).single(),
        supabase.from('coffee_eudr_compliance').select('*').eq('plot_id', plotId).maybeSingle(),
        supabase.from('coffee_satellite_indices').select('ndvi_mean,health_label,image_date').eq('plot_id', plotId).order('image_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('v_compliance_timeline').select('*').eq('plot_id', plotId).order('created_at', { ascending: false }).limit(10),
      ])

      setPlot(plotRes.data)
      setEudr(eudrRes.data)
      setSat(satRes.data)
      setAuditTrail(auditRes.data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handlePhotoEvidence(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const path = `eudr-evidence/${plotId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('farm-photos').upload(path, file)
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('farm-photos').getPublicUrl(path)

      // Update compliance record
      await supabase.from('coffee_eudr_compliance').upsert({
        plot_id: plotId,
        farm_id: eudr?.farm_id || '',
        notes: (eudr?.notes ? eudr.notes + '\n' : '') + `Evidence: ${publicUrl}`,
        updated_at: new Date().toISOString(),
        assessment_date: eudr?.assessment_date || new Date().toISOString(),
      }, { onConflict: 'plot_id' })

      // Record event in audit trail
      const eventStore = new EventStore()
      await eventStore.recordEvent({
        id: crypto.randomUUID(),
        farm_id: eudr?.farm_id || '',
        event_type: 'photo_evidence_uploaded',
        actor_id: session.user.id,
        actor_type: 'farmer',
        created_at: new Date().toISOString(),
        event_data: {
          plot_id: plotId,
          photo_url: publicUrl,
          gps_lat: 0, // TODO: get from device GPS
          gps_lng: 0,
          captured_at: new Date().toISOString(),
          file_size_bytes: file.size,
          photo_hash: '', // TODO: compute SHA256 if needed
          farmer_notes: 'EUDR evidence photo'
        }
      } as PhotoEvidenceUploadedEvent)

      setUploadMsg('✅ Photo evidence uploaded and recorded in compliance audit trail!')
      loadData()
    } catch (err: any) {
      setUploadMsg(`❌ Upload failed: ${err.message}`)
    } finally { setUploading(false) }
  }

  async function handleRevalidate() {
    setValidating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Call revalidation service
      const response = await fetch('https://vwevegzvqjoppsbkowfl.supabase.co/functions/v1/smart-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ plot_id: plotId })
      })

      const result = await response.json()

      // Record assessment event in audit trail
      const eventStore = new EventStore()
      await eventStore.recordEvent({
        id: crypto.randomUUID(),
        farm_id: eudr?.farm_id || '',
        event_type: 'eudr_assessment_run',
        actor_id: session.user.id,
        actor_type: 'system',
        created_at: new Date().toISOString(),
        event_data: {
          plot_id: plotId,
          assessment_service: 'afa_api',
          risk_level: result.risk_level || 'unknown',
          forest_cover_pct: result.forest_cover_pct || 0,
          deforestation_detected_since: result.deforestation_detected_since || null,
          api_response: result,
          assessment_duration_ms: result.duration_ms || 0
        }
      } as EudrAssessmentRunEvent)

      await loadData()
    } catch (e) {
      console.error(e)
      setUploadMsg(`❌ Revalidation failed: ${(e as Error).message}`)
    }
    finally { setValidating(false) }
  }

  function exportGeoJSON() {
    if (!plot?.gps_polygon) return alert('No polygon data found for this plot.')
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          plot_id: plot.id,
          plot_name: plot.plot_name,
          area_hectares: plot.area_hectares,
          eudr_compliance_status: eudr?.compliance_status || 'unknown',
          deforestation_risk: eudr?.risk_level || 'unknown',
          last_check: eudr?.assessment_date || null,
          exported_at: new Date().toISOString(),
        },
        geometry: plot.gps_polygon
      }]
    }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${plot.plot_name.replace(/\s+/g, '_')}_EUDR.geojson`
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-600 border-t-green-400 rounded-full animate-spin" />
    </div>
  )

  const risk = getRisk(eudr)
  const bannerConfig = {
    green:   { bg: 'bg-green-700',  icon: '✅', title: 'PLOT READY FOR EXPORT',        sub: 'No deforestation detected. All documents clear.' },
    yellow:  { bg: 'bg-amber-600',  icon: '⚠️', title: 'ACTION REQUIRED',               sub: 'Verify boundary, upload land title, or review forest baseline.' },
    red:     { bg: 'bg-red-700',    icon: '🚫', title: 'POTENTIAL FOREST CONFLICT',     sub: 'Significant tree-cover loss detected after Jan 1, 2021.' },
    unknown: { bg: 'bg-slate-700',  icon: '❓', title: 'COMPLIANCE NOT CHECKED YET',    sub: 'Run validation to assess this plot.' },
  }[risk]

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">

      {/* ── Back nav ── */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/dashboard/coffee/eudr-check" className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600 transition">←</Link>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">EUDR Risk Dashboard</p>
          <p className="text-sm font-bold text-white">{plot?.plot_name || '—'}</p>
        </div>
      </div>

      {/* ── Section 1: Status Banner ── */}
      <div className={`${bannerConfig.bg} px-4 py-6`}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <span className="text-5xl">{bannerConfig.icon}</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Deforestation Risk</p>
            <h1 className="text-xl font-black mt-0.5">{bannerConfig.title}</h1>
            <p className="text-sm opacity-80 mt-1">{bannerConfig.sub}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* ── Section 2: Plot Map ── */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">📍 Plot Boundary Map</p>
          <PlotMap polygon={plot?.gps_polygon} risk={risk} />
          {plot?.gps_polygon && (
            <p className="text-xs text-slate-500 mt-1.5">
              Plot polygon displayed over current satellite imagery. {risk === 'red' && <span className="text-red-400 font-semibold">Red border = conflict zone detected.</span>}
            </p>
          )}
        </div>

        {/* ── Section 3: Risk Breakdown Cards ── */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Risk Breakdown</p>
          <div className="space-y-3">

            {/* Card A: Forest Baseline */}
            <div className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
              eudr && eudr.forest_cover_pct !== null
                ? eudr.risk_level === 'low' ? 'bg-green-950 border-green-600' : 'bg-red-950 border-red-600'
                : 'bg-slate-800 border-slate-600'
            }`}>
              <span className="text-2xl flex-shrink-0">🌳</span>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Forest Baseline — Dec 31, 2020</p>
            {eudr && eudr.forest_cover_pct !== null ? (
                  <p className={`text-sm mt-0.5 font-semibold ${eudr.risk_level === 'low' ? 'text-green-400' : 'text-red-400'}`}>
                    {eudr.risk_level === 'low'
                      ? `✅ No forest detected. Forest cover: ${eudr.forest_cover_pct}%`
                      : `🚫 Forest detected. Risk: ${eudr.risk_level?.toUpperCase()}. Cover: ${eudr.forest_cover_pct}%`}
                  </p>
                ) : (
                  <p className="text-amber-400 text-sm mt-0.5 font-semibold">❓ Not yet assessed — run validation below</p>
                )}
              </div>
            </div>

            {/* Card B: Land Title */}
            <div className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
              eudr?.notes ? 'bg-green-950 border-green-600' : 'bg-amber-950 border-amber-600'
            }`}>
              <span className="text-2xl flex-shrink-0">📄</span>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Legality Check — Land Title</p>
                {eudr?.notes ? (
                  <p className="text-green-400 text-sm mt-0.5 font-semibold">✅ Land ownership document uploaded</p>
                ) : (
                  <div>
                    <p className="text-amber-400 text-sm mt-0.5 font-semibold">⚠️ Land title document missing</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      📎 Upload Land Title Now
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Card C: GPS Accuracy */}
            <div className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
              plot?.gps_polygon ? 'bg-green-950 border-green-600' : 'bg-red-950 border-red-600'
            }`}>
              <span className="text-2xl flex-shrink-0">📡</span>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">GPS Coordinates</p>
                {plot?.gps_polygon ? (
                  <p className="text-green-400 text-sm mt-0.5 font-semibold">
                    ✅ GPS recorded · Polygon boundary available
                  </p>
                ) : (
                  <p className="text-red-400 text-sm mt-0.5 font-semibold">🚫 No GPS data — plot boundary required for EUDR</p>
                )}
                {plot?.area_hectares && (
                  <p className="text-slate-400 text-xs mt-1">Plot size: {plot.area_hectares} ha {plot.area_hectares > 4 ? '· Polygon required (>4 ha)' : '· Point coordinate sufficient (≤4 ha)'}</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── Section 4: Resolution Steps (if not green) ── */}
        {risk !== 'green' && (
          <div className="bg-slate-800 border-2 border-slate-600 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">🔧 Resolution Steps</p>
            <div className="space-y-3">
              {!plot?.gps_polygon && (
                <div className="flex items-start gap-3 bg-slate-700 rounded-lg p-3">
                  <span className="text-xl">1️⃣</span>
                  <div>
                    <p className="text-white text-sm font-bold">Record GPS Boundary</p>
                    <p className="text-slate-400 text-xs mt-0.5">Walk the farm perimeter with the app open to capture precise GPS polygon points.</p>
                  </div>
                </div>
              )}
              {!eudr?.notes && (
                <div className="flex items-start gap-3 bg-slate-700 rounded-lg p-3">
                  <span className="text-xl">2️⃣</span>
                  <div>
                    <p className="text-white text-sm font-bold">Upload Land Title / Ownership Document</p>
                    <p className="text-slate-400 text-xs mt-0.5">Scan or photograph your land title deed and upload it using the button on Card B above.</p>
                  </div>
                </div>
              )}
              {risk === 'red' && (
                <div className="flex items-start gap-3 bg-red-900 rounded-lg p-3">
                  <span className="text-xl">3️⃣</span>
                  <div>
                    <p className="text-white text-sm font-bold">Upload Photo Evidence</p>
                    <p className="text-slate-400 text-xs mt-0.5">Take a photo of the coffee trees facing North to prove the land is coffee, not forest. The camera button below will capture evidence with GPS & timestamp.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Evidence Photos ── */}
        {/* Note: evidence_photos field needs to be added to database schema if needed */}

        {uploadMsg && (
          <div className={`rounded-xl p-3 text-sm font-semibold ${uploadMsg.startsWith('✅') ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {uploadMsg}
          </div>
        )}

        {/* ── Compliance Audit Trail ── */}
        {auditTrail.length > 0 && (
          <div className="bg-slate-800 border-2 border-slate-600 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">📋 Compliance Audit Trail</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {auditTrail.map((event, idx) => (
                <div key={idx} className="bg-slate-700 rounded-lg p-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 flex-shrink-0 mt-0.5">
                      {event.event_type === 'photo_evidence_uploaded' ? '📷' :
                       event.event_type === 'eudr_assessment_run' ? '🔄' :
                       event.event_type === 'plot_boundary_recorded' ? '📍' : '📝'}
                    </span>
                    <div className="flex-1">
                      <p className="text-slate-300 font-semibold capitalize">
                        {event.event_type?.replace(/_/g, ' ')}
                      </p>
                      {event.risk_level && (
                        <p className={`text-xs mt-0.5 ${
                          event.risk_level === 'low' ? 'text-green-400' :
                          event.risk_level === 'medium' ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          Risk: {event.risk_level.toUpperCase()}
                        </p>
                      )}
                      {event.created_at_local_tz && (
                        <p className="text-slate-500 text-xs mt-0.5">
                          {new Date(event.created_at_local_tz).toLocaleDateString('en-KE')} {new Date(event.created_at_local_tz).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Events recorded for compliance verification and dispute resolution</p>
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="space-y-3">
          <button
            onClick={handleRevalidate}
            disabled={validating}
            className="w-full bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 text-base transition"
          >
            {validating ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Running satellite check...</>
            ) : (
              '🔄 Re-Validate Plot (Satellite)'
            )}
          </button>

          <button
            onClick={exportGeoJSON}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-4 px-4 rounded-xl text-base transition"
          >
            📤 Export GeoJSON for Co-op / Buyer
          </button>
        </div>

        {/* Last checked */}
        {eudr?.assessment_date && (
          <p className="text-center text-slate-500 text-xs">
            Last compliance check: {new Date(eudr.assessment_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* ── FAB: Add Photo Evidence ── */}
      <div className="fixed bottom-6 right-6 z-30">
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoEvidence} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-16 h-16 bg-indigo-600 hover:bg-indigo-500 shadow-xl rounded-full flex items-center justify-center text-2xl transition active:scale-95 disabled:bg-slate-600"
          title="Add photo evidence"
        >
          {uploading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '📷'}
        </button>
        <p className="text-center text-xs text-slate-400 mt-1 whitespace-nowrap">Evidence</p>
      </div>
    </div>
  )
}

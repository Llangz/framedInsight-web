'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Turtle, RefreshCw, AlertTriangle, CheckCircle2, XCircle, HelpCircle,
  TreePine, FileText, Satellite, Map, Wrench, ClipboardList, Camera, Download, MapPin,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { EventStore, PhotoEvidenceUploadedEvent, EudrAssessmentRunEvent } from '@/lib/event-sourcing'
import type { BoundaryResult } from '@/components/coffee/PlotBoundaryMapper'
import { createOfflineTileLayer } from '@/lib/offline-tile-layer'
import { sentinelTileUrlTemplate } from '@/lib/sentinel-tile-url'

const PlotBoundaryMapper = dynamic(
  () => import('@/components/coffee/PlotBoundaryMapper'),
  { ssr: false, loading: () => (
    <div className="h-64 bg-slate-800 rounded-xl flex items-center justify-center">
      <p className="text-slate-400 text-sm">Loading map…</p>
    </div>
  )}
)

type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown'

interface PlotData {
  id: string; plot_name: string; area_hectares: number | null
  gps_polygon: any; gps_latitude: number | null; gps_longitude: number | null
  region_name: string | null; farm_id: string
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

// gps_polygon may be stored as a bare Polygon/MultiPolygon geometry OR as a full
// GeoJSON Feature wrapping one (the boundary mapper saves Features). Normalize both.
function extractGeometry(polygon: any): { type: string; coordinates: any } | null {
  if (!polygon) return null
  if (polygon.type === 'Feature' && polygon.geometry) return polygon.geometry
  if (polygon.type === 'Polygon' || polygon.type === 'MultiPolygon' || polygon.type === 'Point') return polygon
  if (Array.isArray(polygon.coordinates)) return { type: 'Polygon', coordinates: polygon.coordinates }
  return null
}

function extractPolygonLatLngs(polygon: any): [number, number][] {
  const geom = extractGeometry(polygon)
  const coords = geom?.type === 'MultiPolygon' ? geom.coordinates?.[0]?.[0] : geom?.coordinates?.[0]
  return (coords || []).map((c: number[]) => [c[1], c[0]])
}

const RISK_COLOR: Record<RiskLevel, string> = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e', unknown: '#94a3b8' }

type MapStatus = 'loading' | 'ready' | 'timeout' | 'error'

// Satellite plot map — uses the `leaflet` package already bundled with the app instead
// of injecting a <script src="https://unpkg.com/..."> tag at runtime. The old CDN-script
// approach had two compounding problems: (1) the site's Content-Security-Policy doesn't
// allow scripts from unpkg.com, so the browser silently blocked it outright, and (2) there
// was no onerror/timeout handling, so the "Loading satellite map…" spinner had no way to
// ever resolve when the script didn't load. Bundling avoids the CSP issue entirely, and a
// timeout + retry path below means a slow connection no longer spins forever with no
// feedback.
function PlotMap({ polygon, lat, lng, risk }: { polygon: any; lat: number | null; lng: number | null; risk: RiskLevel }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const mapLayersRef = useRef<{ map: any; satellite: any; streetFallback: any; sentinel: any } | null>(null)
  const [status, setStatus] = useState<MapStatus>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')

  // Same imagery-ceiling tracking as PlotBoundaryMapper.tsx / CoopFleetMap.tsx
  // (see the long comment there): Esri's World Imagery returns a valid 200 OK
  // "no imagery here" placeholder rather than an error past its real coverage
  // ceiling for a given spot, which a plain `tileerror` count can never catch.
  // This view previously used a bare L.tileLayer() with no placeholder
  // detection at all, so a saved plot with no real Esri coverage just showed
  // the polygon floating over an empty map with no imagery and no fallback.
  const ESRI_NOMINAL_MAX_ZOOM = 19
  const satelliteZoomCeilingRef = useRef<number>(ESRI_NOMINAL_MAX_ZOOM)
  const placeholderCountAtZoomRef = useRef<{ zoom: number; count: number }>({ zoom: -1, count: 0 })
  const ceilingReductionsRef = useRef(0)

  const latlngs = extractPolygonLatLngs(polygon)
  const hasPolygon = latlngs.length > 0
  const hasPoint = lat != null && lng != null

  useEffect(() => {
    if (typeof window === 'undefined' || (!hasPolygon && !hasPoint)) return

    let cancelled = false
    setStatus('loading')

    // Surface a retry option instead of an endless spinner if init takes too long
    // (e.g. very slow mobile data) — this is the direct fix for the reported bug.
    const timeoutId = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === 'loading' ? 'timeout' : s))
    }, 12000)

    async function init() {
      try {
        const leafletMod: any = await import('leaflet')
        if (cancelled || !containerRef.current) return
        const L = leafletMod.default ?? leafletMod

        if (mapInstanceRef.current) {
          try { mapInstanceRef.current.remove() } catch { /* no-op */ }
          mapInstanceRef.current = null
        }

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: false,
          updateWhenIdle: true, // fewer tile requests while panning — kinder to slow mobile data
        })

        satelliteZoomCeilingRef.current = ESRI_NOMINAL_MAX_ZOOM
        placeholderCountAtZoomRef.current = { zoom: -1, count: 0 }
        ceilingReductionsRef.current = 0

        const color = RISK_COLOR[risk]
        const satellite = createOfflineTileLayer(
          L,
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19 },
          null,
          true // detectNoImagery
        )
        const streetFallback = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })

        // If the satellite tile provider is unreachable on this network, or
        // Esri simply has no real imagery for this location (see the
        // 'tileplaceholder' handler below), fall back through Sentinel-2
        // (real global coverage, coarser resolution) before finally giving
        // up on satellite entirely and switching to the OSM street map —
        // see the matching comment in PlotBoundaryMapper.tsx for why two
        // tiers instead of going straight to street.
        let tileErrors = 0
        let fellBackToSentinel = false
        let fellBackToOsm = false
        const fallBackToOsmFinal = () => {
          if (cancelled || fellBackToOsm) return
          fellBackToOsm = true
          try {
            if (mapLayersRef.current?.sentinel && map.hasLayer(mapLayersRef.current.sentinel)) {
              map.removeLayer(mapLayersRef.current.sentinel)
            } else if (map.hasLayer(satellite)) {
              map.removeLayer(satellite)
            }
            streetFallback.addTo(map)
            setMapType('street')
          } catch (e) {
            console.error('[plot-map] fallBackToOsmFinal failed:', e)
          }
        }
        const fallBackToSentinel = () => {
          if (cancelled || fellBackToSentinel || !map.hasLayer(satellite)) return
          fellBackToSentinel = true
          try {
            map.removeLayer(satellite)
            const sentinelUrl = sentinelTileUrlTemplate()
            if (!sentinelUrl) { fallBackToOsmFinal(); return }
            const sentinel = createOfflineTileLayer(L, sentinelUrl, { maxZoom: 20, maxNativeZoom: 16 }, null, false)
            let sentinelErrors = 0
            sentinel.on('tileerror', () => {
              sentinelErrors += 1
              if (sentinelErrors >= 3) fallBackToOsmFinal()
            })
            sentinel.addTo(map)
            if (mapLayersRef.current) mapLayersRef.current.sentinel = sentinel
            // Still "satellite" from the farmer's perspective — mapType
            // deliberately unchanged.
          } catch (e) {
            console.error('[plot-map] fallBackToSentinel failed:', e)
          }
        }
        satellite.on('tileerror', () => {
          if (cancelled) return
          tileErrors += 1
          if (tileErrors > 4) fallBackToSentinel()
        })
        // A single placeholder tile could just be a coincidentally flat patch
        // of real ground — only treat it as real evidence of "no imagery past
        // this zoom" once seen more than once at the same zoom level.
        satellite.on('tileplaceholder', () => {
          if (cancelled) return
          try {
            const current = map.getZoom()
            if (placeholderCountAtZoomRef.current.zoom !== current) {
              placeholderCountAtZoomRef.current = { zoom: current, count: 0 }
            }
            placeholderCountAtZoomRef.current.count += 1
            if (placeholderCountAtZoomRef.current.count >= 2 && current < satelliteZoomCeilingRef.current) {
              const ceiling = Math.max(current - 1, 1)
              satelliteZoomCeilingRef.current = ceiling
              map.setMaxZoom(ceiling)
              if (map.getZoom() > ceiling) map.setZoom(ceiling)
              // A first reduction just means the initial fitBounds/zoom landed
              // tighter than this location's real ceiling — normal. A SECOND
              // reduction means pulling back once still didn't find real
              // imagery: strong evidence there's no usable Esri coverage here
              // at all, which no further clamp can fix. Switch to Sentinel-2
              // automatically instead of leaving the polygon floating over an
              // empty map with no explanation.
              ceilingReductionsRef.current += 1
              if (ceilingReductionsRef.current >= 2) fallBackToSentinel()
            }
          } catch (e) {
            console.error('[plot-map] tileplaceholder handling failed:', e)
          }
        })
        satellite.addTo(map)
        mapLayersRef.current = { map, satellite, streetFallback, sentinel: null }

        if (hasPolygon) {
          const poly = L.polygon(latlngs, { color, weight: 4, fillOpacity: 0.15, fillColor: color }).addTo(map)
          // Cap how tight fitBounds will zoom for a small plot. Esri's World
          // Imagery mosaic has full high-resolution coverage in cities but
          // only a coarser base layer over a lot of rural/farmland Kenya —
          // past roughly zoom 17-18 in those areas it starts serving a
          // "Map data not yet available" placeholder tile. That tile loads
          // as a completely valid image (it never fires `tileerror`), so
          // the fallback above never catches it — a tiny plot's tight
          // bounding box was pushing fitBounds well past that ceiling.
          // Capping it here keeps small plots framed at a zoom level
          // where imagery is actually far more likely to exist; the
          // satellite/street toggle below is the escape hatch for the
          // specific locations where it still doesn't.
          map.fitBounds(poly.getBounds(), { padding: [30, 30], maxZoom: 17 })
        } else if (hasPoint) {
          L.circleMarker([lat, lng], { radius: 10, color, weight: 3, fillColor: color, fillOpacity: 0.4 }).addTo(map)
          map.setView([lat, lng], 17)
        }

        mapInstanceRef.current = map
        clearTimeout(timeoutId)
        if (!cancelled) setStatus('ready')
      } catch (err) {
        console.error('Plot map failed to load:', err)
        clearTimeout(timeoutId)
        if (!cancelled) setStatus('error')
      }
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove() } catch { /* no-op */ }
        mapInstanceRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygon, lat, lng, risk, retryToken])

  function toggleMapType() {
    const layers = mapLayersRef.current
    if (!layers) return
    const { map, satellite, streetFallback, sentinel } = layers
    if (mapType === 'satellite') {
      if (map.hasLayer(satellite)) map.removeLayer(satellite)
      if (sentinel && map.hasLayer(sentinel)) map.removeLayer(sentinel)
      if (!map.hasLayer(streetFallback)) streetFallback.addTo(map)
      setMapType('street')
    } else {
      if (map.hasLayer(streetFallback)) map.removeLayer(streetFallback)
      if (sentinel && map.hasLayer(sentinel)) map.removeLayer(sentinel)
      layers.sentinel = null
      if (!map.hasLayer(satellite)) satellite.addTo(map)
      setMapType('satellite')
      // Give a manually-requested retry a fresh chance before any future
      // auto-fallback fires again.
      ceilingReductionsRef.current = 0
      map.setMaxZoom(satelliteZoomCeilingRef.current)
      if (map.getZoom() > satelliteZoomCeilingRef.current) map.setZoom(satelliteZoomCeilingRef.current)
    }
  }

  if (!hasPolygon && !hasPoint) return null // handled by NoGpsPanel below
  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-slate-600">
      <div ref={containerRef} style={{ height: 280 }} />
      {status === 'ready' && (
        <button
          type="button"
          onClick={toggleMapType}
          className="absolute top-2 right-2 z-[1000] bg-white text-xs font-semibold text-gray-700 px-2.5 py-1.5 rounded-lg shadow-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          title={mapType === 'satellite' ? 'No imagery here? Switch to street map' : 'Switch to satellite'}
        >
          {mapType === 'satellite' ? 'Street view' : 'Satellite view'}
        </button>
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-slate-600 border-t-green-400 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Loading satellite map...</p>
          </div>
        </div>
      )}
      {status === 'timeout' && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center px-4">
          <div className="text-center">
            <Turtle size={32} className="text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-slate-300 text-sm font-semibold">Taking longer than usual</p>
            <p className="text-slate-500 text-xs mt-1 mb-3">This can happen on a slow connection</p>
            <button onClick={() => setRetryToken((k) => k + 1)} className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition">
              <RefreshCw size={12} strokeWidth={1.5} /> Retry
            </button>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center px-4">
          <div className="text-center">
            <AlertTriangle size={32} className="text-amber-400 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-slate-300 text-sm font-semibold">Couldn't load the map</p>
            <p className="text-slate-500 text-xs mt-1 mb-3">Check your connection and try again</p>
            <button onClick={() => setRetryToken((k) => k + 1)} className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition">
              <RefreshCw size={12} strokeWidth={1.5} /> Retry
            </button>
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [plot, setPlot] = useState<PlotData | null>(null)
  const [eudr, setEudr] = useState<EudrData | null>(null)
  const [sat, setSat] = useState<SatData | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadOk, setUploadOk] = useState(true)
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showMapper, setShowMapper] = useState(false)
  const [savingBoundary, setSavingBoundary] = useState(false)
  const [boundaryMsg, setBoundaryMsg] = useState('')
  const [boundaryOk, setBoundaryOk] = useState(true)

  async function handleBoundaryComplete(result: BoundaryResult) {
    setSavingBoundary(true)
    setBoundaryMsg('')
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (!session) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('coffee_plots')
        .update({
          gps_polygon: result.polygon,
          gps_latitude: result.centroid.lat,
          gps_longitude: result.centroid.lng,
          area_hectares: result.areaHa,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plotId)

      if (error) throw error

      // Record in audit trail. This is a secondary, best-effort write —
      // the boundary itself is already saved by the update() above, so a
      // failure here must not be reported as "failed to save the boundary"
      // (that was misleading: the polygon/GPS data had in fact saved, only
      // the audit log entry hadn't).
      try {
        const eventStore = new EventStore()
        await eventStore.recordEvent({
          id: crypto.randomUUID(),
          farm_id: plot?.farm_id || eudr?.farm_id || '',
          event_type: 'plot_boundary_recorded',
          actor_id: session.user.id,
          actor_type: 'farmer',
          created_at: new Date().toISOString(),
          event_data: {
            plot_id: plotId,
            point_count: result.pointCount,
            area_ha: result.areaHa,
            perimeter_m: result.perimeterM,
            centroid_lat: result.centroid.lat,
            centroid_lng: result.centroid.lng,
          }
        } as any)
      } catch (auditErr) {
        console.error('Boundary saved, but audit trail entry failed:', auditErr)
      }

      setBoundaryOk(true)
      setBoundaryMsg('Plot boundary saved!')
      setShowMapper(false)
      await loadData()
    } catch (err: any) {
      setBoundaryOk(false)
      setBoundaryMsg(`Failed to save: ${err.message}`)
    } finally {
      setSavingBoundary(false)
    }
  }

  useEffect(() => { if (plotId) loadData() }, [plotId])

  async function loadData() {
    try {
      const { data: { session }, error: _sessionError } = await supabase.auth.refreshSession()
      if (!session) { router.push('/auth/login'); return }

      const [plotRes, eudrRes, satRes, auditRes] = await Promise.all([
        supabase.from('coffee_plots').select('id,plot_name,area_hectares,gps_polygon,gps_latitude,gps_longitude,region_name,farm_id').eq('id', plotId).single(),
        supabase.from('coffee_eudr_compliance').select('*').eq('plot_id', plotId).maybeSingle(),
        supabase.from('coffee_satellite_indices').select('ndvi_mean,health_label,image_date').eq('plot_id', plotId).order('image_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('v_compliance_timeline').select('*').eq('plot_id', plotId).order('created_at', { ascending: false }).limit(10),
      ])

      // Same fix as app/dashboard/coffee/eudr-check/[plotId]/page.tsx (this
      // page duplicates that component almost verbatim — see the audit
      // note about consolidating the two). None of these four responses
      // had their `error` checked; a failed coffee_eudr_compliance fetch
      // would silently render this plot as "COMPLIANCE NOT CHECKED YET"
      // even if a real, verified record exists, risking a farmer
      // re-submitting and overwriting it.
      if (plotRes.error) throw new Error(`Could not load plot: ${plotRes.error.message}`)
      if (eudrRes.error) throw new Error(`Could not load EUDR compliance record: ${eudrRes.error.message}`)
      if (satRes.error) throw new Error(`Could not load satellite reading: ${satRes.error.message}`)
      if (auditRes.error) throw new Error(`Could not load compliance timeline: ${auditRes.error.message}`)

      setPlot(plotRes.data)
      setEudr(eudrRes.data)
      setSat(satRes.data)
      setAuditTrail(auditRes.data || [])
    } catch (e: any) {
      console.error(e)
      setLoadError(e?.message || 'Failed to load this plot\u2019s compliance data.')
    }
    finally { setLoading(false) }
  }

  async function handlePhotoEvidence(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg('')
    try {
      const { data: { session }, error: _sessionError } = await supabase.auth.refreshSession()
      if (!session) throw new Error('Not authenticated')

      const path = `eudr-evidence/${plotId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('farm-photos').upload(path, file)
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('farm-photos').getPublicUrl(path)

      // Update compliance record
      await supabase.from('coffee_eudr_compliance').upsert({
        plot_id: plotId,
        farm_id: plot?.farm_id || eudr?.farm_id || '',
        notes: (eudr?.notes ? eudr.notes + '\n' : '') + `Evidence: ${publicUrl}`,
        updated_at: new Date().toISOString(),
        assessment_date: eudr?.assessment_date || new Date().toISOString(),
      }, { onConflict: 'plot_id' })

      // Record event in audit trail
      const eventStore = new EventStore()
      await eventStore.recordEvent({
        id: crypto.randomUUID(),
        farm_id: plot?.farm_id || eudr?.farm_id || '',
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

      setUploadOk(true)
      setUploadMsg('Photo evidence uploaded and recorded in compliance audit trail!')
      loadData()
    } catch (err: any) {
      setUploadOk(false)
      setUploadMsg(`Upload failed: ${err.message}`)
    } finally { setUploading(false) }
  }

  async function handleRevalidate() {
    setValidating(true)
    try {
      const { data: { session }, error: _sessionError } = await supabase.auth.refreshSession()
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
        farm_id: plot?.farm_id || eudr?.farm_id || '',
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
      setUploadOk(false)
      setUploadMsg(`Revalidation failed: ${(e as Error).message}`)
    }
    finally { setValidating(false) }
  }

  function exportGeoJSON() {
    const geometry = extractGeometry(plot?.gps_polygon) ?? (
      plot?.gps_latitude != null && plot?.gps_longitude != null
        ? { type: 'Point', coordinates: [plot.gps_longitude, plot.gps_latitude] }
        : null
    )
    if (!plot || !geometry) return alert('No GPS data found for this plot.')
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
        geometry
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

  if (loadError || !plot) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
        <AlertTriangle size={36} className="text-amber-400 mx-auto mb-4" strokeWidth={1.5} />
        <h1 className="text-lg font-bold text-white mb-2">This plot's compliance data didn't load</h1>
        <p className="text-sm text-slate-400 mb-6">
          {loadError || "We couldn't find this plot."} Your records are safe — this is usually temporary. Please don't re-enter EUDR data until this loads correctly, in case a record already exists.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => { setLoading(true); setLoadError(null); loadData() }}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard/coffee/eudr-check')}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Back to fleet view
          </button>
        </div>
      </div>
    </div>
  )

  const risk = getRisk(eudr)
  const hasPolygon = !!plot?.gps_polygon
  const hasPoint = plot?.gps_latitude != null && plot?.gps_longitude != null
  // The re-map flow below was mounting PlotBoundaryMapper with no
  // initialCenter, so it always fell back to the component's own default —
  // a generic point in the middle of Kenya, not this plot. Zooming in from
  // there hits Esri's real "no imagery this close" ceiling for whatever
  // that arbitrary spot happens to be, showing a wall of placeholder tiles
  // that has nothing to do with the actual farm. We already have this
  // plot's own coordinates loaded on this page — use them. Point takes
  // priority over the polygon centroid since it's exactly what was saved,
  // rather than an average that can drift off-center for an irregular
  // plot shape; the polygon centroid is still a much better starting point
  // than the Kenya-wide default when only a polygon was saved.
  const remapPolygonLatLngs = hasPoint ? [] : extractPolygonLatLngs(plot?.gps_polygon)
  const remapInitialCenter: [number, number] | undefined = hasPoint
    ? [plot!.gps_latitude as number, plot!.gps_longitude as number]
    : remapPolygonLatLngs.length > 0
      ? [
          remapPolygonLatLngs.reduce((s, p) => s + p[0], 0) / remapPolygonLatLngs.length,
          remapPolygonLatLngs.reduce((s, p) => s + p[1], 0) / remapPolygonLatLngs.length,
        ]
      : undefined
  const isSmallPlot = (plot?.area_hectares ?? 999) <= 4
  const hasSufficientGps = hasPolygon || (hasPoint && isSmallPlot)
  const bannerConfig = {
    green:   { bg: 'bg-green-700',  Icon: CheckCircle2,  title: 'PLOT READY FOR EXPORT',        sub: 'No deforestation detected. All documents clear.' },
    yellow:  { bg: 'bg-amber-600',  Icon: AlertTriangle, title: 'ACTION REQUIRED',               sub: 'Verify boundary, upload land title, or review forest baseline.' },
    red:     { bg: 'bg-red-700',    Icon: XCircle,       title: 'POTENTIAL FOREST CONFLICT',     sub: 'Significant tree-cover loss detected after Jan 1, 2021.' },
    unknown: { bg: 'bg-slate-700',  Icon: HelpCircle,    title: 'COMPLIANCE NOT CHECKED YET',    sub: 'Run validation to assess this plot.' },
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
          <bannerConfig.Icon size={44} className="text-white flex-shrink-0" strokeWidth={1.5} />
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><MapPin size={13} strokeWidth={1.5} /> Plot Boundary Map</p>

          {/* Mapper active */}
          {showMapper && (
            <div className="rounded-xl overflow-hidden border-2 border-amber-500 bg-slate-800">
              <div className="px-4 py-3 bg-amber-900/40 border-b border-amber-600 flex items-center justify-between">
                <div>
                  <p className="text-amber-300 text-sm font-bold">Map plot boundary</p>
                  <p className="text-amber-400/80 text-xs mt-0.5">Walk the perimeter or tap corners on the satellite map, then tap Save.</p>
                </div>
                <button
                  onClick={() => setShowMapper(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded border border-slate-600"
                >
                  Cancel
                </button>
              </div>
              <div className="p-3">
                <PlotBoundaryMapper
                  onComplete={handleBoundaryComplete}
                  plotId={plotId}
                  initialCenter={remapInitialCenter}
                />
              </div>
              {savingBoundary && (
                <div className="px-4 py-3 bg-slate-700 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-300 text-sm">Saving boundary…</p>
                </div>
              )}
            </div>
          )}

          {/* No GPS yet — actionable empty state */}
          {!showMapper && !hasPolygon && !hasPoint && (
            <div className="h-auto bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 px-6 py-8 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center"><MapPin size={22} className="text-slate-400" strokeWidth={1.5} /></div>
              <div>
                <p className="text-white font-semibold text-sm">No GPS boundary recorded</p>
                <p className="text-slate-400 text-xs mt-1 max-w-xs">
                  A GPS boundary is required for EUDR compliance. Walk your plot perimeter with the app open, or tap corners on the satellite map.
                </p>
              </div>
              <button
                onClick={() => setShowMapper(true)}
                className="mt-1 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition"
              >
                <Map size={14} strokeWidth={1.5} /> Map this plot now
              </button>
              <p className="text-slate-600 text-xs">You can also do this from the plot edit page</p>
            </div>
          )}

          {/* Map shown when GPS data present */}
          {!showMapper && (hasPolygon || hasPoint) && (
            <PlotMap polygon={plot?.gps_polygon} lat={plot?.gps_latitude ?? null} lng={plot?.gps_longitude ?? null} risk={risk} />
          )}

          {boundaryMsg && (
            <p className={`text-xs mt-2 font-semibold flex items-center gap-1 ${boundaryOk ? 'text-green-400' : 'text-red-400'}`}>
              {boundaryOk ? <CheckCircle2 size={13} strokeWidth={1.5} /> : <XCircle size={13} strokeWidth={1.5} />} {boundaryMsg}
            </p>
          )}

          {(hasPolygon || hasPoint) && !showMapper && (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-slate-500">
                {hasPolygon ? (
                  <>Plot polygon displayed over current satellite imagery. {risk === 'red' && <span className="text-red-400 font-semibold">Red border = conflict zone detected.</span>}</>
                ) : (
                  'Point location displayed over current satellite imagery — sufficient for plots ≤4 ha.'
                )}
              </p>
              <button
                onClick={() => setShowMapper(true)}
                className="text-xs text-amber-400 hover:text-amber-300 underline whitespace-nowrap ml-3 flex-shrink-0"
              >
                {hasPolygon ? 'Re-map boundary' : 'Add polygon'}
              </button>
            </div>
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
              <TreePine size={22} className="text-white flex-shrink-0" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Forest Baseline — Dec 31, 2020</p>
            {eudr && eudr.forest_cover_pct !== null ? (
                  <p className={`text-sm mt-0.5 font-semibold flex items-center gap-1 ${eudr.risk_level === 'low' ? 'text-green-400' : 'text-red-400'}`}>
                    {eudr.risk_level === 'low'
                      ? <><CheckCircle2 size={13} strokeWidth={1.5} /> No forest detected. Forest cover: {eudr.forest_cover_pct}%</>
                      : <><XCircle size={13} strokeWidth={1.5} /> Forest detected. Risk: {eudr.risk_level?.toUpperCase()}. Cover: {eudr.forest_cover_pct}%</>}
                  </p>
                ) : (
                  <p className="text-amber-400 text-sm mt-0.5 font-semibold flex items-center gap-1"><HelpCircle size={13} strokeWidth={1.5} /> Not yet assessed — run validation below</p>
                )}
              </div>
            </div>

            {/* Card B: Land Title */}
            <div className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
              eudr?.notes ? 'bg-green-950 border-green-600' : 'bg-amber-950 border-amber-600'
            }`}>
              <FileText size={22} className="text-white flex-shrink-0" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Legality Check — Land Title</p>
                {eudr?.notes ? (
                  <p className="text-green-400 text-sm mt-0.5 font-semibold flex items-center gap-1"><CheckCircle2 size={13} strokeWidth={1.5} /> Land ownership document uploaded</p>
                ) : (
                  <div>
                    <p className="text-amber-400 text-sm mt-0.5 font-semibold flex items-center gap-1"><AlertTriangle size={13} strokeWidth={1.5} /> Land title document missing</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      <FileText size={12} strokeWidth={1.5} /> Upload Land Title Now
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Card C: GPS Accuracy */}
            <div className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
              hasSufficientGps ? 'bg-green-950 border-green-600' : hasPoint ? 'bg-amber-950 border-amber-600' : 'bg-red-950 border-red-600'
            }`}>
              <Satellite size={22} className="text-white flex-shrink-0" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="font-bold text-white text-sm">GPS Coordinates</p>
                {hasPolygon ? (
                  <p className="text-green-400 text-sm mt-0.5 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} strokeWidth={1.5} /> GPS recorded · Polygon boundary available
                  </p>
                ) : hasPoint ? (
                  <p className={`text-sm mt-0.5 font-semibold flex items-center gap-1 ${isSmallPlot ? 'text-green-400' : 'text-amber-400'}`}>
                    {isSmallPlot
                      ? <><CheckCircle2 size={13} strokeWidth={1.5} /> Point coordinate recorded · sufficient for this plot size</>
                      : <><AlertTriangle size={13} strokeWidth={1.5} /> Point coordinate only · polygon boundary required for this plot size</>}
                  </p>
                ) : (
                  <div>
                    <p className="text-red-400 text-sm mt-0.5 font-semibold flex items-center gap-1"><XCircle size={13} strokeWidth={1.5} /> No GPS data — plot boundary required for EUDR</p>
                    <button
                      onClick={() => { setShowMapper(true); document.getElementById('plot-map-section')?.scrollIntoView({ behavior: 'smooth' }) }}
                      className="mt-2 inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      <Map size={12} strokeWidth={1.5} /> Map boundary now
                    </button>
                  </div>
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
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Wrench size={13} strokeWidth={1.5} /> Resolution Steps</p>
            <div className="space-y-3">
              {!hasSufficientGps && (
                <div className="flex items-start gap-3 bg-slate-700 rounded-lg p-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">Record GPS Boundary</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {hasPoint
                        ? 'This plot is over 4 ha, so a full GPS polygon is required — walk the perimeter with the app open to capture it.'
                        : 'Walk the farm perimeter with the app open to capture precise GPS polygon points.'}
                    </p>
                    <button
                      onClick={() => { setShowMapper(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="mt-2 inline-flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      <Map size={12} strokeWidth={1.5} /> Open map now
                    </button>
                  </div>
                </div>
              )}
              {!eudr?.notes && (
                <div className="flex items-start gap-3 bg-slate-700 rounded-lg p-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                  <div>
                    <p className="text-white text-sm font-bold">Upload Land Title / Ownership Document</p>
                    <p className="text-slate-400 text-xs mt-0.5">Scan or photograph your land title deed and upload it using the button on Card B above.</p>
                  </div>
                </div>
              )}
              {risk === 'red' && (
                <div className="flex items-start gap-3 bg-red-900 rounded-lg p-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-700 text-white text-xs font-bold flex items-center justify-center">3</span>
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
          <div className={`rounded-xl p-3 text-sm font-semibold flex items-center gap-1.5 ${uploadOk ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {uploadOk ? <CheckCircle2 size={14} strokeWidth={1.5} /> : <XCircle size={14} strokeWidth={1.5} />} {uploadMsg}
          </div>
        )}

        {/* ── Compliance Audit Trail ── */}
        {auditTrail.length > 0 && (
          <div className="bg-slate-800 border-2 border-slate-600 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><ClipboardList size={13} strokeWidth={1.5} /> Compliance Audit Trail</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {auditTrail.map((event, idx) => {
                const EventIcon = event.event_type === 'photo_evidence_uploaded' ? Camera :
                       event.event_type === 'eudr_assessment_run' ? RefreshCw :
                       event.event_type === 'plot_boundary_recorded' ? MapPin : FileText
                return (
                <div key={idx} className="bg-slate-700 rounded-lg p-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 flex-shrink-0 mt-0.5">
                      <EventIcon size={14} strokeWidth={1.5} />
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
                )
              })}
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
              <><RefreshCw size={16} strokeWidth={1.5} /> Re-Validate Plot (Satellite)</>
            )}
          </button>

          <button
            onClick={exportGeoJSON}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-4 px-4 rounded-xl text-base transition flex items-center justify-center gap-2"
          >
            <Download size={16} strokeWidth={1.5} /> Export GeoJSON for Co-op / Buyer
          </button>
        </div>

        {/* Last checked */}
        {eudr?.assessment_date && (
          <p className="text-center text-slate-500 text-xs">
            Last compliance check: {new Date(eudr.assessment_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* ── FAB: Add Photo Evidence ──
          Hidden while the boundary mapper is open. This FAB is `fixed` to
          the viewport (not scoped to the scroll container), so it used to
          sit permanently on top of the mapper's own bottom controls
          (Tap Corners / Walk Boundary, and the finalize bar) regardless of
          scroll position — two independently-built floating layers with no
          shared awareness of each other. Evidence photos aren't relevant
          mid-mapping anyway; the FAB reappears once the mapper closes. */}
      {!showMapper && (
        <div className="fixed bottom-6 right-6 z-30">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoEvidence} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-16 h-16 bg-indigo-600 hover:bg-indigo-500 shadow-xl rounded-full flex items-center justify-center text-2xl transition active:scale-95 disabled:bg-slate-600"
            title="Add photo evidence"
          >
            {uploading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={20} strokeWidth={1.5} />}
          </button>
          <p className="text-center text-xs text-slate-400 mt-1 whitespace-nowrap">Evidence</p>
        </div>
      )}
    </div>
  )
}
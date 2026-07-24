'use client'

/**
 * PlotBoundaryMapper — framedInsight
 * ────────────────────────────────────────────────────────────────────────────
 * GPS Field Area Measure-level UX for Kenyan farmers mapping coffee plots.
 *
 * UX principles mirroring GPS Field Area Measure app:
 *  • Persistent crosshair / cursor target always visible while drawing
 *  • Floating action toolbar — Undo, Clear, Done — always on screen
 *  • Prominent tap-target corner markers (large, numbered, draggable)
 *  • Zoom buttons are large, custom, and NEVER intercepted by map events
 *  • Double-click zoom fully disabled — zoom only via buttons
 *  • Live acreage + hectares + perimeter banner updates after every point
 *  • "Close polygon" snap — when near point 1 it highlights to close
 *  • Walk mode with live breadcrumb trail + auto-stop option
 *  • Satellite + Street toggle
 *  • Re-center to GPS button
 *  • Undo removes last point AND its marker cleanly
 *  • Auto-outputs acreage on polygon close
 *
 * Stack: Leaflet (dynamic import, no SSR), React hooks, Tailwind, framed theme
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { EUDR_POLYGON_THRESHOLD_HA, roundToEudrPrecision, getEudrGeolocationFormat } from '@/lib/eudr-constants'
import { createOfflineTileLayer, prefetchTilesForPlot, boundsFromPoints, type PrefetchProgress } from '@/lib/offline-tile-layer'
import { getPlotTileStats, clearPlotTiles, type PlotTileStats } from '@/lib/tile-cache'
import { probeMaxAvailableZoom } from '@/lib/esri-tile-availability'

// ── Public contract ────────────────────────────────────────────────────────────

export interface BoundaryResult {
  polygon: any
  areaHa: number
  perimeterM: number
  centroid: { lat: number; lng: number }
  pointCount: number
  /**
   * EUDR Art. 9(1)(d): plots ≥ 4 ha legally require the polygon; plots
   * under 4 ha only require `centroid` as a single point. Both are always
   * included in this result regardless of format, since the polygon is
   * useful for the app's own UI even when not legally required — but
   * consumers preparing a compliance submission (AFA, cooperative export
   * documentation) should check this field to know which one to send.
   */
  eudrGeolocationFormat: 'point' | 'polygon'
}

interface Props {
  onComplete: (result: BoundaryResult) => void
  onLocationDetected?: (loc: { county?: string; ward?: string; subLocation?: string; display: string }) => void
  onClear?: () => void
  initialCenter?: [number, number]
  className?: string
  /**
   * Existing plot's ID. Only present when mapping/re-mapping a plot that
   * already exists in the database (edit flows, the "map this plot now"
   * read-only-page flow) — omitted for brand-new plots that haven't been
   * saved yet, since there's no durable ID to key an offline tile cache by.
   * When provided, this also enables the "Save this map for offline use"
   * action once a boundary is captured.
   */
  plotId?: string
}

type MapMode = 'idle' | 'drawing' | 'walking' | 'done'

interface LatLng { lat: number; lng: number }

// ── Geometry ───────────────────────────────────────────────────────────────────

function distM(a: LatLng, b: LatLng): number {
  const R = 6371000, r = (d: number) => d * Math.PI / 180
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function areaHa(pts: LatLng[]): number {
  if (pts.length < 3) return 0
  const R = 6371000, r = (d: number) => d * Math.PI / 180
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    const xi = r(pts[i].lng) * Math.cos(r(pts[i].lat)), yi = r(pts[i].lat)
    const xj = r(pts[j].lng) * Math.cos(r(pts[j].lat)), yj = r(pts[j].lat)
    area += xi * yj - xj * yi
  }
  return Math.abs(area / 2) * R * R / 10_000
}

function perimM(pts: LatLng[]): number {
  if (pts.length < 2) return 0
  let t = 0
  for (let i = 0; i < pts.length; i++) t += distM(pts[i], pts[(i + 1) % pts.length])
  return t
}

function centroid(pts: LatLng[]): LatLng {
  return {
    lat: roundToEudrPrecision(pts.reduce((s, p) => s + p.lat, 0) / pts.length),
    lng: roundToEudrPrecision(pts.reduce((s, p) => s + p.lng, 0) / pts.length),
  }
}

function toGeoJSON(pts: LatLng[]): any {
  // EUDR requires ≥ 6 decimal places of precision on every coordinate —
  // round here so the stored GeoJSON is compliant-precision by construction,
  // not just whatever floating-point noise the GPS/Leaflet click produced.
  const rounded = pts.map(p => [roundToEudrPrecision(p.lng), roundToEudrPrecision(p.lat)])
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...rounded, rounded[0]]] }, properties: {} }
}

function fmtDist(m: number) { return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m` }

// ── GPS fix sanity-checking ──────────────────────────────────────────────────
// framedInsight only maps plots in Kenya. A generous bounding box (not the
// precise national border — just "obviously not Kenya" vs "plausibly Kenya")
// catches the specific failure mode that produces a solid-white map: the
// browser's Geolocation API falling back to IP-based positioning (common on
// laptops/desktops with no GPS radio, VPNs, or emulators/test devices) and
// returning a low-accuracy fix hundreds of kilometres away — sometimes over
// open ocean or a data-centre location with zero Esri World Imagery coverage
// at the zoom levels this app requests. Esri doesn't error on those tiles;
// it returns a valid, blank-white PNG, so nothing here would ever call it a
// "failure" without this check — the map just silently renders white.
const KENYA_BOUNDS = { south: -4.9, north: 5.5, west: 33.5, east: 42.0 }

function isWithinKenya(lat: number, lng: number): boolean {
  return lat >= KENYA_BOUNDS.south && lat <= KENYA_BOUNDS.north &&
         lng >= KENYA_BOUNDS.west && lng <= KENYA_BOUNDS.east
}

// A real on-device GPS fix is typically accurate to single-digit-to-low-
// double-digit metres; IP/network-based positioning is usually 100s of
// metres to a few kilometres. Forcing the map to zoom 18 regardless of
// which kind of fix we got means a bad fix doesn't just mis-centre the
// map, it does so at a zoom level where — even if the coordinates happen
// to land somewhere with imagery — the plot itself won't be anywhere near
// the crosshair. Scale the auto-zoom to how much we actually trust the fix.
function zoomForAccuracy(accuracyM: number): number {
  if (accuracyM <= 20) return 18   // real GPS fix — safe to zoom in tight
  if (accuracyM <= 60) return 17
  if (accuracyM <= 150) return 16
  if (accuracyM <= 500) return 14  // likely wifi/network positioning
  return 12                        // likely coarse IP geolocation
}

// ── Marker icon factories (called after L is loaded) ──────────────────────────

function makeCornerIcon(L: any, index: number, isFirst: boolean, isSnapping: boolean) {
  const bg = isSnapping ? '#f59e0b' : isFirst ? '#16a34a' : '#0ea5e9'
  const border = isSnapping ? '#fbbf24' : isFirst ? '#4ade80' : '#38bdf8'
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${bg};border:3px solid ${border};
      color:#fff;font-size:11px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.45);
      cursor:pointer;user-select:none;
      ${isSnapping ? 'transform:scale(1.25);' : ''}
      transition:transform 0.15s;
    ">${index + 1}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function makeLiveGpsIcon(L: any) {
  return L.divIcon({
    html: `<div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,0.25);animation:gpsPulse 1.4s ease-in-out infinite;"></div>
      <div style="position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
      <style>@keyframes gpsPulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.8);opacity:0}}</style>
    </div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

// ── Crosshair overlay (pure CSS, always on top) ───────────────────────────────
// We render this as a React element OVER the map div — not inside Leaflet.

function Crosshair({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, zIndex: 900,
        pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* outer ring */}
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ position: 'absolute', inset: 0 }}>
          {/* horizontal lines */}
          <line x1="0" y1="24" x2="16" y2="24" stroke="white" strokeWidth="2" strokeOpacity="0.9" />
          <line x1="32" y1="24" x2="48" y2="24" stroke="white" strokeWidth="2" strokeOpacity="0.9" />
          {/* vertical lines */}
          <line x1="24" y1="0" x2="24" y2="16" stroke="white" strokeWidth="2" strokeOpacity="0.9" />
          <line x1="24" y1="32" x2="24" y2="48" stroke="white" strokeWidth="2" strokeOpacity="0.9" />
          {/* center dot */}
          <circle cx="24" cy="24" r="3" fill="#16a34a" stroke="white" strokeWidth="1.5" />
          {/* outer ring */}
          <circle cx="24" cy="24" r="10" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" fill="none" />
        </svg>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PlotBoundaryMapper({
  onComplete, onLocationDetected, onClear,
  initialCenter = [-0.7, 37.0],
  className = '',
  plotId,
}: Props) {

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const polygonLayerRef = useRef<any>(null)      // filled polygon / polyline
  const cornerMarkersRef = useRef<any[]>([])     // numbered pin layers
  const liveMarkerRef = useRef<any>(null)        // pulsing GPS dot
  const walkPolylineRef = useRef<any>(null)      // blue trail in walk mode
  const watchIdRef = useRef<number | null>(null)
  const mapClickHandlerRef = useRef<any>(null)
  const slowTileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [mode, setMode] = useState<MapMode>('idle')
  const [points, setPoints] = useState<LatLng[]>([])
  const pointsRef = useRef<LatLng[]>([])
  const modeRef = useRef<MapMode>('idle')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [locating, setLocating] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  // Walk mode records a vertex per GPS fix, so weak accuracy doesn't just
  // look bad on a badge — it directly corrupts the polygon (a plot walked at
  // ±100m can come out wildly mis-shaped, or wrong enough to fail an EUDR
  // geolocation check). We ask for confirmation instead of blocking outright,
  // since some farmers may only ever get 20-30m fixes under tree canopy and
  // still need a way forward.
  const WEAK_GPS_THRESHOLD_M = 30
  const [walkGpsWarning, setWalkGpsWarning] = useState(false)
  const [zoom, setZoom] = useState(17)
  const [snapActive, setSnapActive] = useState(false) // near first point?
  const [result, setResult] = useState<BoundaryResult | null>(null)
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')
  const [tilesRendered, setTilesRendered] = useState(false)
  const tilesRenderedRef = useRef(false)
  // Distinct from `!tilesRendered` — this only flips true once the 8s grace
  // period has passed with nothing on screen, so we can stop saying "loading"
  // (which implies it'll finish any second) and instead give the farmer a
  // real choice, since on throttled rural data the tiles may just hang
  // indefinitely without ever firing `tileerror`.
  const [tilesStalled, setTilesStalled] = useState(false)
  const esriLayerRef = useRef<any>(null)
  const osmLayerRef = useRef<any>(null)
  const labelsLayerRef = useRef<any>(null)

  // ── Real imagery zoom ceiling (fixes "map data not yet available") ───────
  // Esri's real high-resolution coverage varies a lot by location — see
  // lib/esri-tile-availability.ts for the full explanation. Past the true
  // ceiling for wherever the farmer is mapping, Esri returns a valid-but-
  // blank placeholder tile instead of erroring, so we have to *discover*
  // and enforce the real ceiling ourselves rather than reacting to a
  // failure that never technically fires. `ESRI_NOMINAL_MAX_ZOOM` is the
  // upper bound we'd otherwise request (matches maxNativeZoom below);
  // `satelliteZoomCeilingRef` holds whatever the probe actually found for
  // the current location, and is what we clamp the map to while satellite
  // is the active layer.
  const ESRI_NOMINAL_MAX_ZOOM = 19
  const satelliteZoomCeilingRef = useRef<number>(ESRI_NOMINAL_MAX_ZOOM)
  const [atImageryCeiling, setAtImageryCeiling] = useState(false)

  // ── Offline tile cache (only meaningful when plotId is set — see Props) ───
  const [tileStats, setTileStats] = useState<PlotTileStats | null>(null)
  const [savingOffline, setSavingOffline] = useState(false)
  const [offlineProgress, setOfflineProgress] = useState<PrefetchProgress | null>(null)
  const [offlineSaveError, setOfflineSaveError] = useState<string | null>(null)
  const [clearingOffline, setClearingOffline] = useState(false)

  // Derived
  const ha = areaHa(points)
  const acres = ha * 2.47105
  const perim = perimM(points)
  const isDrawing = mode === 'drawing'
  const isWalking = mode === 'walking'
  const isDone = mode === 'done'
  const isIdle = mode === 'idle'
  const hasPoints = points.length > 0
  const hasPolygon = points.length >= 3

  useEffect(() => { pointsRef.current = points }, [points])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { tilesRenderedRef.current = tilesRendered }, [tilesRendered])

  useEffect(() => {
    if (!plotId) return
    let cancelled = false
    getPlotTileStats(plotId).then(stats => { if (!cancelled) setTileStats(stats.tileCount > 0 ? stats : null) })
    return () => { cancelled = true }
  }, [plotId])

  // ── Init Leaflet ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return

    const init = async () => {
      try {
        if (!mapContainerRef.current) return
        const L = (await import('leaflet')).default
        leafletRef.current = L

        // Fix broken webpack asset paths for default markers
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 17,
          zoomControl: false,        // we render our own zoom buttons in React
          doubleClickZoom: false,    // disabled permanently — users use our buttons
          scrollWheelZoom: true,
          touchZoom: true,
          attributionControl: false, // we add a minimal one
          fadeAnimation: false,      // avoids a brief flash of Leaflet's default
                                      // pane background showing through during
                                      // the opacity fade-in of the first tiles
        })

        // Leaflet's default `.leaflet-container` background is a light gray
        // (#ddd) meant for a white page chrome. Dropped into our dark theme —
        // and combined with a tile that's still loading, or one that failed —
        // that light gray reads as "broken", not "loading". Match the dark
        // wrapper behind the map so the map area looks intentional at every
        // stage, not just once tiles are in.
        map.getContainer().style.background = '#0f172a'

        // Satellite tiles — routed through the offline-aware tile layer so a
        // plot that's been viewed once with signal renders from cache when
        // offline later. `tileCacheMeta` is null for brand-new, unsaved plots
        // (no plotId yet), in which case this behaves like a plain L.tileLayer.
        const tileCacheMeta = plotId ? { plotId } : null
        const esriSat = createOfflineTileLayer(
          L,
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19 },
          tileCacheMeta && { ...tileCacheMeta, provider: 'esri-satellite' }
        )
        const esriLabels = createOfflineTileLayer(
          L,
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19, opacity: 0.8 },
          tileCacheMeta && { ...tileCacheMeta, provider: 'esri-labels' }
        )
        const osm = createOfflineTileLayer(
          L,
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { maxZoom: 19 },
          tileCacheMeta && { ...tileCacheMeta, provider: 'osm' }
        )

        esriSat.addTo(map)
        esriLabels.addTo(map)
        esriLayerRef.current = esriSat
        osmLayerRef.current = osm
        labelsLayerRef.current = esriLabels

        // Auto-fallback to OSM if satellite tiles keep failing (rural connectivity).
        //
        // The previous version of this only counted esriSat's own errors and
        // waited for "more than 5" of them before switching — a threshold
        // tuned for a large viewport requesting dozens of tiles. On a small
        // or just-opened map (a phone in portrait, a freshly mounted
        // component) the whole visible area can be 4-6 tiles total across
        // BOTH the satellite and labels layers, so that fixed threshold
        // could never actually fire: every visible tile would fail and the
        // farmer would still be looking at a gray box with nothing on it,
        // because "more than 5" never arrived. Track errors against how
        // many tiles we've actually asked for, across both Esri layers, and
        // fall back once a clear majority of everything requested has
        // failed — not after an absolute count that assumes a big viewport.
        let satRequested = 0
        let satErrors = 0
        let fellBack = false
        const countSatRequest = () => { satRequested += 1 }
        const fallBackToOsm = () => {
          if (fellBack || !map.hasLayer(esriSat)) return
          fellBack = true
          esriSat.remove(); esriLabels.remove(); osm.addTo(map); setMapType('street')
          // New provider, new load cycle — give it its own honest "still
          // loading" window instead of inheriting whatever was left of the
          // satellite attempt's timer.
          retryTiles()
        }
        const onSatError = () => {
          satErrors += 1
          const enoughAbsolute = satErrors >= 5
          const enoughRelative = satErrors >= 3 && satErrors >= Math.ceil(satRequested * 0.6)
          if (enoughAbsolute || enoughRelative) fallBackToOsm()
        }
        esriSat.on('tileloadstart', countSatRequest)
        esriLabels.on('tileloadstart', countSatRequest)
        esriSat.on('tileerror', onSatError)
        esriLabels.on('tileerror', onSatError)
        esriSat.on('tileload', () => { setTilesRendered(true); setTilesStalled(false); if (slowTileTimerRef.current) clearTimeout(slowTileTimerRef.current) })
        osm.on('tileload', () => { setTilesRendered(true); setTilesStalled(false) })
        // A throttled-but-working connection never fires tileerror — tiles just
        // sit pending, request after request, with no failure to react to —
        // so a farmer on weak rural data sees a plain gray map with a banner
        // that says "loading" forever. We don't auto-switch away from
        // satellite here (that decision belongs to the farmer, since OSM's
        // street map is often useless for spotting a plot's actual tree
        // rows), we just stop pretending it's about to finish and surface
        // real choices once 8s pass with nothing rendered.
        slowTileTimerRef.current = setTimeout(() => { if (!tilesRenderedRef.current) setTilesStalled(true) }, 8000)
        // Failures are a stronger signal than silence: if we're already
        // seeing errors pile up fast (both providers unreachable, not just
        // slow), don't make the farmer wait out the full 8s of a "loading"
        // badge that's quietly lying to them — surface the actionable
        // stalled banner as soon as that's clearly where this is headed.
        osm.on('tileerror', () => {
          if (tilesRenderedRef.current) return
          satErrors += 1
          if (satErrors >= 6 && slowTileTimerRef.current) {
            clearTimeout(slowTileTimerRef.current)
            setTilesStalled(true)
          }
        })

        // Sync zoom state to React for our custom buttons. Checks the map's
        // actual active layer (not the `mapType` React variable) since this
        // listener is attached once at mount and would otherwise close over
        // a stale value once the farmer toggles satellite/street.
        map.on('zoom', () => {
          const z = map.getZoom()
          setZoom(z)
          const onSatellite = !!esriLayerRef.current && map.hasLayer(esriLayerRef.current)
          setAtImageryCeiling(onSatellite && z >= satelliteZoomCeilingRef.current)
        })

        mapRef.current = map
        setMapLoaded(true)

        // Probe imagery availability for the default center right away —
        // this is a coarse first pass (initialCenter is just Kenya's rough
        // midpoint, not the farmer's actual plot) so the map is never left
        // uncapped, but gets replaced by a precise probe the moment we have
        // a real location (autoLocate below, or a manual "locate me" tap).
        applyZoomCeiling(initialCenter[0], initialCenter[1])
        autoLocate(map, L, { silent: true })
      } catch (e) {
        console.error('Map init error:', e)
        setGpsError('Failed to load map — please refresh')
      }
    }

    init()
    return () => {
      if (slowTileTimerRef.current) { clearTimeout(slowTileTimerRef.current); slowTileTimerRef.current = null }
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
      if (mapRef.current) { try { mapRef.current.remove() } catch {} ; mapRef.current = null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep Leaflet's internal size in sync with its container ───────────────
  // Leaflet reads its container's actual pixel size once, at L.map() time,
  // and computes which tiles to request from that. Every mount of this
  // component happens inside something conditional — a wizard step
  // (`step === 'map'`), a toggled section (`showMapper &&`), or the
  // next/dynamic loading-placeholder swap — so the container isn't
  // guaranteed to have its final layout size in the same tick the map is
  // constructed (a parent flex/grid reflow, a webfont swap, or the
  // dynamic-import chunk finishing a beat later can all resize it after the
  // fact). Leaflet never notices that on its own; the fix is to tell it
  // explicitly via `invalidateSize()`, which recomputes the tile grid for
  // whatever size the container actually is right now. We do this on
  // mount (next frame + a short delayed follow-up, to catch layout that
  // settles a moment after paint) and on every subsequent resize via
  // ResizeObserver, which also covers rotating a phone or resizing a
  // desktop window mid-session.
  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current
    const container = mapContainerRef.current
    if (!map || !container) return

    const invalidate = () => { try { map.invalidateSize() } catch {} }

    invalidate()
    const raf = requestAnimationFrame(invalidate)
    const settleTimer = setTimeout(invalidate, 300)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => invalidate())
      observer.observe(container)
    }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settleTimer)
      observer?.disconnect()
    }
  }, [mapLoaded])

  // ── Toggle map type ─────────────────────────────────────────────────────────

  function toggleMapType() {
    const map = mapRef.current; const L = leafletRef.current
    if (!map || !L) return
    if (mapType === 'satellite') {
      if (esriLayerRef.current) map.removeLayer(esriLayerRef.current)
      if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current)
      if (osmLayerRef.current) osmLayerRef.current.addTo(map)
      setMapType('street')
      // OSM's coverage is effectively uniform worldwide at the zooms this
      // app uses, unlike Esri's — lift the satellite-specific cap while
      // street view is active so switching to street is also the "escape
      // hatch" for zoom, not just for missing imagery.
      map.setMaxZoom(ESRI_NOMINAL_MAX_ZOOM)
      setAtImageryCeiling(false)
    } else {
      if (osmLayerRef.current) map.removeLayer(osmLayerRef.current)
      if (esriLayerRef.current) esriLayerRef.current.addTo(map)
      if (labelsLayerRef.current) labelsLayerRef.current.addTo(map)
      setMapType('satellite')
      // Re-apply whatever ceiling we last discovered for this location.
      map.setMaxZoom(satelliteZoomCeilingRef.current)
      if (map.getZoom() > satelliteZoomCeilingRef.current) map.setZoom(satelliteZoomCeilingRef.current)
      setAtImageryCeiling(map.getZoom() >= satelliteZoomCeilingRef.current)
    }
  }

  // ── Discover & enforce the real Esri imagery zoom ceiling ──────────────────
  // See lib/esri-tile-availability.ts for why this exists: Esri's own tile
  // endpoint returns a valid-looking "Map data not yet available" tile
  // rather than an error once you're past a location's real resolution, so
  // we have to find that ceiling proactively and clamp to it — reacting
  // after the fact isn't possible because nothing ever technically fails.
  async function applyZoomCeiling(lat: number, lng: number) {
    const map = mapRef.current
    if (!map) return
    const ceiling = await probeMaxAvailableZoom(lat, lng)
    // The map (or the farmer) may have moved on to a different mode/type
    // while the probe was in flight — only apply if still relevant. We
    // check the map's actual active layer here rather than the `mapType`
    // React variable: this function is called from autoLocate's memoized
    // callback, which can hold a stale closure over `mapType` from an
    // earlier render if the farmer toggled satellite/street in between —
    // asking Leaflet what's actually on the map right now is always correct.
    if (!mapRef.current) return
    satelliteZoomCeilingRef.current = ceiling
    const esri = esriLayerRef.current
    if (!esri || !map.hasLayer(esri)) return // street active — has its own, higher cap; see toggleMapType
    map.setMaxZoom(ceiling)
    // If the farmer had already zoomed in past the newly-discovered ceiling
    // (e.g. tapped + rapidly before the probe resolved), pull the view back
    // to the sharpest level we've confirmed actually has imagery, rather
    // than leaving them stranded on a blank tile.
    if (map.getZoom() > ceiling) map.setZoom(ceiling)
    setAtImageryCeiling(map.getZoom() >= ceiling)
  }

  // ── Retry tile loading (after a stall) ─────────────────────────────────────

  function retryTiles() {
    const map = mapRef.current
    if (!map) return
    setTilesStalled(false)
    if (slowTileTimerRef.current) clearTimeout(slowTileTimerRef.current)
    // Nudge Leaflet to re-request the currently-visible tiles rather than
    // waiting on whatever half-finished requests are still in flight.
    if (esriLayerRef.current && map.hasLayer(esriLayerRef.current)) esriLayerRef.current.redraw()
    if (osmLayerRef.current && map.hasLayer(osmLayerRef.current)) osmLayerRef.current.redraw()
    slowTileTimerRef.current = setTimeout(() => { if (!tilesRenderedRef.current) setTilesStalled(true) }, 8000)
  }

  // ── Zoom buttons ────────────────────────────────────────────────────────────
  // Custom React buttons — no Leaflet zoom control needed. We use
  // L.DomEvent.stopPropagation to ensure button clicks don't fall through to map.

  function zoomIn() { mapRef.current?.zoomIn() }
  function zoomOut() { mapRef.current?.zoomOut() }

  // ── GPS locate ──────────────────────────────────────────────────────────────

  const autoLocate = useCallback((map?: any, L?: any, opts?: { silent?: boolean }) => {
    const _map = map ?? mapRef.current
    if (!_map) return
    if (!navigator.geolocation) { setGpsError('GPS not available on this device'); return }
    setLocating(true); setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setGpsAccuracy(Math.round(accuracy))
        // The one-shot GPS fix on map mount can take several seconds on slow
        // rural connections. If this is that silent, automatic call and the
        // farmer has already started tapping corners (or switched to walk
        // mode) while waiting for it, recentring now would yank the whole
        // map — and every pin already placed — out from under them. A
        // user-initiated tap of the "locate me" button always recenters.
        const userAlreadyMapping = opts?.silent && (pointsRef.current.length > 0 || modeRef.current !== 'idle')
        // A fix outside Kenya entirely is a strong signal this is IP-based
        // positioning rather than real GPS (see isWithinKenya's comment) —
        // recentring the map there would show a plot the farmer never asked
        // for, at best, or a blank tile with no imagery at worst. Leave the
        // map on initialCenter instead of trusting a fix like that; still
        // record the accuracy badge so the farmer can see GPS is unreliable
        // right now, and manual corner-tapping / walking are unaffected.
        const trustworthy = isWithinKenya(lat, lng)
        if (!userAlreadyMapping && trustworthy) {
          _map.setView([lat, lng], zoomForAccuracy(accuracy))
          // Re-probe now that we have the farmer's actual location, not
          // just Kenya's rough midpoint — the initial mount-time probe was
          // only ever a safe placeholder until this real fix arrived.
          applyZoomCeiling(lat, lng)
        } else if (!userAlreadyMapping && !trustworthy && !opts?.silent) {
          // Only surface this as an error for an explicit "locate me" tap —
          // the silent auto-locate on mount should fail quietly and just
          // leave the farmer on the default view.
          setGpsError('GPS fix looks unreliable right now (outside Kenya) — map position unchanged')
        }
        setLocating(false)
        // Reverse geocode
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(r => r.json()).then(d => {
            const a = d.address || {}
            const display = [a.county || a.state, a.village || a.suburb, a.hamlet].filter(Boolean).join(', ')
            if (display) onLocationDetected?.({ county: a.county, ward: a.village || a.suburb, subLocation: a.hamlet, display })
          }).catch(() => {})
      },
      (err) => {
        setGpsError(err.code === 1 ? 'Location permission denied — enable in browser settings'
          : err.code === 2 ? 'GPS signal weak — move to open area'
          : 'GPS timed out — try again')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [onLocationDetected])

  // ── Render polygon / polyline on map ────────────────────────────────────────

  const renderPolyLayer = useCallback((pts: LatLng[]) => {
    const map = mapRef.current; const L = leafletRef.current
    if (!map || !L) return
    if (polygonLayerRef.current) { map.removeLayer(polygonLayerRef.current); polygonLayerRef.current = null }
    if (pts.length < 2) return
    if (pts.length >= 3) {
      polygonLayerRef.current = L.polygon(pts.map(p => [p.lat, p.lng]), {
        color: '#16a34a', weight: 2.5, opacity: 1,
        fillColor: '#22c55e', fillOpacity: 0.2,
      }).addTo(map)
    } else {
      polygonLayerRef.current = L.polyline(pts.map(p => [p.lat, p.lng]), {
        color: '#16a34a', weight: 2.5, dashArray: '6 4',
      }).addTo(map)
    }
  }, [])

  // ── Add corner marker ───────────────────────────────────────────────────────

  const addCornerMarker = useCallback((pt: LatLng, index: number, isFirst: boolean) => {
    const L = leafletRef.current; const map = mapRef.current
    if (!L || !map) return null
    const marker = L.marker([pt.lat, pt.lng], {
      icon: makeCornerIcon(L, index, isFirst, false),
      draggable: true,
      zIndexOffset: 500,
    }).addTo(map)
    // Drag to reposition
    marker.on('dragend', (ev: any) => {
      const ll = ev.target.getLatLng()
      setPoints(curr => {
        const copy = [...curr]; copy[index] = { lat: ll.lat, lng: ll.lng }
        renderPolyLayer(copy); return copy
      })
    })
    return marker
  }, [renderPolyLayer])

  // ── Map click handler for draw mode ────────────────────────────────────────

  const handleMapClick = useCallback((e: any) => {
    const pt: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng }

    setPoints(prev => {
      // Check snap-to-close: if >=3 pts and within 20px of first point, close polygon
      const map = mapRef.current; const L = leafletRef.current
      if (prev.length >= 3 && map && L) {
        const firstPx = map.latLngToContainerPoint([prev[0].lat, prev[0].lng])
        const clickPx = map.latLngToContainerPoint([pt.lat, pt.lng])
        const dist = Math.sqrt((firstPx.x - clickPx.x) ** 2 + (firstPx.y - clickPx.y) ** 2)
        if (dist < 28) {
          // Close the polygon
          finalizePoints(prev)
          return prev
        }
      }

      const updated = [...prev, pt]
      const isFirst = prev.length === 0
      const m = addCornerMarker(pt, prev.length, isFirst)
      if (m) cornerMarkersRef.current.push(m)
      renderPolyLayer(updated)
      return updated
    })
  }, [addCornerMarker, renderPolyLayer])

  // Keep the ref in sync so we can remove the event listener
  useEffect(() => { mapClickHandlerRef.current = handleMapClick }, [handleMapClick])

  // ── Check snap proximity on mouse/touch move ────────────────────────────────

  useEffect(() => {
    const map = mapRef.current; const L = leafletRef.current
    if (!map || !L || !isDrawing) { setSnapActive(false); return }

    const onMove = (e: any) => {
      if (points.length < 3) { setSnapActive(false); return }
      const firstPx = map.latLngToContainerPoint([points[0].lat, points[0].lng])
      const movePx = map.latLngToContainerPoint(e.latlng)
      const d = Math.sqrt((firstPx.x - movePx.x) ** 2 + (firstPx.y - movePx.y) ** 2)
      const snapping = d < 28
      setSnapActive(snapping)

      // Update first marker icon to show snap state
      if (cornerMarkersRef.current[0]) {
        const L2 = leafletRef.current
        if (L2) cornerMarkersRef.current[0].setIcon(makeCornerIcon(L2, 0, true, snapping))
      }
    }

    map.on('mousemove', onMove)
    map.on('touchmove', onMove)
    return () => { map.off('mousemove', onMove); map.off('touchmove', onMove) }
  }, [isDrawing, points]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Finalize ────────────────────────────────────────────────────────────────

  const finalizePoints = useCallback((pts: LatLng[]) => {
    const map = mapRef.current; const L = leafletRef.current
    if (!map || !L) return
    // Remove click handler
    map.off('click', mapClickHandlerRef.current)
    map.getContainer().style.cursor = ''
    // Stop any walk
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (walkPolylineRef.current) { map.removeLayer(walkPolylineRef.current); walkPolylineRef.current = null }
    if (liveMarkerRef.current) { map.removeLayer(liveMarkerRef.current); liveMarkerRef.current = null }

    setMode('done')
    setSnapActive(false)

    const computedAreaHa = areaHa(pts)
    const r: BoundaryResult = {
      polygon: toGeoJSON(pts), areaHa: computedAreaHa,
      perimeterM: perimM(pts), centroid: centroid(pts), pointCount: pts.length,
      eudrGeolocationFormat: getEudrGeolocationFormat(computedAreaHa),
    }
    setResult(r)
    onComplete(r)

    // Fit to polygon
    if (pts.length >= 3) {
      const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [onComplete])

  // ── Start draw mode ─────────────────────────────────────────────────────────

  function startDraw() {
    clearAll()
    setMode('drawing')
    setGpsError(null)
    const map = mapRef.current; const L = leafletRef.current
    if (!map || !L) return
    map.getContainer().style.cursor = 'crosshair'
    map.on('click', mapClickHandlerRef.current)
  }

  // ── Start walk mode ─────────────────────────────────────────────────────────

  // Gate for the "Walk Boundary" button: if we don't have a GPS fix yet, or
  // the last known fix is too coarse to trust for tracing an edge, ask
  // before committing the farmer to a walk that may produce a useless shape.
  function handleWalkClick() {
    if (gpsAccuracy === null || gpsAccuracy > WEAK_GPS_THRESHOLD_M) {
      setWalkGpsWarning(true)
      return
    }
    startWalk()
  }

  function startWalk() {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return }
    setWalkGpsWarning(false)
    clearAll()
    setMode('walking')
    setGpsError(null)
    const map = mapRef.current; const L = leafletRef.current
    if (!map || !L) return

    walkPolylineRef.current = L.polyline([], { color: '#2563eb', weight: 3 }).addTo(map)
    let lastPt: LatLng | null = null

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setGpsAccuracy(Math.round(accuracy))
        if (lastPt && distM(lastPt, { lat, lng }) < 1.5) return // filter GPS noise
        const pt = { lat, lng }; lastPt = pt

        // Live GPS dot
        if (liveMarkerRef.current) { liveMarkerRef.current.setLatLng([lat, lng]) }
        else { liveMarkerRef.current = L.marker([lat, lng], { icon: makeLiveGpsIcon(L), zIndexOffset: 1000 }).addTo(map) }

        map.panTo([lat, lng], { animate: true, duration: 0.5 })
        walkPolylineRef.current?.addLatLng([lat, lng])
        setPoints(prev => { const updated = [...prev, pt]; renderPolyLayer(updated); return updated })
      },
      (err) => setGpsError(`GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
    watchIdRef.current = id
  }

  function stopWalk() {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    setPoints(prev => {
      if (prev.length < 3) { setGpsError('Not enough points — need at least 3. Walk a larger area.'); setMode('idle'); return prev }
      finalizePoints(prev); return prev
    })
  }

  // ── Undo last point ─────────────────────────────────────────────────────────

  function undoLast() {
    const map = mapRef.current
    if (!map) return
    // Remove last corner marker
    const last = cornerMarkersRef.current.pop()
    if (last) map.removeLayer(last)
    setPoints(prev => {
      const updated = prev.slice(0, -1)
      renderPolyLayer(updated)
      return updated
    })
    setSnapActive(false)
  }

  // ── Clear all ───────────────────────────────────────────────────────────────

  function clearAll() {
    const map = mapRef.current
    if (!map) return
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (mapClickHandlerRef.current) map.off('click', mapClickHandlerRef.current)
    if (polygonLayerRef.current) { map.removeLayer(polygonLayerRef.current); polygonLayerRef.current = null }
    if (walkPolylineRef.current) { map.removeLayer(walkPolylineRef.current); walkPolylineRef.current = null }
    if (liveMarkerRef.current) { map.removeLayer(liveMarkerRef.current); liveMarkerRef.current = null }
    cornerMarkersRef.current.forEach(m => { try { map.removeLayer(m) } catch {} })
    cornerMarkersRef.current = []
    map.getContainer().style.cursor = ''
    setPoints([]); setResult(null); setMode('idle'); setGpsError(null); setSnapActive(false)
    onClear?.()
  }

  // ── Finalize draw (Done button) ─────────────────────────────────────────────

  function finalizeDraw() {
    if (points.length < 3) { setGpsError('Place at least 3 corners to form a plot boundary.'); return }
    finalizePoints(points)
  }

  // ── Save map for offline use ────────────────────────────────────────────────
  // Only reachable when plotId is set and a boundary/point exists — walks the
  // tile grid for the plot's bounding box (+ buffer) at the zoom levels this
  // mapper actually renders (native satellite detail tops out at z19; z20 is
  // just Leaflet upsampling those same tiles, so there's nothing real to fetch
  // there) and populates the cache, so the plot's imagery survives offline.

  async function saveOfflineMap() {
    if (!plotId || points.length === 0 || savingOffline) return
    const bounds = boundsFromPoints(points)
    if (!bounds) return

    setSavingOffline(true)
    setOfflineSaveError(null)
    setOfflineProgress({ done: 0, total: 0 })

    try {
      const layers = mapType === 'satellite'
        ? [
            { urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', provider: 'esri-satellite' },
            { urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', provider: 'esri-labels' },
          ]
        : [
            { urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', provider: 'osm', subdomains: ['a', 'b', 'c'] },
          ]

      await prefetchTilesForPlot(
        plotId,
        bounds,
        [16, 17, 18, 19],
        layers,
        (p) => setOfflineProgress(p)
      )

      const stats = await getPlotTileStats(plotId)
      setTileStats(stats.tileCount > 0 ? stats : null)
    } catch (e) {
      console.error('Offline map save failed:', e)
      setOfflineSaveError('Could not save the full map for offline use — some tiles may still have been cached.')
    } finally {
      setSavingOffline(false)
      setOfflineProgress(null)
    }
  }

  async function clearOfflineMap() {
    if (!plotId || clearingOffline) return
    setClearingOffline(true)
    try {
      await clearPlotTiles(plotId)
      setTileStats(null)
    } catch (e) {
      console.error('Failed to clear offline tiles:', e)
    } finally {
      setClearingOffline(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col ${className}`} style={{ userSelect: 'none' }}>

      {/* ── Map area ─────────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden" style={{ background: '#0f172a' }}>

        {/* Leaflet mount point — responsive height: 460px on desktop, 60vh on short mobile screens */}
        <div
          ref={mapContainerRef}
          style={{
            height: 'min(460px, 60vh)',
            minHeight: 280,
            width: '100%',
          }}
        />

        {/* Crosshair — only in draw mode, centered, pointer-events:none */}
        <Crosshair visible={isDrawing} />

        {/* Loading spinner */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-[1000]">
            <div className="text-center text-white">
              <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-slate-300">Loading satellite map…</p>
            </div>
          </div>
        )}

        {mapLoaded && (
          <>
            {/* ── Left column: zoom + locate ─────────────────────────── */}
            <div className="absolute left-3 top-3 z-[1000] flex flex-col gap-1.5">

              {/* Zoom in — disabled once we've hit the sharpest imagery this
                  location actually has (see applyZoomCeiling). A farmer
                  tapping this at the ceiling gets a greyed-out button and a
                  tooltip instead of the map silently blanking out. */}
              <button
                type="button" onPointerDown={e => { e.stopPropagation(); e.preventDefault(); zoomIn() }}
                disabled={atImageryCeiling}
                className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 active:scale-95 border border-gray-200 transition-all select-none disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100"
                title={atImageryCeiling ? 'Sharpest satellite imagery available for this spot' : 'Zoom in'}
              >+</button>

              {/* Zoom out */}
              <button
                type="button" onPointerDown={e => { e.stopPropagation(); e.preventDefault(); zoomOut() }}
                className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 active:scale-95 border border-gray-200 transition-all select-none"
                title="Zoom out"
              >−</button>

              {/* Locate me */}
              <button
                type="button" onPointerDown={e => { e.stopPropagation(); e.preventDefault(); autoLocate() }}
                disabled={locating}
                className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-100 active:scale-95 border border-gray-200 transition-all disabled:opacity-50 select-none"
                title="My location"
              >
                {locating
                  ? <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>
                }
              </button>

              {/* Map type toggle */}
              <button
                type="button" onPointerDown={e => { e.stopPropagation(); e.preventDefault(); toggleMapType() }}
                className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-100 active:scale-95 border border-gray-200 transition-all select-none"
                title={mapType === 'satellite' ? 'Switch to street map' : 'Switch to satellite'}
              >
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mapType === 'satellite'
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/>
                  }
                </svg>
              </button>
            </div>

            {/* ── Live area banner (shows whenever >= 3 points) ──────── */}
            {hasPolygon && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 flex items-center gap-4 shadow-lg">
                <div className="text-center">
                  <div className="text-xs text-slate-400 leading-none mb-0.5">Area</div>
                  <div className="text-sm font-bold text-emerald-400">{acres.toFixed(2)} ac</div>
                  <div className="text-xs text-slate-500">{ha.toFixed(3)} ha</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <div className="text-xs text-slate-400 leading-none mb-0.5">Perimeter</div>
                  <div className="text-sm font-bold text-sky-400">{fmtDist(perim)}</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <div className="text-xs text-slate-400 leading-none mb-0.5">Points</div>
                  <div className="text-sm font-bold text-white">{points.length}</div>
                </div>
              </div>
            )}

            {/* ── Status pills ──────────────────────────────────────────── */}
            {isWalking && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Walking… {points.length} GPS points captured
              </div>
            )}

            {isDrawing && !hasPoints && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800/90 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl shadow border border-white/10 text-center whitespace-nowrap">
                Tap the map to place your first corner
              </div>
            )}

            {isDrawing && hasPoints && !hasPolygon && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800/90 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl shadow border border-white/10 text-center whitespace-nowrap">
                {3 - points.length} more {3 - points.length === 1 ? 'corner' : 'corners'} to form a polygon
              </div>
            )}

            {isDrawing && hasPolygon && !snapActive && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800/90 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl shadow border border-white/10 text-center whitespace-nowrap">
                Tap near point 1 to close · or tap <strong className="text-white">Done</strong>
              </div>
            )}

            {snapActive && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg text-center whitespace-nowrap animate-pulse">
                📍 Tap to close polygon
              </div>
            )}

            {/* ── GPS accuracy badge ────────────────────────────────────── */}
            {gpsAccuracy !== null && !hasPolygon && (
              <div className="absolute bottom-3 right-3 z-[1000] bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                GPS ±{gpsAccuracy}m{gpsAccuracy <= 5 ? ' ✓' : gpsAccuracy > 15 ? ' ⚠' : ''}
              </div>
            )}

            {/* ── Imagery zoom ceiling notice ──────────────────────────────
                Only in satellite mode — street/OSM isn't capped (see
                toggleMapType). Tells the farmer *why* + stopped working
                instead of leaving it looking broken, and points at the one
                thing that actually helps: switching to street map, which
                still shows roads/paths even where satellite has no detail. */}
            {atImageryCeiling && mapType === 'satellite' && (
              <div className="absolute bottom-3 left-3 z-[1000] bg-black/70 text-white text-xs px-2.5 py-1.5 rounded-md max-w-[200px] leading-snug">
                Sharpest satellite imagery available here — try street map for more detail
              </div>
            )}

            {!tilesRendered && !tilesStalled && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 pointer-events-none">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Loading satellite imagery — slow on weak signal, corners still save fine
              </div>
            )}

            {/* Tiles genuinely stalled — stop implying it's about to finish
                and give the farmer something to act on instead of a blank
                gray map. Tapping/walking still works underneath this. */}
            {!tilesRendered && tilesStalled && (
              <div className="absolute top-3 left-3 right-3 z-[1000] bg-slate-900/95 border border-amber-500/40 rounded-xl px-3.5 py-3 shadow-lg">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <p className="text-xs text-amber-200 leading-relaxed">
                    Satellite imagery hasn't loaded — your connection may be too weak for it right now.
                    You can still tap or walk the boundary without it, or try one of these:
                  </p>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button
                    type="button"
                    onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                    onClick={retryTiles}
                    className="flex-1 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                    onClick={() => { toggleMapType(); retryTiles() }}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                  >
                    {mapType === 'satellite' ? 'Switch to lightweight map' : 'Try satellite again'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Floating action row (draw mode) ──────────────────────── */}
            {isDrawing && (
              <div className="absolute bottom-3 left-3 right-3 z-[1000] flex gap-2">
                <button
                  type="button"
                  onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                  onClick={undoLast}
                  disabled={!hasPoints}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-30 hover:bg-white active:scale-95 transition-all select-none"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                  Undo
                </button>
                <button
                  type="button"
                  onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                  onClick={clearAll}
                  disabled={!hasPoints}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold shadow-lg disabled:opacity-30 hover:bg-white active:scale-95 transition-all select-none"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  Clear
                </button>
                <button
                  type="button"
                  onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                  onClick={finalizeDraw}
                  disabled={!hasPolygon}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-30 hover:bg-emerald-700 active:scale-95 transition-all select-none"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  Done
                </button>
              </div>
            )}

            {/* ── Floating stop button (walk mode) ─────────────────────── */}
            {isWalking && (
              <div className="absolute bottom-3 left-3 right-3 z-[1000] flex gap-2">
                <button
                  type="button"
                  onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                  onClick={clearAll}
                  className="flex-1 py-2.5 bg-white/90 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold shadow-lg hover:bg-white active:scale-95 transition-all select-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                  onClick={stopWalk}
                  disabled={points.length < 3}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-40 hover:bg-red-700 active:scale-95 transition-all select-none"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  Stop & Save{points.length < 3 ? ` (need ${3 - points.length} more)` : ''}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Below-map area ─────────────────────────────────────────────────── */}
      <div className="mt-3 space-y-2">

        {/* Error banner */}
        {gpsError && (
          <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-xl text-xs text-red-300">
            <svg className="h-4 w-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>{gpsError}</span>
          </div>
        )}

        {/* Idle: mode selection */}
        {isIdle && !result && !walkGpsWarning && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button" onClick={startDraw}
              className="flex flex-col items-center gap-1.5 p-4 bg-emerald-900/30 border-2 border-emerald-700/50 rounded-xl hover:border-emerald-500 hover:bg-emerald-900/50 transition-all text-center"
            >
              <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
              <span className="font-semibold text-emerald-300 text-sm">Tap Corners</span>
              <span className="text-xs text-slate-400 leading-tight">Tap corners on the satellite image</span>
            </button>
            <button
              type="button" onClick={handleWalkClick}
              className="flex flex-col items-center gap-1.5 p-4 bg-sky-900/30 border-2 border-sky-700/50 rounded-xl hover:border-sky-500 hover:bg-sky-900/50 transition-all text-center"
            >
              <svg className="h-7 w-7 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span className="font-semibold text-sky-300 text-sm">Walk Boundary</span>
              <span className="text-xs text-slate-400 leading-tight">Walk the plot edge, GPS records</span>
            </button>
          </div>
        )}

        {/* Walk mode requested but GPS is missing or too coarse (>30m) to
            trust for tracing an edge — confirm before recording a shape
            that may come out unusable. */}
        {isIdle && !result && walkGpsWarning && (
          <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl space-y-3">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <p className="text-xs text-amber-200 leading-relaxed">
                {gpsAccuracy === null
                  ? "We don't have a GPS fix yet, so walking now could record a badly distorted shape."
                  : `Your GPS is only accurate to about ${gpsAccuracy}m right now — walking the boundary at this accuracy can shift corners by that much.`}
                {' '}Stepping into the open, away from trees or buildings, usually helps. Tap Corners doesn't need GPS accuracy at all if satellite imagery is visible.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => setWalkGpsWarning(false)}
                className="flex-1 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Wait / use Tap Corners
              </button>
              <button
                type="button" onClick={startWalk}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
              >
                Walk anyway
              </button>
            </div>
          </div>
        )}

        {/* Done state: full area summary card */}
        {isDone && result && (
          <div className="space-y-3">
            <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className="text-sm font-bold text-emerald-300">Boundary mapped</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">Acreage</div>
                  <div className="text-lg font-bold text-emerald-400">{(result.areaHa * 2.47105).toFixed(2)}</div>
                  <div className="text-xs text-slate-500">acres</div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">Hectares</div>
                  <div className="text-lg font-bold text-emerald-400">{result.areaHa.toFixed(3)}</div>
                  <div className="text-xs text-slate-500">ha</div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">Perimeter</div>
                  <div className="text-lg font-bold text-sky-400">{fmtDist(result.perimeterM)}</div>
                  <div className="text-xs text-slate-500">{result.pointCount} pts</div>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-800/60 border border-white/10 rounded-xl flex items-start gap-2.5">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p className="text-xs text-slate-400 leading-relaxed">
                {result.eudrGeolocationFormat === 'polygon'
                  ? <>This plot is <strong className="text-slate-200">4 ha or larger</strong>, so EUDR requires the full polygon perimeter — already captured above.</>
                  : <>This plot is <strong className="text-slate-200">under 4 ha</strong>, so a single GPS point at <strong className="text-slate-200">{result.centroid.lat}, {result.centroid.lng}</strong> already satisfies EUDR's geolocation requirement. The polygon is still saved for your own records.</>
                }
              </p>
            </div>
            {plotId && (
              <div className="p-3 bg-slate-800/60 border border-white/10 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <svg className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-200">
                      {tileStats ? 'Saved for offline use' : 'Save this map for offline use'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {tileStats
                        ? `${tileStats.tileCount} tiles cached (~${(tileStats.bytes / (1024 * 1024)).toFixed(1)} MB), last updated ${new Date(tileStats.newestSavedAt || Date.now()).toLocaleDateString()}.`
                        : 'Download this plot\'s imagery now so it still loads with no signal in the field.'}
                    </p>
                  </div>
                </div>

                {savingOffline && offlineProgress && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: offlineProgress.total > 0 ? `${Math.round((offlineProgress.done / offlineProgress.total) * 100)}%` : '8%' }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {offlineProgress.total > 0 ? `Caching tile ${offlineProgress.done} of ${offlineProgress.total}…` : 'Preparing…'}
                    </p>
                  </div>
                )}

                {offlineSaveError && <p className="text-xs text-amber-400">{offlineSaveError}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveOfflineMap}
                    disabled={savingOffline}
                    className="flex-1 py-2 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {savingOffline ? 'Saving…' : tileStats ? 'Update offline copy' : 'Save for offline'}
                  </button>
                  {tileStats && (
                    <button
                      type="button"
                      onClick={clearOfflineMap}
                      disabled={clearingOffline || savingOffline}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-400 hover:text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {clearingOffline ? 'Clearing…' : 'Clear'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              type="button" onClick={clearAll}
              className="w-full py-2.5 border border-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Re-map boundary
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
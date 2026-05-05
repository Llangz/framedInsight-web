'use client'

/**
 * PlotBoundaryMapper
 * ─────────────────────────────────────────────────────────────────────────────
 * A self-contained GPS boundary mapping component for framedInsight.
 * Gives Kenyan coffee farmers the same experience as GPS Field Area Measure:
 *
 *  • Satellite imagery basemap (Esri World Imagery — free, no API key)
 *  • Walk Mode: farmer walks the perimeter, polygon draws itself live
 *  • Draw Mode: farmer taps corners directly on the satellite map
 *  • Live area (ha + acres) and perimeter (m) updating in real time
 *  • Vertex editing after drawing (drag to adjust)
 *  • GPS accuracy indicator
 *  • Undo last point, clear and restart
 *  • Outputs GeoJSON polygon + area + centroid back to parent via onComplete()
 *
 * Dependencies (add to package.json):
 *   npm install leaflet react-leaflet leaflet-draw react-leaflet-draw
 *   npm install @types/leaflet @types/leaflet-draw
 *
 * Usage in add-plot-page.tsx:
 *   import PlotBoundaryMapper from '@/components/coffee/PlotBoundaryMapper'
 *
 *   <PlotBoundaryMapper
 *     onComplete={({ polygon, areaHa, centroid }) => {
 *       setFormData(f => ({
 *         ...f,
 *         gps_polygon: polygon,
 *         area_hectares: areaHa.toFixed(4),
 *         gps_latitude: centroid.lat.toFixed(6),
 *         gps_longitude: centroid.lng.toFixed(6),
 *       }))
 *     }}
 *   />
 *
 * IMPORTANT — Next.js SSR:
 *   Leaflet uses `window` and cannot run server-side.
 *   Import this component with dynamic() and ssr: false:
 *
 *   const PlotBoundaryMapper = dynamic(
 *     () => import('@/components/coffee/PlotBoundaryMapper'),
 *     { ssr: false }
 *   )
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BoundaryResult {
  polygon: any
  areaHa: number
  perimeterM: number
  centroid: { lat: number; lng: number }
  pointCount: number
}

interface Props {
  onComplete: (result: BoundaryResult) => void
  onLocationDetected?: (location: { county?: string; ward?: string; subLocation?: string; display: string }) => void
  onClear?: () => void
  initialCenter?: [number, number]   // [lat, lng] — defaults to Kenya highlands
  className?: string
}

type MapMode = 'idle' | 'walking' | 'drawing'

interface LatLng {
  lat: number
  lng: number
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Haversine distance between two points in metres */
function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(sin2))
}

/** Shoelace formula — area in hectares for a polygon of lat/lng points */
function areaHectares(pts: LatLng[]): number {
  if (pts.length < 3) return 0
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    const xi = toRad(pts[i].lng) * Math.cos(toRad(pts[i].lat))
    const yi = toRad(pts[i].lat)
    const xj = toRad(pts[j].lng) * Math.cos(toRad(pts[j].lat))
    const yj = toRad(pts[j].lat)
    area += xi * yj - xj * yi
  }
  return Math.abs(area / 2) * R * R / 10000
}

/** Perimeter in metres */
function perimeterMetres(pts: LatLng[]): number {
  if (pts.length < 2) return 0
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    total += distanceM(pts[i], pts[(i + 1) % pts.length])
  }
  return total
}

/** Centroid of a polygon */
function centroid(pts: LatLng[]): LatLng {
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
  }
}

/** Build GeoJSON Feature from points */
function toGeoJSON(pts: LatLng[]): any {
  const coords = [...pts, pts[0]].map(p => [p.lng, p.lat])
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  }
}

/** Format metres nicely: show as km if > 1000 m */
function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlotBoundaryMapper({
  onComplete,
  onLocationDetected,
  onClear,
  initialCenter = [-0.7, 37.0], // Central Kenya highlands
  className = '',
}: Props) {
  // Leaflet refs — loaded dynamically to avoid SSR issues
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const liveMarkerRef = useRef<any>(null)      // blinking GPS dot
  const walkPolylineRef = useRef<any>(null)    // trail while walking
  const drawnPolygonRef = useRef<any>(null)    // final polygon layer
  const cornerMarkersRef = useRef<any[]>([])   // draw-mode corner pins
  const watchIdRef = useRef<number | null>(null)
  const leafletRef = useRef<any>(null)

  const [mode, setMode] = useState<MapMode>('idle')
  const [points, setPoints] = useState<LatLng[]>([])
  const [completed, setCompleted] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [locating, setLocating] = useState(false)

  // Derived stats
  const area = areaHectares(points)
  const perimeter = perimeterMetres(points)
  const acres = area * 2.47105

  // ── Load Leaflet (client-only) ────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initMap = async () => {
      // Skip if already initialized
      if (mapRef.current) {
        console.warn('Map already initialized, skipping re-initialization')
        return
      }

      // Ensure container is ready
      if (!mapContainerRef.current) {
        console.warn('Map container not ready')
        return
      }

      try {
        // @ts-ignore
        const L = await import('leaflet')
        // @ts-ignore - CSS import doesn't have type declarations but works at runtime
        await import('leaflet/dist/leaflet.css')
        leafletRef.current = L.default ?? L

        // Fix default marker icon paths broken by webpack
        const LD = leafletRef.current
        delete (LD.Icon.Default.prototype as any)._getIconUrl
        LD.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // Safely clear old map instance
        if (mapRef.current) {
          try {
            mapRef.current.remove()
            mapRef.current = null
          } catch (e) {
            console.warn('Error removing old map:', e)
          }
        }
        
        if (mapContainerRef.current) {
          mapContainerRef.current.innerHTML = ''
        }

        // Create map
        const map = LD.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 17,
          zoomControl: false,
          attributionControl: true,
          doubleClickZoom: false, // Disable double-click zoom to prevent plotting
        })

      // ── Basemap layers ──────────────────────────────────────────────────
      // Primary: Esri World Imagery (free, no key, high-res satellite)
      const esriSat = LD.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles © Esri — Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, GIS User Community',
          maxZoom: 20,
          maxNativeZoom: 19,
        }
      )

      // Overlay: Esri World Imagery Labels (roads/place names on top of satellite)
      const esriLabels = LD.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { attribution: '', maxZoom: 20, maxNativeZoom: 19, opacity: 0.7 }
      )

      // Alternative: OpenStreetMap (for toggling)
      const osm = LD.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap contributors', maxZoom: 19 }
      )

      esriSat.addTo(map)
      esriLabels.addTo(map)

      // Layer control
      LD.control.layers(
        { 'Satellite (Esri)': esriSat, 'Street Map': osm },
        { 'Labels': esriLabels },
        { position: 'topright' }
      ).addTo(map)

      // Add custom zoom controls (larger, more visible)
      LD.control.zoom({ position: 'topleft' }).addTo(map)

      // Add re-enable double-click zoom button for manual control
      const zoomControl = LD.control({ position: 'topleft' })
      zoomControl.onAdd = () => {
        const div = LD.DomUtil.create('div', 'leaflet-bar leaflet-control')
        div.innerHTML = `
          <a class="leaflet-control-zoom-in" href="#" title="Double-click to zoom in" style="font-size:14px;padding:6px 8px;line-height:1.2;">
            <span>🔍+</span>
          </a>
        `
        div.onclick = () => map.doubleClickZoom.enable()
        return div
      }
      zoomControl.addTo(map)

        mapRef.current = map
        setMapLoaded(true)

        // Auto-locate farmer on load
        locateUser(map, LD)
      } catch (error: any) {
        console.error('Error initializing map:', error)
        setGpsError('Failed to load map. Please refresh the page.')
      }
    }

    initMap()

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (mapRef.current) {
        try {
          // Store reference before removing
          const map = mapRef.current
          mapRef.current = null
          map.remove()
        } catch (e) {
          console.warn('Error removing map:', e)
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reverse geocoding to get location name ──────────────────────────────────

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      )
      const data = await response.json()
      const address = data.address || {}
      
      // Extract location hierarchy
      const county = address.county || address.state || ''
      const ward = address.village || address.suburb || address.municipality || ''
      const subLocation = address.hamlet || address.locality || ''
      
      const display = [county, ward, subLocation].filter(Boolean).join(', ')
      
      if (display && onLocationDetected) {
        onLocationDetected({
          county,
          ward,
          subLocation,
          display
        })
      }
    } catch (error) {
      console.warn('Reverse geocoding error:', error)
    }
  }, [onLocationDetected])

  // ── Locate user & center map ──────────────────────────────────────────────

  const locateUser = useCallback((map?: any, L?: any) => {
    const _map = map ?? mapRef.current
    const _L = L ?? leafletRef.current
    if (!_map || !_L) return

    setLocating(true)
    setGpsError(null)

    // Check if geolocation is available
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device')
      setLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setGpsAccuracy(Math.round(accuracy))
        setLocating(false)
        _map.setView([latitude, longitude], 18)

        // Show accuracy circle
        _L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#3b82f6',
          fillColor: '#93c5fd',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(_map)

        // Get location name from coordinates
        reverseGeocode(latitude, longitude)
      },
      (err) => {
        // Map error codes to user-friendly messages
        let errorMsg = 'GPS error'
        if (err.code === 1) {
          errorMsg = 'Location permission denied — enable in browser settings'
        } else if (err.code === 2) {
          errorMsg = 'GPS signal not available — move to open area'
        } else if (err.code === 3) {
          errorMsg = 'GPS request timed out — try again'
        } else {
          errorMsg = err.message || 'GPS error'
        }
        setGpsError(errorMsg)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [reverseGeocode])

  // ── Live GPS dot (pulsing marker) ─────────────────────────────────────────

  const createLiveMarker = useCallback((lat: number, lng: number) => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    const pulseIcon = L.divIcon({
      html: `
        <div style="
          width:16px; height:16px; border-radius:50%;
          background:#2563eb; border:2px solid #fff;
          box-shadow:0 0 0 4px rgba(37,99,235,0.3);
          animation: gpsPulse 1.5s ease-in-out infinite;
        "></div>
        <style>
          @keyframes gpsPulse {
            0%,100%{box-shadow:0 0 0 4px rgba(37,99,235,0.3)}
            50%{box-shadow:0 0 0 8px rgba(37,99,235,0.05)}
          }
        </style>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })

    if (liveMarkerRef.current) {
      liveMarkerRef.current.setLatLng([lat, lng])
    } else {
      liveMarkerRef.current = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 1000 }).addTo(map)
    }
  }, [])

  // ── Corner pin marker ─────────────────────────────────────────────────────

  const createCornerMarker = useCallback((lat: number, lng: number, index: number) => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return null

    const icon = L.divIcon({
      html: `<div style="
        width:24px;height:24px;border-radius:50%;
        background:#16a34a;border:2px solid #fff;
        color:#fff;font-size:10px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 4px rgba(0,0,0,0.3);
      ">${index + 1}</div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
    return marker
  }, [])

  // ── Draw polygon on map ───────────────────────────────────────────────────

  const renderPolygon = useCallback((pts: LatLng[]) => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || pts.length < 2) return

    if (drawnPolygonRef.current) {
      map.removeLayer(drawnPolygonRef.current)
    }

    if (pts.length === 1) return

    // While drawing: show a polyline (open path)
    // Once >= 3 points: show filled polygon
    if (pts.length >= 3) {
      drawnPolygonRef.current = L.polygon(
        pts.map(p => [p.lat, p.lng]),
        {
          color: '#16a34a',
          weight: 2.5,
          opacity: 1,
          fillColor: '#22c55e',
          fillOpacity: 0.25,
        }
      ).addTo(map)
    } else {
      drawnPolygonRef.current = L.polyline(
        pts.map(p => [p.lat, p.lng]),
        { color: '#16a34a', weight: 2.5, dashArray: '6 4' }
      ).addTo(map)
    }
  }, [])

  // ── Walk Mode ─────────────────────────────────────────────────────────────

  function startWalk() {
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device')
      return
    }

    clearAll()
    setMode('walking')
    setGpsError(null)

    const L = leafletRef.current
    const map = mapRef.current

    // Walking trail polyline
    walkPolylineRef.current = L.polyline([], {
      color: '#2563eb',
      weight: 3,
      opacity: 0.8,
    }).addTo(map)

    let lastPoint: LatLng | null = null

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setGpsAccuracy(Math.round(accuracy))

        // Skip if too close to last point (< 1.5 m) — reduces GPS noise
        if (lastPoint) {
          const d = distanceM(lastPoint, { lat, lng })
          if (d < 1.5) return
        }

        const pt = { lat, lng }
        lastPoint = pt

        // Update live dot
        createLiveMarker(lat, lng)
        map.panTo([lat, lng], { animate: true, duration: 0.5 })

        // Extend trail
        walkPolylineRef.current?.addLatLng([lat, lng])

        setPoints(prev => {
          const updated = [...prev, pt]
          renderPolygon(updated)
          return updated
        })
      },
      (err) => setGpsError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )

    watchIdRef.current = id
  }

  function stopWalk() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    setPoints(prev => {
      if (prev.length < 3) {
        setGpsError('Not enough points — need at least 3. Try walking a larger area.')
        setMode('idle')
        return prev
      }
      finalize(prev)
      return prev
    })

    // Remove walking trail (polygon stays)
    if (walkPolylineRef.current && mapRef.current) {
      mapRef.current.removeLayer(walkPolylineRef.current)
      walkPolylineRef.current = null
    }
    if (liveMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(liveMarkerRef.current)
      liveMarkerRef.current = null
    }
  }

  // ── Draw Mode (tap map to place corners) ─────────────────────────────────

  function startDraw() {
    clearAll()
    setMode('drawing')
    setGpsError(null)

    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L) return

    // Show crosshair cursor on map
    map.getContainer().style.cursor = 'crosshair'

    // Disable double-click zoom during draw mode to prevent accidental plotting
    if (map.doubleClickZoom) {
      map.doubleClickZoom.disable()
    }

    map.on('click', onMapClick)
  }

  const onMapClick = useCallback((e: any) => {
    const pt: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng }

    setPoints(prev => {
      const updated = [...prev, pt]

      // Add numbered corner marker
      const marker = createCornerMarker(pt.lat, pt.lng, prev.length)
      if (marker) {
        // Allow dragging corners to fine-tune
        const idx = prev.length
        marker.on('dragend', (ev: any) => {
          const newLL = ev.target.getLatLng()
          setPoints(curr => {
            const copy = [...curr]
            copy[idx] = { lat: newLL.lat, lng: newLL.lng }
            renderPolygon(copy)
            return copy
          })
        })
        cornerMarkersRef.current.push(marker)
      }

      renderPolygon(updated)
      return updated
    })
  }, [createCornerMarker, renderPolygon])

  function finalizeDraw() {
    const map = mapRef.current
    const L = leafletRef.current
    if (map) {
      map.off('click', onMapClick)
      map.getContainer().style.cursor = ''
      // Re-enable double-click zoom after drawing
      if (L && map.doubleClickZoom) {
        map.doubleClickZoom.enable()
      }
    }

    setPoints(prev => {
      if (prev.length < 3) {
        setGpsError('Need at least 3 corners to form a plot boundary.')
        setMode('idle')
        return prev
      }
      finalize(prev)
      return prev
    })
  }

  // ── Undo last point ───────────────────────────────────────────────────────

  function undoLast() {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L) return

    // Remove last corner marker (draw mode)
    if (cornerMarkersRef.current.length > 0) {
      const last = cornerMarkersRef.current.pop()
      if (last) map.removeLayer(last)
    }

    setPoints(prev => {
      const updated = prev.slice(0, -1)
      renderPolygon(updated)
      if (updated.length < 3 && drawnPolygonRef.current) {
        map.removeLayer(drawnPolygonRef.current)
        drawnPolygonRef.current = null
      }
      return updated
    })
  }

  // ── Finalize: close polygon, call parent ──────────────────────────────────

  function finalize(pts: LatLng[]) {
    setMode('idle')
    setCompleted(true)

    const result: BoundaryResult = {
      polygon: toGeoJSON(pts),
      areaHa: areaHectares(pts),
      perimeterM: perimeterMetres(pts),
      centroid: centroid(pts),
      pointCount: pts.length,
    }

    onComplete(result)

    // Fit map to polygon
    const map = mapRef.current
    const L = leafletRef.current
    if (map && L && pts.length >= 3) {
      const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }

  // ── Clear everything ──────────────────────────────────────────────────────

  function clearAll() {
    const map = mapRef.current
    if (!map) return

    // Stop walking if active
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    // Remove map layers
    if (drawnPolygonRef.current) { map.removeLayer(drawnPolygonRef.current); drawnPolygonRef.current = null }
    if (walkPolylineRef.current) { map.removeLayer(walkPolylineRef.current); walkPolylineRef.current = null }
    if (liveMarkerRef.current) { map.removeLayer(liveMarkerRef.current); liveMarkerRef.current = null }

    cornerMarkersRef.current.forEach(m => map.removeLayer(m))
    cornerMarkersRef.current = []

    map.off('click', onMapClick)
    map.getContainer().style.cursor = ''

    setPoints([])
    setCompleted(false)
    setMode('idle')
    setGpsError(null)
    onClear?.()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isWalking = mode === 'walking'
  const isDrawing = mode === 'drawing'
  const isIdle = mode === 'idle'
  const hasPoints = points.length > 0
  const hasPolygon = points.length >= 3

  return (
    <div className={`flex flex-col gap-0 ${className}`}>

      {/* ── Map container ─────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div
          ref={mapContainerRef}
          style={{ height: '380px', width: '100%', background: '#1a1a2e' }}
        />

        {/* Loading overlay */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-[1000]">
            <div className="text-center text-white">
              <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm">Loading satellite map…</p>
            </div>
          </div>
        )}

        {/* Re-center button — always visible */}
        {mapLoaded && (
          <button
            type="button"
            onClick={() => locateUser()}
            disabled={locating}
            className="absolute top-2 left-2 z-[1000] bg-white rounded-lg shadow-md px-2.5 py-2 flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 border border-gray-200"
          >
            {locating ? (
              <svg className="animate-spin h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            )}
            {locating ? 'Locating…' : 'My Location'}
          </button>
        )}

        {/* GPS accuracy badge */}
        {gpsAccuracy !== null && (
          <div className="absolute bottom-2 left-2 z-[1000] bg-black/60 text-white text-xs px-2 py-1 rounded-md">
            GPS ±{gpsAccuracy}m
            {gpsAccuracy <= 5 && ' ✓'}
            {gpsAccuracy > 15 && ' — move to open area'}
          </div>
        )}

        {/* Walking status overlay */}
        {isWalking && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Recording… {points.length} points
          </div>
        )}

        {/* Drawing instructions overlay */}
        {isDrawing && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow">
            📍 Tap map to place corners — {points.length} placed
          </div>
        )}
      </div>

      {/* ── Live stats bar ────────────────────────────────────────────── */}
      {hasPolygon && (
        <div className="grid grid-cols-3 gap-px bg-gray-200 border-x border-b border-gray-200 rounded-b-xl overflow-hidden">
          <div className="bg-white px-3 py-2 text-center">
            <p className="text-xs text-gray-500 leading-none mb-0.5">Area</p>
            <p className="text-sm font-bold text-gray-900">{area.toFixed(3)} ha</p>
            <p className="text-xs text-gray-400">{acres.toFixed(2)} acres</p>
          </div>
          <div className="bg-white px-3 py-2 text-center">
            <p className="text-xs text-gray-500 leading-none mb-0.5">Perimeter</p>
            <p className="text-sm font-bold text-gray-900">{fmtDistance(perimeter)}</p>
          </div>
          <div className="bg-white px-3 py-2 text-center">
            <p className="text-xs text-gray-500 leading-none mb-0.5">Points</p>
            <p className="text-sm font-bold text-gray-900">{points.length}</p>
            <p className="text-xs text-gray-400">corners</p>
          </div>
        </div>
      )}

      {/* ── Control buttons ───────────────────────────────────────────── */}
      <div className="mt-3 space-y-2">

        {/* Error message */}
        {gpsError && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <span className="mt-0.5">⚠️</span>
            <span>{gpsError}</span>
          </div>
        )}

        {/* IDLE — show mode selection */}
        {isIdle && !completed && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={startWalk}
              className="flex flex-col items-center gap-1 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-100 transition-colors text-left"
            >
              <span className="text-2xl">🚶</span>
              <span className="font-semibold text-blue-900 text-sm">Walk Boundary</span>
              <span className="text-xs text-blue-600 text-center leading-tight">
                Walk your plot edge — GPS tracks automatically
              </span>
            </button>
            <button
              type="button"
              onClick={startDraw}
              className="flex flex-col items-center gap-1 p-4 bg-green-50 border-2 border-green-200 rounded-xl hover:border-green-400 hover:bg-green-100 transition-colors text-left"
            >
              <span className="text-2xl">👆</span>
              <span className="font-semibold text-green-900 text-sm">Tap Corners</span>
              <span className="text-xs text-green-600 text-center leading-tight">
                Tap corners on the satellite map
              </span>
            </button>
          </div>
        )}

        {/* WALKING — stop button */}
        {isWalking && (
          <div className="space-y-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <strong>Walk slowly</strong> along the outer edge of your plot.
              Stay close to the boundary. Tap Stop when you're back where you started.
            </div>
            <button
              type="button"
              onClick={stopWalk}
              disabled={points.length < 3}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              Stop & Save Boundary
              {points.length < 3 && ` (need ${3 - points.length} more points)`}
            </button>
          </div>
        )}

        {/* DRAWING — undo + finalize */}
        {isDrawing && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={undoLast}
              disabled={!hasPoints}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={finalizeDraw}
              disabled={!hasPolygon}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✓ Done ({points.length} corners)
            </button>
          </div>
        )}

        {/* COMPLETED */}
        {completed && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
              <span className="text-xl">✅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">Boundary saved!</p>
                <p className="text-xs text-green-600 truncate">
                  {area.toFixed(3)} ha · {fmtDistance(perimeter)} perimeter · {points.length} points
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="w-full py-2 border border-gray-300 text-gray-600 rounded-xl text-xs hover:bg-gray-50"
            >
              Re-map boundary
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

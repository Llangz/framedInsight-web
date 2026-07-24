'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { probeMaxAvailableZoom } from '@/lib/esri-tile-availability'

interface PlotData {
  id: string
  plot_name: string
  gps_latitude: number | null
  gps_longitude: number | null
  gps_polygon: any
  total_trees: number
  land_size_acres: number | null
  eudr_risk_level: string | null
  owner_name: string
  farm_name: string
}

interface Props {
  plots: PlotData[]
  className?: string
}

export default function CoopFleetMap({ plots, className = '' }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // ── Same two problems PlotBoundaryMapper had, present here too ───────────
  // 1. This view previously had NO tileerror handling at all — a coop
  //    officer on weak office wifi or the field just got a permanently
  //    grey map with zero recovery path, unlike every other map view in
  //    the app. esriLayerRef/labelsLayerRef/osmLayerRef + the error
  //    counters below add the same relative-threshold OSM fallback used
  //    in PlotBoundaryMapper (see its comment for why relative, not a
  //    flat count).
  // 2. Esri's real per-location imagery resolution varies — see
  //    lib/esri-tile-availability.ts. Past a location's real ceiling
  //    Esri returns a valid-but-blank "Map data not yet available" tile
  //    instead of erroring, so (1) alone can't catch it. Zooming into a
  //    specific member's small plot on this fleet view hit exactly that.
  //    satelliteZoomCeilingRef holds whatever the probe last found for
  //    wherever the officer is currently looking (re-probed on moveend).
  const esriLayerRef = useRef<any>(null)
  const labelsLayerRef = useRef<any>(null)
  const osmLayerRef = useRef<any>(null)
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')
  const ESRI_NOMINAL_MAX_ZOOM = 19
  const satelliteZoomCeilingRef = useRef<number>(ESRI_NOMINAL_MAX_ZOOM)
  const [atImageryCeiling, setAtImageryCeiling] = useState(false)
  const moveEndProbeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return

    const initMap = async () => {
      try {
        if (!mapContainerRef.current) return
        const L = (await import('leaflet')).default

        // Fix broken default icons
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // Centroid of all mapped plots (previously just used the first
        // valid plot's own coordinates, which skewed the initial view —
        // and the initial zoom-ceiling probe below — toward whichever plot
        // happened to be first in the list rather than the fleet as a
        // whole) or fallback to Kenya center if nothing is mapped yet.
        const validCoords = plots.filter(p => p.gps_latitude && p.gps_longitude)
        const center: [number, number] = validCoords.length > 0
          ? [
              validCoords.reduce((s, p) => s + p.gps_latitude!, 0) / validCoords.length,
              validCoords.reduce((s, p) => s + p.gps_longitude!, 0) / validCoords.length,
            ]
          : [-1.2921, 36.8219] // Nairobi

        const map = L.map(mapContainerRef.current, {
          center,
          zoom: validCoords.length > 0 ? 15 : 7,
          zoomControl: true,
          attributionControl: false,
        })

        // Satellite view
        const esriSat = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19 }
        )
        // Labels
        const esriLabels = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19, opacity: 0.8 }
        )
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })

        esriSat.addTo(map)
        esriLabels.addTo(map)
        esriLayerRef.current = esriSat
        labelsLayerRef.current = esriLabels
        osmLayerRef.current = osm

        // Auto-fallback to OSM if satellite tiles keep failing — this view
        // previously had no error handling at all. Same relative-threshold
        // logic as PlotBoundaryMapper: an absolute error count never fires
        // reliably on a small/just-mounted viewport, so we track errors
        // against how many tiles were actually requested instead.
        let satRequested = 0
        let satErrors = 0
        let fellBack = false
        const fallBackToOsm = () => {
          if (fellBack || !map.hasLayer(esriSat)) return
          fellBack = true
          esriSat.remove(); esriLabels.remove(); osm.addTo(map)
          setMapType('street')
          map.setMaxZoom(ESRI_NOMINAL_MAX_ZOOM)
        }
        esriSat.on('tileloadstart', () => { satRequested += 1 })
        esriLabels.on('tileloadstart', () => { satRequested += 1 })
        const onSatError = () => {
          satErrors += 1
          const enoughAbsolute = satErrors >= 5
          const enoughRelative = satErrors >= 3 && satErrors >= Math.ceil(satRequested * 0.6)
          if (enoughAbsolute || enoughRelative) fallBackToOsm()
        }
        esriSat.on('tileerror', onSatError)
        esriLabels.on('tileerror', onSatError)

        // Zoom-ceiling probe (fixes "map data not yet available" when
        // zooming into a small member plot — see lib/esri-tile-availability.ts).
        // Applied via the shared applyZoomCeiling helper below, defined once
        // outside this effect and re-run on moveend as the officer pans
        // toward specific plots, since a fleet map's imagery ceiling isn't
        // one value for the whole cooperative.
        applyZoomCeilingFor(map, center[0], center[1])
        map.on('zoom', () => {
          const onSatellite = !!esriLayerRef.current && map.hasLayer(esriLayerRef.current)
          setAtImageryCeiling(onSatellite && map.getZoom() >= satelliteZoomCeilingRef.current)
        })
        map.on('moveend', () => {
          if (moveEndProbeTimerRef.current) clearTimeout(moveEndProbeTimerRef.current)
          moveEndProbeTimerRef.current = setTimeout(() => {
            if (!mapRef.current) return
            const c = mapRef.current.getCenter()
            applyZoomCeilingFor(mapRef.current, c.lat, c.lng)
          }, 400)
        })

        // Plot polygons and markers
        const bounds: any[] = []

        plots.forEach(plot => {
          if (!plot.gps_latitude || !plot.gps_longitude) return

          const statusColor = plot.eudr_risk_level === 'low' ? '#10B981' : // Green
                             plot.eudr_risk_level === 'medium' ? '#F59E0B' : // Amber
                             plot.eudr_risk_level === 'high' ? '#EF4444' : // Red
                             '#6B7280' // Gray

          // 1. Draw polygon if available
          if (plot.gps_polygon && plot.gps_polygon.geometry && plot.gps_polygon.geometry.coordinates) {
            try {
              // GeoJSON format: coordinates is [[ [lng, lat], [lng, lat], ... ]]
              const coords = plot.gps_polygon.geometry.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]])
              const polygon = L.polygon(coords, {
                color: statusColor,
                weight: 2,
                fillColor: statusColor,
                fillOpacity: 0.3,
              }).addTo(map)

              polygon.bindPopup(`
                <div class="text-zinc-900 font-sans p-1">
                  <h4 class="font-bold text-sm text-zinc-950">${plot.farm_name}</h4>
                  <p class="text-xs text-zinc-600 mt-0.5">Owner: ${plot.owner_name}</p>
                  <p class="text-xs text-zinc-600">Plot: ${plot.plot_name}</p>
                  <p class="text-xs text-zinc-600">Trees: ${plot.total_trees} · Size: ${plot.land_size_acres || 'N/A'} ac</p>
                  <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 text-white" style="background-color: ${statusColor}">
                    EUDR Status: ${plot.eudr_risk_level || 'Unknown'}
                  </span>
                </div>
              `)
              bounds.push(coords)
            } catch (err) {
              console.error('Error drawing plot polygon:', err)
            }
          } else {
            // 2. Draw standard marker if no polygon
            const marker = L.marker([plot.gps_latitude, plot.gps_longitude]).addTo(map)
            marker.bindPopup(`
              <div class="text-zinc-900 font-sans p-1">
                <h4 class="font-bold text-sm text-zinc-950">${plot.farm_name}</h4>
                <p class="text-xs text-zinc-600 mt-0.5">Owner: ${plot.owner_name}</p>
                <p class="text-xs text-zinc-600">Centroid Only (No polygon mapped)</p>
                <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 text-white" style="background-color: ${statusColor}">
                  EUDR Status: ${plot.eudr_risk_level || 'Unknown'}
                </span>
              </div>
            `)
            bounds.push([[plot.gps_latitude, plot.gps_longitude]])
          }
        })

        // Auto-fit to bounds if we have valid elements. Capped at 17 for the
        // same reason as the read-only PlotMap component (see its comment):
        // a tight bounding box around one small plot can otherwise push
        // fitBounds well past where Esri has real imagery for many rural
        // areas. This is just the safe default for the very first paint —
        // applyZoomCeilingFor above/below adjusts it precisely once the
        // real probe resolves, which may allow tighter zoom or require
        // pulling back further depending on the actual location.
        if (bounds.length > 0 && map) {
          const flatBounds = bounds.flat()
          const lBounds = L.latLngBounds(flatBounds as any)
          map.fitBounds(lBounds, { padding: [30, 30], maxZoom: 17 })
        }

        mapRef.current = map
        setMapLoaded(true)
      } catch (err) {
        console.error('Leaflet initialization failed:', err)
      }
    }

    initMap()

    return () => {
      if (moveEndProbeTimerRef.current) { clearTimeout(moveEndProbeTimerRef.current); moveEndProbeTimerRef.current = null }
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {}
        mapRef.current = null
      }
    }
  }, [plots])

  // ── Discover & enforce the real Esri imagery zoom ceiling ──────────────────
  // See lib/esri-tile-availability.ts for the full explanation. Unlike
  // PlotBoundaryMapper (one plot, one location), a fleet map spans however
  // many member plots are scattered across the cooperative's area — there
  // isn't one ceiling for the whole map. This is re-run on moveend (see
  // initMap) so the ceiling always reflects wherever the officer is
  // currently looking, not just the fleet's overall centroid.
  const applyZoomCeilingFor = useCallback(async (map: any, lat: number, lng: number) => {
    if (!map) return
    const ceiling = await probeMaxAvailableZoom(lat, lng)
    if (!mapRef.current || mapRef.current !== map) return // unmounted or a newer probe has already superseded this one
    satelliteZoomCeilingRef.current = ceiling
    const esri = esriLayerRef.current
    if (!esri || !map.hasLayer(esri)) return // street active — uncapped, see toggleMapType
    map.setMaxZoom(ceiling)
    if (map.getZoom() > ceiling) map.setZoom(ceiling)
    setAtImageryCeiling(map.getZoom() >= ceiling)
  }, [])

  function toggleMapType() {
    const map = mapRef.current
    if (!map) return
    if (mapType === 'satellite') {
      if (esriLayerRef.current) map.removeLayer(esriLayerRef.current)
      if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current)
      if (osmLayerRef.current) osmLayerRef.current.addTo(map)
      setMapType('street')
      map.setMaxZoom(ESRI_NOMINAL_MAX_ZOOM) // OSM's coverage doesn't have this problem — lift the cap
      setAtImageryCeiling(false)
    } else {
      if (osmLayerRef.current) map.removeLayer(osmLayerRef.current)
      if (esriLayerRef.current) esriLayerRef.current.addTo(map)
      if (labelsLayerRef.current) labelsLayerRef.current.addTo(map)
      setMapType('satellite')
      map.setMaxZoom(satelliteZoomCeilingRef.current)
      if (map.getZoom() > satelliteZoomCeilingRef.current) map.setZoom(satelliteZoomCeilingRef.current)
      setAtImageryCeiling(map.getZoom() >= satelliteZoomCeilingRef.current)
    }
  }

  return (
    <div className={`relative rounded-xl overflow-hidden bg-zinc-900 border border-[#2A2D35] ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-[1000]">
          <p className="text-sm text-zinc-400">Loading satellite fleet map…</p>
        </div>
      )}
      {mapLoaded && (
        <>
          {/* Manual escape hatch to match every other map view in the app —
              previously this was the only one without it, even though it's
              the view most likely to span areas with patchy imagery since
              it covers the whole cooperative rather than one plot. */}
          <button
            type="button"
            onClick={toggleMapType}
            className="absolute top-3 right-3 z-[1000] bg-white text-xs font-semibold text-gray-700 px-2.5 py-1.5 rounded-lg shadow-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            title={mapType === 'satellite' ? 'No imagery for a plot? Switch to street map' : 'Switch to satellite'}
          >
            {mapType === 'satellite' ? 'Street view' : 'Satellite view'}
          </button>

          {/* Imagery zoom-ceiling notice — the native Leaflet zoom control
              already greys out its own + button once map.setMaxZoom() caps
              it (see applyZoomCeilingFor), but a greyed-out button with no
              explanation still reads as broken. This tells the officer why. */}
          {atImageryCeiling && mapType === 'satellite' && (
            <div className="absolute bottom-3 left-3 z-[1000] bg-black/70 text-white text-xs px-2.5 py-1.5 rounded-md max-w-[220px] leading-snug">
              Sharpest satellite imagery available here — try street map for more detail
            </div>
          )}
        </>
      )}
    </div>
  )
}
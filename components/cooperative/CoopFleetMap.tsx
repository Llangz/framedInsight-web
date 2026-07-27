'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createOfflineTileLayer } from '@/lib/offline-tile-layer'
import { sentinelTileUrlTemplate } from '@/lib/sentinel-tile-url'

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
  const leafletRef = useRef<any>(null)
  // Plot markers/polygons live in their own layer group so they can be
  // cleared and redrawn independently of the tile layers and the map
  // instance itself — see the note above the init effect below for why
  // this decoupling is the actual fix for the blank-map bug on this view.
  const plotLayerGroupRef = useRef<any>(null)
  // Always holds the latest `plots` prop, read by renderPlots() below.
  // Keeping this in a ref (rather than a dependency) is what lets the
  // map-init effect run exactly once per mount instead of once per
  // render — see the comment above that effect.
  const plotsRef = useRef(plots)
  useEffect(() => { plotsRef.current = plots }, [plots])
  const [mapLoaded, setMapLoaded] = useState(false)

  // ── Same two problems PlotBoundaryMapper had, present here too ───────────
  // 1. This view previously had NO tileerror handling at all — a coop
  //    officer on weak office wifi or the field just got a permanently
  //    grey map with zero recovery path, unlike every other map view in
  //    the app. esriLayerRef/labelsLayerRef/osmLayerRef + the error
  //    counters below add the same relative-threshold OSM fallback used
  //    in PlotBoundaryMapper (see its comment for why relative, not a
  //    flat count).
  // 2. Esri's real per-location imagery resolution varies. Past a
  //    location's real ceiling Esri returns a valid-but-blank "Map data
  //    not yet available" tile instead of erroring, so (1) alone can't
  //    catch it. Zooming into a specific member's small plot on this
  //    fleet view hit exactly that.
  //
  //    An earlier fix attempted to pre-discover this via the ArcGIS
  //    `tilemap` REST resource (lib/esri-tile-availability.ts, since
  //    removed) — that resource turned out not to be exposed by this
  //    specific Esri endpoint at all (confirmed against its own REST
  //    service directory listing), so every probe silently 404'd and
  //    "discovered" the same wrong, universally-low ceiling everywhere,
  //    which broke tight zoom even in well-covered areas — worse than
  //    the original bug.
  //
  //    This version is reactive instead: createOfflineTileLayer (see
  //    lib/offline-tile-layer.ts) inspects each satellite tile that
  //    actually loads and fires 'tileplaceholder' if its pixels look like
  //    the flat "not available" graphic rather than real photography.
  //    satelliteZoomCeilingRef only clamps down once that's actually been
  //    observed for wherever the officer is currently looking — nothing
  //    is capped ahead of time or on a timer.
  const esriLayerRef = useRef<any>(null)
  const labelsLayerRef = useRef<any>(null)
  const osmLayerRef = useRef<any>(null)
  // Sentinel-2 fallback — see fallBackToSentinel() below. Real satellite
  // imagery with uniform global coverage, used before giving up on
  // satellite entirely and dropping to the OSM street map.
  const sentinelLayerRef = useRef<any>(null)
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')
  const ESRI_NOMINAL_MAX_ZOOM = 19
  const satelliteZoomCeilingRef = useRef<number>(ESRI_NOMINAL_MAX_ZOOM)
  const placeholderCountAtZoomRef = useRef<{ zoom: number; count: number }>({ zoom: -1, count: 0 })
  // How many times the ceiling above has actually been pulled down — see
  // the matching comment in PlotBoundaryMapper.tsx. One reduction is
  // normal (started zoomed in past what's available here); a second means
  // there's no real Esri coverage at this location at any zoom, which no
  // further clamp can fix — that's when fallBackToSentinel() kicks in.
  const ceilingReductionsRef = useRef(0)
  const [atImageryCeiling, setAtImageryCeiling] = useState(false)
  // Flipped true in the init effect's cleanup — see the matching field in
  // PlotBoundaryMapper.tsx. Lets the tileplaceholder/fallback callbacks
  // below recognize a torn-down map (from an in-flight async detection
  // fetch resolving after unmount) and no-op instead of calling methods on
  // an already-`.remove()`d Leaflet instance.
  const destroyedRef = useRef(false)

  // Draws (or redraws) every plot's polygon/marker into a dedicated layer
  // group, reading the latest data from plotsRef rather than a `plots`
  // closure argument — that's what lets this be called both from the
  // one-time init effect and from the plots-changed effect below without
  // either one needing `plots` in its own dependency array.
  const renderPlots = useCallback((fitView: boolean) => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L) return

    if (plotLayerGroupRef.current) {
      plotLayerGroupRef.current.clearLayers()
    } else {
      plotLayerGroupRef.current = L.layerGroup().addTo(map)
    }
    const group = plotLayerGroupRef.current

    const bounds: any[] = []

    plotsRef.current.forEach(plot => {
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
          }).addTo(group)

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
        const marker = L.marker([plot.gps_latitude, plot.gps_longitude]).addTo(group)
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

    // Auto-fit to bounds only on the initial draw — re-fitting every time
    // this runs (e.g. after a background data refresh) would yank the
    // officer's current pan/zoom out from under them. Capped at 17 for the
    // same reason as the read-only PlotMap component (see its comment): a
    // tight bounding box around one small plot can otherwise push
    // fitBounds well past where Esri has real imagery for many rural areas.
    if (fitView && bounds.length > 0) {
      const flatBounds = bounds.flat()
      const lBounds = L.latLngBounds(flatBounds as any)
      map.fitBounds(lBounds, { padding: [30, 30], maxZoom: 17 })
    }
  }, [])

  // ── Init Leaflet — runs exactly once per mount ─────────────────────────────
  // Previously this effect's dependency array was `[plots]`. Since `plots`
  // arrives from a parent that recomputes it with `.filter().map()` on every
  // render (a new array reference every time even when the underlying data
  // is unchanged), that dependency caused this whole effect — tile layers,
  // event listeners, and all — to tear down and reinitialize on every single
  // parent re-render (router.refresh() after a save, a revalidated server
  // component, React Strict Mode's double-invoke in dev, etc.).
  //
  // Worse, because `initMap` is async (it awaits `import('leaflet')`), a
  // teardown could fire *while a previous init was still in flight*: the
  // cleanup function nulls out mapRef.current, but the still-running old
  // initMap() promise later does `mapRef.current = map` anyway with its own
  // (now-orphaned) map instance — silently replacing the new map with a
  // stale, disconnected one. Depending on timing this could leave the
  // container with no live map attached at all, which is exactly the
  // intermittent blank-white-canvas symptom reported here. Locking this
  // effect to `[]` makes it truly mount-once; `plots` updates are now
  // handled by the separate renderPlots effect below, which redraws
  // markers/polygons in place without touching the map or tile layers.
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
        const validCoords = plotsRef.current.filter(p => p.gps_latitude && p.gps_longitude)
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
        const esriSat = createOfflineTileLayer(
          L,
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19 },
          null,
          true // detectNoImagery — see the zoom-ceiling note above esriLayerRef
        )
        // Labels
        const esriLabels = createOfflineTileLayer(
          L,
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19, opacity: 0.8 },
          null
        )
        const osm = createOfflineTileLayer(
          L,
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { maxZoom: 19 },
          null
        )

        esriSat.addTo(map)
        esriLabels.addTo(map)
        esriLayerRef.current = esriSat
        labelsLayerRef.current = esriLabels
        osmLayerRef.current = osm

        // Auto-fallback if satellite tiles keep failing — this view
        // previously had no error handling at all. Same relative-threshold
        // logic as PlotBoundaryMapper: an absolute error count never fires
        // reliably on a small/just-mounted viewport, so we track errors
        // against how many tiles were actually requested instead.
        //
        // Falls back through two tiers, not straight to OSM — see the
        // matching comment in PlotBoundaryMapper.tsx: Sentinel-2 (uniform
        // real coverage everywhere, just coarser) before OSM (last resort,
        // no satellite context at all).
        let satRequested = 0
        let satErrors = 0
        let fellBackToSentinel = false
        let fellBackToOsm = false
        const fallBackToOsmFinal = () => {
          if (destroyedRef.current || fellBackToOsm) return
          fellBackToOsm = true
          try {
            if (sentinelLayerRef.current && map.hasLayer(sentinelLayerRef.current)) {
              map.removeLayer(sentinelLayerRef.current)
            } else if (map.hasLayer(esriSat)) {
              esriSat.remove(); esriLabels.remove()
            }
            osm.addTo(map)
            setMapType('street')
            map.setMaxZoom(ESRI_NOMINAL_MAX_ZOOM)
          } catch (e) {
            console.error('[fleet-map] fallBackToOsmFinal failed:', e)
          }
        }
        const fallBackToSentinel = () => {
          if (destroyedRef.current || fellBackToSentinel || !map.hasLayer(esriSat)) return
          fellBackToSentinel = true
          try {
            esriSat.remove(); esriLabels.remove()
            const sentinelUrl = sentinelTileUrlTemplate()
            if (!sentinelUrl) { fallBackToOsmFinal(); return }
            const sentinel = createOfflineTileLayer(L, sentinelUrl, { maxZoom: 20, maxNativeZoom: 16 }, null, false)
            let sentinelErrors = 0
            sentinel.on('tileerror', () => {
              sentinelErrors += 1
              if (sentinelErrors >= 3) fallBackToOsmFinal()
            })
            sentinelLayerRef.current = sentinel
            sentinel.addTo(map)
            // Still "satellite" from the officer's perspective — mapType
            // deliberately unchanged.
          } catch (e) {
            console.error('[fleet-map] fallBackToSentinel failed:', e)
          }
        }
        esriSat.on('tileloadstart', () => { satRequested += 1 })
        esriLabels.on('tileloadstart', () => { satRequested += 1 })
        const onSatError = () => {
          if (destroyedRef.current) return
          satErrors += 1
          const enoughAbsolute = satErrors >= 5
          const enoughRelative = satErrors >= 3 && satErrors >= Math.ceil(satRequested * 0.6)
          if (enoughAbsolute || enoughRelative) fallBackToSentinel()
        }
        esriSat.on('tileerror', onSatError)
        esriLabels.on('tileerror', onSatError)

        // Zoom-ceiling: reactive, not probed. A fleet map spans however many
        // member plots are scattered across the cooperative's area, so
        // there isn't one ceiling for the whole map — this just clamps
        // down (per the same 2-in-a-row rule as PlotBoundaryMapper) once
        // real placeholder tiles are actually seen at whatever zoom the
        // officer is currently panned/zoomed to, and resets the moment
        // they zoom to a different level.
        esriSat.on('tileplaceholder', () => {
          if (destroyedRef.current) return
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
              setAtImageryCeiling(map.getZoom() >= ceiling)

              // Second reduction in a row means Esri has no real coverage
              // here at any zoom, not just "too tight" — see the matching
              // comment in PlotBoundaryMapper.tsx.
              ceilingReductionsRef.current += 1
              if (ceilingReductionsRef.current >= 2) fallBackToSentinel()
            }
          } catch (e) {
            console.error('[fleet-map] tileplaceholder handling failed:', e)
          }
        })
        map.on('zoom', () => {
          const onSatellite = !!esriLayerRef.current && map.hasLayer(esriLayerRef.current)
          setAtImageryCeiling(onSatellite && map.getZoom() >= satelliteZoomCeilingRef.current)
        })

        // Plot polygons and markers — drawn via the shared renderPlots()
        // callback (see above) into their own layer group, rather than
        // inline here, so a later `plots` prop change can redraw them
        // without rebuilding the map or tile layers.
        leafletRef.current = L
        mapRef.current = map
        renderPlots(true)
        setMapLoaded(true)
      } catch (err) {
        console.error('Leaflet initialization failed:', err)
      }
    }

    initMap()

    return () => {
      destroyedRef.current = true
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {}
        mapRef.current = null
      }
      leafletRef.current = null
      plotLayerGroupRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — see comment above: intentionally mount-once

  // ── Redraw markers when `plots` actually changes ───────────────────────────
  // Runs after the map exists, and only touches the plot layer group — the
  // map instance and tile layers are untouched, so this can never race with
  // (or repeat) the init effect above. `fitView: false` deliberately doesn't
  // recenter/rezoom on every redraw, so an officer's current pan/zoom
  // survives a background data refresh.
  useEffect(() => {
    if (!mapLoaded) return
    renderPlots(false)
  }, [plots, mapLoaded, renderPlots])

  // ── Keep Leaflet's internal size in sync with its container ───────────────
  // Same fix as PlotBoundaryMapper.tsx: Leaflet only reads its container's
  // pixel size once, at L.map() time. This view is dropped into a dashboard
  // grid/card layout, so the container isn't guaranteed to have its final
  // size in the same tick the map is constructed. invalidateSize() recomputes
  // the tile grid for whatever size the container actually is; ResizeObserver
  // also catches later layout shifts (sidebar collapse, window resize).
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

  function toggleMapType() {
    const map = mapRef.current
    if (!map) return
    if (mapType === 'satellite') {
      if (esriLayerRef.current) map.removeLayer(esriLayerRef.current)
      if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current)
      if (sentinelLayerRef.current) map.removeLayer(sentinelLayerRef.current)
      if (osmLayerRef.current) osmLayerRef.current.addTo(map)
      setMapType('street')
      map.setMaxZoom(ESRI_NOMINAL_MAX_ZOOM) // OSM's coverage doesn't have this problem — lift the cap
      setAtImageryCeiling(false)
    } else {
      if (osmLayerRef.current) map.removeLayer(osmLayerRef.current)
      if (esriLayerRef.current) esriLayerRef.current.addTo(map)
      if (labelsLayerRef.current) labelsLayerRef.current.addTo(map)
      setMapType('satellite')
      // Give a manually-requested retry a fresh chance before any future
      // auto-fallback fires again.
      ceilingReductionsRef.current = 0
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
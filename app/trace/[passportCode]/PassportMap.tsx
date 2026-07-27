'use client'

/**
 * app/trace/[passportCode]/PassportMap.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight Leaflet map showing the cooperative origin on the consumer-
 * facing Coffee Digital Passport.
 *
 * Key fixes vs the previous version
 * ──────────────────────────────────
 * 1. Leaflet CSS is imported via `import('leaflet/dist/leaflet.css')` — the
 *    bundled copy that ships with the `leaflet` npm package.  The previous
 *    version injected a <link> pointing at unpkg.com AFTER map init; that
 *    CDN domain is not in the app's CSP style-src, so the stylesheet was
 *    silently blocked, producing a white map with no tile grid.
 *
 * 2. The map container has an explicit pixel height via inline style.
 *    `h-full` alone resolves to 0px when the parent hasn't laid out yet
 *    (the component mounts inside a conditionally-rendered tab), so Leaflet
 *    computed a 0×0 viewport and never requested any tiles.
 *
 * 3. `map.invalidateSize()` is called after mount via requestAnimationFrame
 *    AND a ResizeObserver, so Leaflet re-computes the tile grid whenever the
 *    container's real pixel size becomes known.
 *
 * 4. The previous version only called autoLocate once with no retry and no
 *    `map.setView` fallback — if the dynamic import settled before the
 *    container had its final size the initial tile request was for 0×0.
 *
 * 5. Esri/Sentinel/OSM fallback chain — this is the ONE map view in the app
 *    that, until now, had none of the "no imagery here" protection every
 *    other view has (PlotBoundaryMapper, CoopFleetMap, the plots/[plotId]
 *    and eudr-check PlotMap components). Esri's World Imagery returns a
 *    valid 200 OK placeholder tile — not an error — past its real coverage
 *    ceiling for a given location, which is common over rural Kenyan
 *    farmland. Because this is the one map every buyer and consumer sees
 *    on the public passport (scan-a-QR-code path, zero chance to retry via
 *    a "map this plot" flow), it's the single worst place in the app for
 *    that bug class to be unguarded — see createOfflineTileLayer in
 *    lib/offline-tile-layer.ts for the actual placeholder-detection logic
 *    this now shares with every other map view. Falls back Esri → Sentinel-2
 *    (real, if coarser, global coverage) → OSM street (last resort), same
 *    two-tier chain as everywhere else, with a small manual satellite/street
 *    toggle as the buyer's own escape hatch.
 *
 * Dynamic import only — never SSR'd.
 */

import { useEffect, useRef, useState } from 'react'
import { createOfflineTileLayer } from '@/lib/offline-tile-layer'
import { sentinelTileUrlTemplate } from '@/lib/sentinel-tile-url'

interface Props {
  lat: number
  lng: number
  label: string
  /** Height of the map in pixels. Defaults to 224 (= Tailwind h-56). */
  heightPx?: number
}

export default function PassportMap({ lat, lng, label, heightPx = 224 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const esriLayerRef = useRef<any>(null)
  const labelsLayerRef = useRef<any>(null)
  const osmLayerRef = useRef<any>(null)
  const sentinelLayerRef = useRef<any>(null)
  // Flipped true in the effect's cleanup — see the matching field in
  // PlotBoundaryMapper.tsx / CoopFleetMap.tsx. Guards the tileplaceholder/
  // fallback callbacks below, which can still fire from an in-flight async
  // detection fetch after this component has unmounted (e.g. the buyer
  // navigates away from the passport before tiles finish loading).
  const destroyedRef = useRef(false)
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')
  const [showToggle, setShowToggle] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false
    destroyedRef.current = false

    ;(async () => {
      try {
        // Leaflet's base stylesheet is imported once, globally, in
        // app/globals.css — it must be present before ANY map mounts,
        // and a static global import is the only reliable way to
        // guarantee that (see globals.css for why the per-component
        // dynamic `import('leaflet/dist/leaflet.css')` this used to do
        // here was the actual root cause of blank/unstyled maps).
        const L = (await import('leaflet')).default

        if (cancelled || !containerRef.current || mapRef.current) return

        // 2. Fix broken webpack asset paths for default marker images.
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // 3. Create the map — dark background so it looks intentional while tiles load.
        const map = L.map(containerRef.current, {
          center:           [lat, lng],
          zoom:             13,
          zoomControl:      false,
          attributionControl: false,
          scrollWheelZoom:  false,
          doubleClickZoom:  false,
          dragging:         true,
          touchZoom:        true,
          fadeAnimation:    false, // avoids a flash of Leaflet's default pane bg
        })

        // Match the passport's dark theme — visible before any tile loads.
        map.getContainer().style.background = '#0A0C10'

        // 4. Satellite tiles (Esri World Imagery) — already allowed in CSP
        //    img-src and connect-src. Routed through the same offline-aware,
        //    placeholder-detecting tile layer every other map view uses (no
        //    plot to key an offline cache by here, so `meta` is null — this
        //    behaves like a plain tile layer except for the placeholder
        //    detection, which is independent of caching).
        const ESRI_NOMINAL_MAX_ZOOM = 19
        const satelliteZoomCeilingRef = { current: ESRI_NOMINAL_MAX_ZOOM }
        const placeholderCountAtZoomRef = { current: { zoom: -1, count: 0 } }
        const ceilingReductionsRef = { current: 0 }

        const esriSat = createOfflineTileLayer(
          L,
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19 },
          null,
          true // detectNoImagery
        )
        // Thin boundary/label overlay on top of satellite
        const esriLabels = createOfflineTileLayer(
          L,
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19, opacity: 0.7 },
          null
        )
        const osm = createOfflineTileLayer(
          L,
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { maxZoom: 19 },
          null
        )

        // Same relative-threshold fallback chain as PlotBoundaryMapper /
        // CoopFleetMap / the plot detail PlotMap views — see their comments
        // for why relative-to-requested (not an absolute count) and why
        // Sentinel-2 before OSM. This is a small, mostly-static passport
        // widget rather than an interactive drawing surface, so it skips
        // the offline tile cache (no plotId to key it by) but keeps the
        // exact same detection/fallback behaviour.
        let satRequested = 0
        let satErrors = 0
        let fellBackToSentinel = false
        let fellBackToOsm = false
        const countSatRequest = () => { satRequested += 1 }

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
            setShowToggle(true)
          } catch (e) {
            console.error('[PassportMap] fallBackToOsmFinal failed:', e)
          }
        }
        const fallBackToSentinel = () => {
          if (destroyedRef.current || fellBackToSentinel || !map.hasLayer(esriSat)) return
          fellBackToSentinel = true
          try {
            esriSat.remove(); esriLabels.remove()
            const sentinelUrl = sentinelTileUrlTemplate()
            if (!sentinelUrl) { fallBackToOsmFinal(); return } // no Supabase URL configured — skip straight to OSM
            const sentinel = createOfflineTileLayer(L, sentinelUrl, { maxZoom: 20, maxNativeZoom: 16 }, null, false)
            let sentinelErrors = 0
            sentinel.on('tileerror', () => {
              sentinelErrors += 1
              if (sentinelErrors >= 3) fallBackToOsmFinal()
            })
            sentinelLayerRef.current = sentinel
            sentinel.addTo(map)
            // Still "satellite" from the buyer's perspective — Sentinel-2 is
            // satellite imagery too, just a different, always-covered
            // provider — mapType deliberately unchanged.
            setShowToggle(true)
          } catch (e) {
            console.error('[PassportMap] fallBackToSentinel failed:', e)
          }
        }
        const onSatError = () => {
          if (destroyedRef.current) return
          satErrors += 1
          const enoughAbsolute = satErrors >= 5
          const enoughRelative = satErrors >= 3 && satErrors >= Math.ceil(satRequested * 0.6)
          if (enoughAbsolute || enoughRelative) fallBackToSentinel()
        }

        // Only treat a placeholder as real evidence of "no imagery past this
        // zoom" once seen more than once at the same zoom level — see the
        // matching comment in PlotBoundaryMapper.tsx.
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
              ceilingReductionsRef.current += 1
              if (ceilingReductionsRef.current >= 2) fallBackToSentinel()
            }
          } catch (e) {
            console.error('[PassportMap] tileplaceholder handling failed:', e)
          }
        })

        esriSat.addTo(map)
        esriLabels.addTo(map)
        esriLayerRef.current = esriSat
        labelsLayerRef.current = esriLabels
        osmLayerRef.current = osm

        esriSat.on('tileloadstart', countSatRequest)
        esriLabels.on('tileloadstart', countSatRequest)
        esriSat.on('tileerror', onSatError)
        esriLabels.on('tileerror', onSatError)

        // 5. Custom parchment-pin marker — matches the passport's #C9A96E accent.
        const icon = L.divIcon({
          html: `
            <div style="
              position:relative;
              width:32px;height:40px;
            ">
              <!-- Pin body -->
              <div style="
                position:absolute;top:0;left:0;
                width:32px;height:32px;border-radius:50% 50% 50% 0;
                background:#C9A96E;border:2.5px solid rgba(255,255,255,0.85);
                transform:rotate(-45deg);
                box-shadow:0 3px 12px rgba(0,0,0,0.55),0 1px 3px rgba(0,0,0,0.3);
              "></div>
              <!-- Inner dot -->
              <div style="
                position:absolute;top:8px;left:8px;
                width:12px;height:12px;border-radius:50%;
                background:rgba(255,255,255,0.9);
              "></div>
            </div>`,
          className: '',
          iconSize:   [32, 40],
          iconAnchor: [16, 40],
          popupAnchor:[0, -40],
        })

        const marker = L.marker([lat, lng], { icon }).addTo(map)

        // Tooltip label — styled to match the passport dark theme
        if (!document.getElementById('passport-map-styles')) {
          const style = document.createElement('style')
          style.id = 'passport-map-styles'
          style.textContent = `
            .passport-tip {
              background: #0D0F14 !important;
              border: 1px solid rgba(201,169,110,0.35) !important;
              color: #C9A96E !important;
              font-size: 10px;
              font-weight: 600;
              font-family: 'Outfit', system-ui, sans-serif;
              padding: 3px 8px;
              border-radius: 6px;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            }
            .passport-tip::before { display: none; }
            .passport-tip.leaflet-tooltip-top::before { display: none; }
            .leaflet-control-attribution { display: none !important; }
          `
          document.head.appendChild(style)
        }

        marker.bindTooltip(label, {
          permanent:  true,
          direction:  'top',
          className:  'passport-tip',
          offset:     [0, -4],
        }).openTooltip()

        mapRef.current = map

        // 6. invalidateSize — Leaflet needs to re-read the real container size
        //    after the component has fully painted (it may have been 0×0 when
        //    L.map() was called if the parent tab animated in or was deferred).
        const invalidate = () => { try { map.invalidateSize() } catch {} }
        requestAnimationFrame(invalidate)
        setTimeout(invalidate, 150)
        setTimeout(invalidate, 400)

        // ResizeObserver keeps Leaflet in sync if the panel is resized later.
        let observer: ResizeObserver | null = null
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => invalidate())
          observer.observe(containerRef.current!)
        }

        // Store observer for cleanup
        ;(mapRef.current as any).__observer = observer

      } catch (err) {
        console.error('[PassportMap] init error:', err)
      }
    })()

    return () => {
      cancelled = true
      destroyedRef.current = true
      if (mapRef.current) {
        ;(mapRef.current as any).__observer?.disconnect()
        try { mapRef.current.remove() } catch {}
        mapRef.current = null
      }
      esriLayerRef.current = null
      labelsLayerRef.current = null
      osmLayerRef.current = null
      sentinelLayerRef.current = null
    }
  }, [lat, lng, label]) // eslint-disable-line react-hooks/exhaustive-deps

  // Manual escape hatch — same as every other map view. Only surfaced once
  // the auto-fallback logic above has actually switched away from plain
  // Esri (fellBackToSentinel/fellBackToOsm), since most passports never
  // need it and a button with nothing to toggle to yet would be confusing.
  function toggleMapType() {
    const map = mapRef.current
    if (!map) return
    if (mapType === 'satellite') {
      if (esriLayerRef.current) map.removeLayer(esriLayerRef.current)
      if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current)
      if (sentinelLayerRef.current) map.removeLayer(sentinelLayerRef.current)
      if (osmLayerRef.current) osmLayerRef.current.addTo(map)
      setMapType('street')
    } else {
      if (osmLayerRef.current) map.removeLayer(osmLayerRef.current)
      if (sentinelLayerRef.current) { sentinelLayerRef.current.addTo(map) }
      else if (esriLayerRef.current) { esriLayerRef.current.addTo(map); labelsLayerRef.current?.addTo(map) }
      setMapType('satellite')
    }
  }

  return (
    <div
      style={{ width: '100%', height: heightPx, position: 'relative' }}
    >
      <div
        ref={containerRef}
        // Explicit pixel height so Leaflet always gets a non-zero container at init.
        // The parent wrapper (`<div className="h-56">`) also provides 224px, but
        // Leaflet reads the DOM before CSS layout settles, so we belt-and-brace it.
        style={{ width: '100%', height: heightPx, background: '#0A0C10', position: 'relative' }}
      />
      {showToggle && (
        <button
          type="button"
          onClick={toggleMapType}
          className="absolute top-2 right-2 z-[1000] bg-white text-[10px] font-semibold text-gray-700 px-2 py-1 rounded-md shadow-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          title={mapType === 'satellite' ? 'No imagery here? Switch to street map' : 'Switch to satellite'}
        >
          {mapType === 'satellite' ? 'Street view' : 'Satellite view'}
        </button>
      )}
    </div>
  )
}
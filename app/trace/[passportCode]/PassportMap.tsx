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
 * Dynamic import only — never SSR'd.
 */

import { useEffect, useRef } from 'react'

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    ;(async () => {
      try {
        // 1. Import Leaflet JS + the BUNDLED CSS together before touching the DOM.
        //    This is the fix for the CSP-blocked CDN link and the race where tiles
        //    rendered before the Leaflet stylesheet applied grid-coordinate styles.
        const L = (await import('leaflet')).default
        await import('leaflet/dist/leaflet.css')

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

        // 4. Satellite tiles (Esri World Imagery) — already allowed in CSP img-src
        //    and connect-src. Falls back gracefully if the load fails.
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom:        20,
            maxNativeZoom:  19,
            errorTileUrl:   'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
          }
        ).addTo(map)

        // Thin boundary/label overlay on top of satellite
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom:       20,
            maxNativeZoom: 19,
            opacity:       0.7,
            errorTileUrl:  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
          }
        ).addTo(map)

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
      if (mapRef.current) {
        ;(mapRef.current as any).__observer?.disconnect()
        try { mapRef.current.remove() } catch {}
        mapRef.current = null
      }
    }
  }, [lat, lng, label]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      // Explicit pixel height so Leaflet always gets a non-zero container at init.
      // The parent wrapper (`<div className="h-56">`) also provides 224px, but
      // Leaflet reads the DOM before CSS layout settles, so we belt-and-brace it.
      style={{ width: '100%', height: heightPx, background: '#0A0C10', position: 'relative' }}
    />
  )
}
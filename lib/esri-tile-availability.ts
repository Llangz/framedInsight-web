/**
 * esri-tile-availability.ts — framedInsight
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixes the "map data not yet available" blank-tile bug reported when
 * zooming in to map small plots.
 *
 * ROOT CAUSE: every place this app creates the Esri World Imagery layer
 * (PlotBoundaryMapper, the read-only PlotMap on the plot detail / EUDR
 * check pages) hardcodes `maxNativeZoom: 19` — a single assumption applied
 * uniformly across all of Kenya. In reality Esri's actual high-resolution
 * coverage is wildly uneven: it's genuinely available to z19-20 around
 * Nairobi and major towns, but a lot of rural farmland — exactly where our
 * coffee/dairy/small-ruminant plots are — only has real imagery to
 * somewhere between z13 and z17. Past a location's true ceiling, Esri's
 * tile endpoint does NOT 404 or error; it returns a valid HTTP 200 PNG
 * that reads "Map data not yet available" as a rendered image. Because
 * it's a valid image, `tileerror` never fires, so none of the app's
 * existing OSM-fallback / error-counting logic can ever detect it — the
 * farmer just sees the map blank out one zoom level after imagery was
 * visible fine, with no warning either side of that ceiling.
 *
 * FIX: Esri's own documented mechanism for exactly this problem is the
 * `tilemap` resource — a tiny JSON bitmap of which tiles in a bundle
 * actually contain real data, at a given level, without downloading a
 * full tile image. We binary-search that endpoint to find the highest
 * zoom with real coverage at a given point, then callers clamp the map's
 * `maxZoom` to that ceiling — so a farmer is stopped at the sharpest
 * imagery actually available for their plot, instead of being allowed to
 * zoom one level past it into a blank tile. This replaces guessing at a
 * single static cap (the read-only PlotMap previously used a hardcoded
 * `maxZoom: 17` fitBounds cap, which is both too conservative for the
 * many areas with real z18-19 coverage and still not low enough for the
 * areas that bottom out below z17).
 *
 * Reference: https://developers.arcgis.com/rest/services-reference/enterprise/tile-map/
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TILEMAP_BASE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap'

// Never worth probing below this — Esri's coarse low-resolution mosaic has
// near-universal global coverage by here, including open ocean and deserts.
const MIN_PROBE_ZOOM = 12
// Matches the `maxNativeZoom` this app requests elsewhere — no point probing
// higher than we'd ever actually request a tile at.
const MAX_PROBE_ZOOM = 19
// If probing fails outright (offline, request blocked by a proxy/firewall,
// ArcGIS unreachable), don't leave the farmer unable to map at all — fall
// back to a conservative zoom known to have near-universal coverage across
// Kenyan farmland, matching the previous static behavior rather than
// regressing below it.
const DEFAULT_FALLBACK_ZOOM = 16

function lngLatToTile(lat: number, lng: number, z: number) {
  const latRad = (lat * Math.PI) / 180
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  )
  return { x, y }
}

async function tileHasData(z: number, x: number, y: number): Promise<boolean> {
  try {
    const res = await fetch(`${TILEMAP_BASE}/${z}/${y}/${x}/1/1?f=json`)
    if (!res.ok) return false
    const json = await res.json()
    return Array.isArray(json?.data) && json.data[0] === 1
  } catch {
    // Network error / offline / blocked — treat as "no confirmed data" so
    // the binary search below fails toward the conservative fallback
    // rather than ever reporting a ceiling higher than we could verify.
    return false
  }
}

// In-memory only (per browser session) — probing is a handful of tiny JSON
// requests (a few hundred bytes each), cheap enough not to need persistence,
// but no reason to repeat it while mapping the same plot.
const probeCache = new Map<string, Promise<number>>()

function cacheKey(lat: number, lng: number) {
  // Rounded to ~0.01° (~1km at the equator) — precise enough to distinguish
  // real coverage differences, coarse enough that panning around while
  // mapping a single plot reuses the same result instead of re-probing on
  // every small nudge of the map.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

/**
 * Finds the highest zoom level with real Esri World Imagery coverage at
 * (lat, lng). Always resolves — never rejects — falling back to
 * DEFAULT_FALLBACK_ZOOM if the probe can't complete, so callers never need
 * their own catch handler just to get a usable ceiling.
 */
export function probeMaxAvailableZoom(lat: number, lng: number): Promise<number> {
  const key = cacheKey(lat, lng)
  const cached = probeCache.get(key)
  if (cached) return cached

  const promise = (async () => {
    // Fast path: most plots near a town/trading centre have full coverage,
    // so check the top of the range first and skip the search entirely
    // when it already has data.
    const top = lngLatToTile(lat, lng, MAX_PROBE_ZOOM)
    if (await tileHasData(MAX_PROBE_ZOOM, top.x, top.y)) return MAX_PROBE_ZOOM

    // Esri's basemap coverage is monotonic per location in practice — if a
    // coarser level (lower z) has data, every level below it does too,
    // since lower-resolution mosaics are always published first/more
    // broadly than the high-res overlays. That makes a binary search safe
    // and fast: ~3-4 requests instead of checking each of 12-19 in turn.
    let lo = MIN_PROBE_ZOOM
    let hi = MAX_PROBE_ZOOM - 1
    let best = MIN_PROBE_ZOOM
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const t = lngLatToTile(lat, lng, mid)
      if (await tileHasData(mid, t.x, t.y)) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best
  })().catch(() => DEFAULT_FALLBACK_ZOOM)

  probeCache.set(key, promise)
  return promise
}

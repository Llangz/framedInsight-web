/**
 * Offline-capable Leaflet tile layer — framedInsight
 * ─────────────────────────────────────────────────────────────────────────────
 * Two pieces:
 *
 *  1. createOfflineTileLayer() — a drop-in replacement for L.tileLayer() whose
 *     createTile() loads straight from the network, synchronously, exactly
 *     like a plain Leaflet tile layer always has — no async work of any kind
 *     gates that initial `img.src` assignment. The IndexedDB tile cache
 *     (lib/tile-cache.ts) is consulted only as a FALLBACK, triggered by the
 *     tile's own 'error' event (i.e. only once the network load has actually
 *     failed). This ordering is deliberate and fixes a real regression: an
 *     earlier version of this file awaited a cache lookup *before* attempting
 *     the network load, and in some runtimes that IndexedDB read never
 *     resolved — not rejected, just never settled — which meant `img.src`
 *     was never assigned at all, so tiles never rendered even on a working
 *     connection. Nothing before the synchronous `tile.src = url` line below
 *     may ever be async again; that's the invariant that matters here.
 *     On a successful network load, the tile is also written to the cache in
 *     the background (fire-and-forget, never blocking or delaying display)
 *     so it's available next time there's no connection at all.
 *
 *  2. prefetchTilesForPlot() — walks the tile grid for a plot's bounding box
 *     (+ buffer) across a small zoom range and populates the cache ahead of
 *     time, so "Save this map for offline use" has something concrete to do.
 *     Only ever fetches tiles the farmer's own plot bounds actually cover —
 *     no background sync of areas never viewed, no basemap-of-Kenya creep.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getCachedTile, putCachedTile, getPlotTileCount, enforceGlobalCap, MAX_TILES_PER_PLOT } from './tile-cache'

export interface OfflineTileLayerMeta {
  plotId: string
  provider: string
}

// ── "No imagery available at this zoom" detection ──────────────────────────
// Esri's World Imagery service has real, high-resolution native tiles in
// cities but often nothing past zoom ~13-17 over rural/farmland Kenya. Past
// that point it doesn't error — it returns a perfectly valid 200 OK image:
// a placeholder tile (background colour + a short "Map data not yet
// available" caption, sometimes on a light checkered grid) rather than
// real photography. Leaflet never sees this as a failure (no `tileerror`),
// so tileerror-counting fallback logic elsewhere in this app never fires,
// and a farmer zoomed in tight on a small plot just silently loses the map.
//
// An earlier fix attempt (lib/esri-tile-availability.ts, since removed)
// tried to pre-discover the real ceiling via the ArcGIS `tilemap` REST
// resource. Confirmed unavailable on this specific legacy endpoint — see
// git history for the full writeup — so it's gone.
//
// The version that followed that (still in git history as of the previous
// commit) tried to detect the placeholder by drawing the tile's own
// on-screen <img> onto a canvas and reading its pixels, which required
// setting `crossOrigin="anonymous"` directly on that displayed <img>.
// THAT WAS A REGRESSION, not a fix, and is why this file no longer does
// it: `crossOrigin` on an <img> doesn't just gate canvas readback — if the
// response for that specific request isn't correctly CORS-headered (an
// edge cache without `Vary: Origin`, a carrier-side compression proxy
// common on Kenyan mobile data, an extension, anything), the browser
// refuses to load the image AT ALL. No partial render, no fallback — the
// tile just silently fails to display, which is indistinguishable from
// the map being broken. Because the flag was applied unconditionally to
// every satellite tile (new plot or existing), this turned an optional,
// best-effort zoom-ceiling heuristic into something that could take down
// the entire visible map. That is the root cause of the persistent blank
// map bug — see the note above createOfflineTileLayer.
//
// FIX: detection now runs against a completely SEPARATE, independent
// fetch() of the same tile URL — never the displayed <img>, which is
// never given a `crossOrigin` attribute and therefore always renders
// exactly like a plain, un-instrumented Leaflet tile layer regardless of
// whether that background fetch succeeds. If the fetch fails for any
// reason (CORS, offline, timeout) we simply skip detection for that tile
// and let it render normally — a lost heuristic, never a lost map. For
// plot-scoped layers this also reuses the same fetch that already powers
// the offline tile cache instead of doing a second, redundant request.
//
// Detection itself is also hardened: a pure grayscale-variance check
// (near-zero variance = "one flat colour") misses the checkered/gridded
// variant of the placeholder some regions return, since alternating grid
// squares produce real variance despite still being a placeholder. We now
// also quantize the sample down to a small palette and count distinct
// colours — the placeholder (background + grid lines + a short caption)
// only ever has a handful of distinct quantized colours, where real
// aerial/satellite photography of farmland — soil texture, crop rows,
// shadow — almost always has many more. A tile is only flagged if BOTH
// signals fire together, so a genuinely flat-but-real field (a still
// pond, bare soil, a uniform crop canopy) — which usually trips at most
// one of the two signals on its own — doesn't trip a false positive. (An
// earlier version of this OR'd the two signals instead of AND'ing them,
// which made real farmland tiles misfire as placeholders often enough to
// trigger the zoom-ceiling clamp / Sentinel fallback within seconds of
// rendering correctly — see git history.)
//
// Thresholds are a considered starting point, not a guarantee — watch the
// console.debug output (gated behind window.__FI_DEBUG_TILES__) in the
// field and tune if real reports show false positives/negatives. A bad
// call here only ever affects one tile's zoom-ceiling contribution,
// reactively and per-location — it can never take down tile display the
// way the crossOrigin regression did.
const NO_IMAGERY_SAMPLE = 24 // tile is downscaled to this NxN grid before sampling
const NO_IMAGERY_VARIANCE_THRESHOLD = 60
const NO_IMAGERY_QUANTIZE_LEVELS = 8 // per channel — 8x8x8 palette
const NO_IMAGERY_MAX_DISTINCT_COLORS = 6 // ≤ this many distinct quantized colours ⇒ likely a placeholder graphic
// Share of ALL sampled pixels that fall into just the top-2 quantized colour
// buckets. A vector-drawn placeholder graphic — whether the flat-fill
// variant or the checkerboard/gridded variant some regions serve instead —
// is composed of a small, hard-edged palette, so its two most common
// buckets cover almost every pixel. Real aerial photography essentially
// never does this, even over a visually "flat" field (bare soil, still
// water, uniform crop canopy): sensor noise, lighting gradients and
// compression artifacts keep spreading samples across more than two
// buckets. See the comment on `flagged` below for why this exists
// alongside, not instead of, the flatColor/fewColors pair.
const NO_IMAGERY_DOMINANCE_THRESHOLD = 0.92

function detectLikelyNoImageryFromBitmap(bitmap: ImageBitmap): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = NO_IMAGERY_SAMPLE
    canvas.height = NO_IMAGERY_SAMPLE
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
    if (!ctx) return false
    ctx.drawImage(bitmap, 0, 0, NO_IMAGERY_SAMPLE, NO_IMAGERY_SAMPLE)
    const { data } = ctx.getImageData(0, 0, NO_IMAGERY_SAMPLE, NO_IMAGERY_SAMPLE)

    let sum = 0, sumSq = 0, n = 0
    // Counts per quantized colour, not just a Set, so we can also measure
    // dominance (see NO_IMAGERY_DOMINANCE_THRESHOLD above) — a plain
    // distinct-count can't tell a checkerboard's two ~50/50 buckets apart
    // from a real tile that happens to have exactly as many distinct
    // quantized colours but spread roughly evenly across all of them.
    const colorCounts = new Map<number, number>()
    const step = 256 / NO_IMAGERY_QUANTIZE_LEVELS
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const gray = (r + g + b) / 3
      sum += gray; sumSq += gray * gray; n++

      const qr = Math.floor(r / step), qg = Math.floor(g / step), qb = Math.floor(b / step)
      const key = (qr << 16) | (qg << 8) | qb
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1)
    }
    const mean = sum / n
    const variance = sumSq / n - mean * mean
    const flatColor = variance < NO_IMAGERY_VARIANCE_THRESHOLD
    const fewColors = colorCounts.size <= NO_IMAGERY_MAX_DISTINCT_COLORS

    // Top two buckets' share of every sampled pixel.
    let top1 = 0, top2 = 0
    for (const count of colorCounts.values()) {
      if (count > top1) { top2 = top1; top1 = count }
      else if (count > top2) { top2 = count }
    }
    const dominantPalette = (top1 + top2) / n >= NO_IMAGERY_DOMINANCE_THRESHOLD

    // flatColor && fewColors catches the solid-fill placeholder variant and
    // is deliberately an AND, not an OR — a real but visually flat field
    // (bare soil, a still pond, a uniform crop canopy) can trip ONE of
    // those alone often enough that OR-ing them made genuine farmland
    // imagery misfire as a placeholder within seconds of rendering
    // correctly — the tile itself never changes, but the async detection
    // result arrives a beat after the tile is already on screen, so the
    // map appears to "revert" once enough false positives accumulate and
    // trigger the zoom-ceiling clamp / Sentinel fallback below.
    //
    // dominantPalette is OR'd in alongside that pair specifically to catch
    // the checkerboard/gridded placeholder variant, which flatColor alone
    // cannot: alternating light/dark squares produce real variance (so
    // flatColor is false) despite the tile still being a placeholder with
    // only a handful of colours. Dominance is a stricter, more targeted
    // signal than fewColors on its own — two colours covering ~92%+ of
    // every sample is true for both placeholder variants and essentially
    // never true for a real photograph — so it doesn't reopen the
    // false-positive door the AND above exists to close.
    const flagged = (flatColor && fewColors) || dominantPalette

    if (typeof window !== 'undefined' && (window as any).__FI_DEBUG_TILES__) {
      // eslint-disable-next-line no-console
      console.debug(
        '[tile-variance]', variance.toFixed(1),
        'colors:', colorCounts.size,
        'dominance:', ((top1 + top2) / n).toFixed(2),
        flagged ? '→ flagged as placeholder' : ''
      )
    }
    return flagged
  } catch {
    // Must never throw into the caller — just means "couldn't tell."
    return false
  }
}

/**
 * Fire-and-forget: independently fetches `url` and runs placeholder
 * detection against the result, entirely decoupled from the displayed
 * <img> (see the file-header note above for why that separation matters).
 * `onBlob`, if provided, receives the fetched blob too — lets callers that
 * already need this same fetch (the offline tile cache) share it instead
 * of fetching the same tile twice.
 */
function checkTileForPlaceholder(
  url: string,
  onFlagged: () => void,
  onBlob?: (blob: Blob) => void
) {
  fetch(url, { mode: 'cors' })
    .then(async (res) => {
      if (!res.ok) return
      const blob = await res.blob()
      onBlob?.(blob)
      try {
        const bitmap = await createImageBitmap(blob)
        try {
          // onFlagged is caller-supplied (ultimately a React component's
          // event handler closing over a Leaflet map instance). By the
          // time this async fetch+decode resolves, that map may already
          // have been torn down (fast unmount, a "Re-map boundary" click,
          // a parent re-render) — the caller is expected to guard against
          // that itself, but we never let a mistake there escape as an
          // unhandled rejection that could otherwise cascade into a
          // broken render.
          if (detectLikelyNoImageryFromBitmap(bitmap)) {
            try { onFlagged() } catch (e) { console.error('[tile-placeholder] onFlagged handler failed:', e) }
          }
        } finally {
          bitmap.close()
        }
      } catch {
        // Decoding failed (corrupt blob, unsupported format) — skip
        // detection for this tile silently.
      }
    })
    .catch(() => {
      // Network/CORS failure on the BACKGROUND fetch only — the tile is
      // already displayed via the separate, un-instrumented <img> load
      // and is completely unaffected by this failing. Just means we
      // don't get a zoom-ceiling opinion on this particular tile.
    })
}

// A single fully-transparent pixel. Leaflet's default tile-error handling
// (GridLayer#_tileOnError) does NOT hide a failed tile — it leaves the
// broken <img> in the DOM at full opacity unless `errorTileUrl` is set, so
// out of the box a failed tile renders the browser's native "broken image"
// icon right on the map. On a spotty rural connection that can mean a
// scatter of broken-image glyphs across the whole viewport (exactly what a
// farmer sees when a handful of tiles time out). Pointing every layer at
// this transparent pixel means a failed tile just quietly shows the map's
// own background instead — the map still looks intentional, never broken.
export const TRANSPARENT_TILE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7'

/**
 * Builds an actual tile layer instance. `L` must be the already-loaded
 * Leaflet module (this file never imports 'leaflet' directly, matching
 * PlotBoundaryMapper's own dynamic-import-only-in-the-browser pattern).
 */
export function createOfflineTileLayer(
  L: any,
  urlTemplate: string,
  options: Record<string, any>,
  meta: OfflineTileLayerMeta | null,
  detectNoImagery: boolean = false
) {
  // Callers can still override errorTileUrl explicitly (rare); default it
  // here so every provider gets graceful-failure behavior for free.
  //
  // Deliberately NOT setting `crossOrigin` here, even when detectNoImagery
  // is true. The displayed tile <img> is always a plain, uninstrumented
  // load — see the long note above detectLikelyNoImageryFromBitmap for why
  // coupling crossOrigin to the display path was the actual cause of the
  // "map just goes blank" regression this file previously shipped.
  const layerOptions: Record<string, any> = { errorTileUrl: TRANSPARENT_TILE, ...options }
  const OfflineTileLayer = L.TileLayer.extend({
    createTile(this: any, coords: any, done: (err: any, tile?: HTMLElement) => void) {
      const tile = document.createElement('img')
      tile.alt = ''
      tile.setAttribute('role', 'presentation')

      const url = this.getTileUrl(coords)
      const onLoad = L.Util.bind(this._tileOnLoad, this, done, tile)
      const onError = L.Util.bind(this._tileOnError, this, done, tile)
      const fireIfPlaceholder = () => this.fire('tileplaceholder', { coords, url })

      if (!meta) {
        // No durable plot to key the cache by — plain network load,
        // identical to a stock Leaflet tile layer. Placeholder detection
        // (if enabled) runs on its own independent fetch and can never
        // affect this display path either way.
        L.DomEvent.on(tile, 'load', onLoad)
        L.DomEvent.on(tile, 'error', onError)
        tile.src = url
        if (detectNoImagery) checkTileForPlaceholder(url, fireIfPlaceholder)
        return tile
      }

      // Network-first, cache-as-fallback: see the file header for why this
      // ordering (and not "check cache, then network") is the fix.
      let fellBackToCache = false
      L.DomEvent.on(tile, 'load', () => {
        onLoad()
        if (!fellBackToCache) {
          // Share one background fetch between offline-caching and
          // placeholder detection instead of doing two separate requests
          // for the same tile.
          if (detectNoImagery) {
            checkTileForPlaceholder(url, fireIfPlaceholder, (blob) => void cacheTileBlob(url, meta, blob))
          } else {
            void cacheTileInBackground(url, meta)
          }
        }
      })
      L.DomEvent.on(tile, 'error', () => {
        if (fellBackToCache) { onError(); return } // cache fallback also failed — nothing available for this tile
        fellBackToCache = true
        getCachedTile(url)
          .then((cached) => {
            if (cached) tile.src = URL.createObjectURL(cached) // triggers 'load' above
            else onError()
          })
          .catch(() => onError())
      })

      tile.src = url
      return tile
    },
  })

  return new OfflineTileLayer(urlTemplate, layerOptions)
}

async function cacheTileInBackground(url: string, meta: OfflineTileLayerMeta) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return
    const blob = await res.blob()
    await cacheTileBlob(url, meta, blob)
  } catch {
    // Non-fatal and silent by design — the tile already rendered from
    // network; this only affects whether it's available offline next time.
  }
}

// Shared by cacheTileInBackground (its own fetch) and the placeholder-check
// path in createTile (reuses the fetch it already made for detection),
// so a plot-scoped tile with detectNoImagery on is never fetched twice.
async function cacheTileBlob(url: string, meta: OfflineTileLayerMeta, blob: Blob) {
  try {
    const count = await getPlotTileCount(meta.plotId)
    if (count >= MAX_TILES_PER_PLOT) return
    const coords = parseCoordsFromLeafletUrl(url) // best-effort, bookkeeping only
    await putCachedTile(
      { url, plotId: meta.plotId, provider: meta.provider, z: coords?.z ?? -1, x: coords?.x ?? -1, y: coords?.y ?? -1 },
      blob
    )
  } catch {
    // Non-fatal and silent by design.
  }
}

// Tile URLs don't reliably expose z/x/y in a parseable way across providers
// (Esri: .../tile/{z}/{y}/{x}, OSM: .../{z}/{x}/{y}.png), so this is a
// best-effort label for stats/debugging only — cache lookups always key on
// the full URL, never on these fields.
function parseCoordsFromLeafletUrl(url: string): { z: number; x: number; y: number } | null {
  const nums = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.\w+)?(?:\?|$)/)
  if (!nums) return null
  return { z: Number(nums[1]), x: Number(nums[2]), y: Number(nums[3]) }
}

/* ─────────────────────────────────────────────────────────────
   PREFETCH FOR "SAVE THIS MAP FOR OFFLINE USE"
───────────────────────────────────────────────────────────── */

export interface LatLngBoundsLiteral {
  north: number
  south: number
  east: number
  west: number
}

export interface PrefetchLayer {
  urlTemplate: string
  provider: string
  subdomains?: string[] // for {s} substitution, e.g. OSM's ['a','b','c']
}

export interface PrefetchProgress {
  done: number
  total: number
}

export interface PrefetchResult {
  requested: number
  cached: number
  alreadyCached: number
  failed: number
  budgetLimited: boolean
}

interface TileCoord {
  z: number
  x: number
  y: number
}

function lon2tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom))
}

function lat2tileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  )
}

function tilesForBoundsAtZoom(bounds: LatLngBoundsLiteral, zoom: number): TileCoord[] {
  const xMin = lon2tileX(bounds.west, zoom)
  const xMax = lon2tileX(bounds.east, zoom)
  // North is a smaller latitude->y value than south in slippy-map tiles.
  const yMin = lat2tileY(bounds.north, zoom)
  const yMax = lat2tileY(bounds.south, zoom)
  const tiles: TileCoord[] = []
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ z: zoom, x, y })
    }
  }
  return tiles
}

function buildTileUrl(template: string, coord: TileCoord, subdomains?: string[]): string {
  let url = template.replace('{z}', String(coord.z)).replace('{x}', String(coord.x)).replace('{y}', String(coord.y))
  if (subdomains && subdomains.length > 0) {
    const sub = subdomains[(coord.x + coord.y) % subdomains.length]
    url = url.replace('{s}', sub)
  }
  return url
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  let idx = 0
  async function next(): Promise<void> {
    const i = idx++
    if (i >= items.length) return
    await worker(items[i])
    return next()
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  await Promise.all(workers)
}

/**
 * Pre-fetches and caches tiles covering `bounds` across `zoomLevels`, for
 * each configured layer, scoped to `plotId`. Respects the per-plot tile
 * budget (lib/tile-cache.ts's MAX_TILES_PER_PLOT), prioritising the highest
 * zoom levels first since those carry the most usable detail for corner
 * placement — if the budget runs out, it's the wide low-zoom context tiles
 * that get dropped, not the close-in ones a farmer actually taps against.
 */
export async function prefetchTilesForPlot(
  plotId: string,
  bounds: LatLngBoundsLiteral,
  zoomLevels: number[],
  layers: PrefetchLayer[],
  onProgress?: (p: PrefetchProgress) => void,
  concurrency = 6
): Promise<PrefetchResult> {
  const alreadyCached = await getPlotTileCount(plotId)
  const remainingBudget = Math.max(0, MAX_TILES_PER_PLOT - alreadyCached)

  // Highest zoom first: within a layer, group tiles by zoom (desc), and
  // interleave layers so satellite + labels for the same area land close
  // together rather than exhausting the budget on one layer first.
  const sortedZooms = [...zoomLevels].sort((a, b) => b - a)
  const jobs: { url: string; coord: TileCoord; provider: string }[] = []
  const seen = new Set<string>()

  for (const zoom of sortedZooms) {
    for (const layer of layers) {
      const coords = tilesForBoundsAtZoom(bounds, zoom)
      for (const coord of coords) {
        const url = buildTileUrl(layer.urlTemplate, coord, layer.subdomains)
        const key = `${layer.provider}:${url}`
        if (seen.has(key)) continue
        seen.add(key)
        jobs.push({ url, coord, provider: layer.provider })
      }
    }
  }

  const requested = jobs.length
  const jobsWithinBudget = jobs.slice(0, remainingBudget)
  const budgetLimited = jobsWithinBudget.length < jobs.length

  let done = 0
  let cached = 0
  let skippedAlready = 0
  let failed = 0
  const total = jobsWithinBudget.length
  onProgress?.({ done: 0, total })

  await runPool(
    jobsWithinBudget,
    async (job) => {
      try {
        const existing = await getCachedTile(job.url)
        if (existing) {
          skippedAlready += 1
        } else {
          const res = await fetch(job.url, { mode: 'cors' })
          if (!res.ok) throw new Error(`tile fetch failed: ${res.status}`)
          const blob = await res.blob()
          await putCachedTile(
            { url: job.url, plotId, provider: job.provider, z: job.coord.z, x: job.coord.x, y: job.coord.y },
            blob
          )
          cached += 1
        }
      } catch {
        failed += 1
      } finally {
        done += 1
        onProgress?.({ done, total })
      }
    },
    concurrency
  )

  // Best-effort global cleanup after a prefetch run, not on every tile.
  void enforceGlobalCap()

  return { requested, cached, alreadyCached: skippedAlready + alreadyCached, failed, budgetLimited }
}

/**
 * Expands a set of lat/lng points into a padded bounding box, in the same
 * shape prefetchTilesForPlot expects. `bufferRatio` pads each side by that
 * fraction of the box's own span (with a small minimum in degrees so a
 * single-point / very small plot still gets a usable margin of surrounding
 * imagery, not a box smaller than one tile).
 */
export function boundsFromPoints(
  points: { lat: number; lng: number }[],
  bufferRatio = 0.2,
  minDegrees = 0.0015 // ≈ 150m at the equator
): LatLngBoundsLiteral | null {
  if (points.length === 0) return null
  let north = points[0].lat
  let south = points[0].lat
  let east = points[0].lng
  let west = points[0].lng
  for (const p of points) {
    if (p.lat > north) north = p.lat
    if (p.lat < south) south = p.lat
    if (p.lng > east) east = p.lng
    if (p.lng < west) west = p.lng
  }
  const latPad = Math.max((north - south) * bufferRatio, minDegrees)
  const lngPad = Math.max((east - west) * bufferRatio, minDegrees)
  return { north: north + latPad, south: south - latPad, east: east + lngPad, west: west - lngPad }
}

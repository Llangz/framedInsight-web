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
// a flat tan placeholder tile reading "Map data not yet available". Leaflet
// never sees this as a failure (no `tileerror`), so tileerror-counting
// fallback logic elsewhere in this app never fires, and a farmer zoomed in
// tight on a small plot just silently loses the map.
//
// An earlier fix attempt (lib/esri-tile-availability.ts, since removed)
// tried to pre-discover the real ceiling via the ArcGIS `tilemap` REST
// resource. That resource is genuinely how Esri recommends solving this —
// but it's an *optional* capability, and confirmed (via this service's own
// REST directory listing at server.arcgisonline.com/.../World_Imagery/
// MapServer — its "Supported Operations" list has no Tilemap entry) that
// this specific legacy endpoint doesn't expose it. Every probe request
// therefore silently failed (404), and the "discovered" ceiling collapsed
// to the same hardcoded floor for every location on earth — clamping every
// plot, everywhere, to a country-wide zoom regardless of real coverage.
// That's a worse regression than the original bug (it broke tight mapping
// even in well-covered areas), which is why it's gone rather than tuned.
//
// This replaces it with detection that doesn't depend on any Esri REST
// capability at all: it looks at the actual pixels of tiles that load. The
// placeholder is a near-flat graphic (background colour + a short line of
// text); real aerial/satellite photography — even a plain dirt field —
// still has meaningful pixel-to-pixel variance from soil texture, crop
// rows, and shadow. We downscale each tile to a small grid and measure
// grayscale variance across it: a value near zero means "essentially one
// flat colour", which is what the placeholder is and real photography
// essentially never is. This runs against a tile the browser already
// downloaded (no extra request, unlike the tilemap probe) and only needs
// `crossOrigin` set — Esri's tile servers are CORS-enabled, which the
// existing cacheTileInBackground() fetch() below already relies on.
//
// The threshold is a considered starting point, not a guarantee — it
// should be watched in the field (see the console.debug below, gated
// behind NEXT_PUBLIC_DEBUG_TILES) and tuned if real reports show either
// false positives (a genuinely flat, recently-tilled field wrongly
// flagged) or false negatives (a placeholder tile slipping through). But
// unlike the tilemap probe, a bad call here only affects one tile's
// zoom-ceiling contribution, reactively and per-location — it can't
// collapse to one wrong global constant the way the REST probe did.
const NO_IMAGERY_SAMPLE = 24 // tile is downscaled to this NxN grid before sampling
const NO_IMAGERY_VARIANCE_THRESHOLD = 60

function detectLikelyNoImagery(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = NO_IMAGERY_SAMPLE
    canvas.height = NO_IMAGERY_SAMPLE
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, NO_IMAGERY_SAMPLE, NO_IMAGERY_SAMPLE)
    const { data } = ctx.getImageData(0, 0, NO_IMAGERY_SAMPLE, NO_IMAGERY_SAMPLE)
    let sum = 0, sumSq = 0, n = 0
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3
      sum += gray; sumSq += gray * gray; n++
    }
    const mean = sum / n
    const variance = sumSq / n - mean * mean
    if (typeof window !== 'undefined' && (window as any).__FI_DEBUG_TILES__) {
      // eslint-disable-next-line no-console
      console.debug('[tile-variance]', variance.toFixed(1), variance < NO_IMAGERY_VARIANCE_THRESHOLD ? '→ flagged as placeholder' : '')
    }
    return variance < NO_IMAGERY_VARIANCE_THRESHOLD
  } catch {
    // A tainted canvas (CORS not actually applied for some reason) or an
    // unsupported context must never break tile display — just skip
    // detection for this tile and let it render normally either way.
    return false
  }
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
  const layerOptions: Record<string, any> = { errorTileUrl: TRANSPARENT_TILE, ...options }
  if (detectNoImagery) {
    // Required for canvas pixel access (getImageData) on a cross-origin
    // image without tainting the canvas. Esri's tile servers are already
    // known CORS-enabled — see the note above.
    layerOptions.crossOrigin = layerOptions.crossOrigin ?? 'anonymous'
  }
  const OfflineTileLayer = L.TileLayer.extend({
    createTile(this: any, coords: any, done: (err: any, tile?: HTMLElement) => void) {
      const tile = document.createElement('img')
      tile.alt = ''
      tile.setAttribute('role', 'presentation')

      if (this.options.crossOrigin || this.options.crossOrigin === '') {
        tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin
      }

      const url = this.getTileUrl(coords)
      const onLoad = L.Util.bind(this._tileOnLoad, this, done, tile)
      const onError = L.Util.bind(this._tileOnError, this, done, tile)
      const checkForPlaceholder = () => {
        if (detectNoImagery && detectLikelyNoImagery(tile)) {
          this.fire('tileplaceholder', { coords, url })
        }
      }

      if (!meta) {
        // No durable plot to key the cache by — plain network load,
        // identical to a stock Leaflet tile layer.
        L.DomEvent.on(tile, 'load', () => { onLoad(); checkForPlaceholder() })
        L.DomEvent.on(tile, 'error', onError)
        tile.src = url
        return tile
      }

      // Network-first, cache-as-fallback: see the file header for why this
      // ordering (and not "check cache, then network") is the fix.
      let fellBackToCache = false
      L.DomEvent.on(tile, 'load', () => {
        onLoad()
        if (!fellBackToCache) { void cacheTileInBackground(url, meta); checkForPlaceholder() }
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
    const count = await getPlotTileCount(meta.plotId)
    if (count >= MAX_TILES_PER_PLOT) return
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return
    const blob = await res.blob()
    const coords = parseCoordsFromLeafletUrl(url) // best-effort, bookkeeping only
    await putCachedTile(
      { url, plotId: meta.plotId, provider: meta.provider, z: coords?.z ?? -1, x: coords?.x ?? -1, y: coords?.y ?? -1 },
      blob
    )
  } catch {
    // Non-fatal and silent by design — the tile already rendered from
    // network; this only affects whether it's available offline next time.
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

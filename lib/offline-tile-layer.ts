/**
 * Offline-capable Leaflet tile layer — framedInsight
 * ─────────────────────────────────────────────────────────────────────────────
 * Two pieces:
 *
 *  1. createOfflineTileLayer() — a drop-in replacement for L.tileLayer() whose
 *     createTile() checks lib/tile-cache.ts before hitting the network, and
 *     writes successful network fetches back to the cache. When `meta` is
 *     null (no plotId — e.g. a brand-new plot that hasn't been saved yet, so
 *     there's nothing durable to key the cache by), it behaves exactly like a
 *     normal Leaflet tile layer: no caching, no behaviour change. If both the
 *     cache and the network fail, it renders a muted placeholder tile rather
 *     than a broken-image icon, per the goal of degrading gracefully instead
 *     of erroring.
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

const TRANSPARENT_TILE =
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
  meta: OfflineTileLayerMeta | null
) {
  const OfflineTileLayer = L.TileLayer.extend({
    createTile(this: any, coords: any, done: (err: any, tile?: HTMLElement) => void) {
      const tile = document.createElement('img')
      tile.alt = ''
      tile.setAttribute('role', 'presentation')

      L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile))
      L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile))

      if (this.options.crossOrigin || this.options.crossOrigin === '') {
        tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin
      }

      const url = this.getTileUrl(coords)

      if (!meta) {
        // No durable plot to key the cache by — plain network load.
        tile.src = url
        return tile
      }

      loadTile(url, meta, tile)
      return tile
    },
  })

  return new OfflineTileLayer(urlTemplate, options)
}

async function loadTile(url: string, meta: OfflineTileLayerMeta, img: HTMLImageElement) {
  try {
    const cached = await getCachedTile(url)
    if (cached) {
      img.src = URL.createObjectURL(cached)
      return
    }
  } catch {
    // fall through to network
  }

  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`tile fetch failed: ${res.status}`)
    const blob = await res.blob()
    img.src = URL.createObjectURL(blob)
    // Cache in the background — never blocks the tile from rendering, and a
    // failure here is silently non-fatal (see cacheTileIfWithinBudget).
    void cacheTileIfWithinBudget(url, meta, blob)
  } catch {
    // Offline (or the request genuinely failed) and nothing cached for this
    // tile: show a muted placeholder instead of a broken-image icon so the
    // mapper stays usable underneath it.
    img.src = TRANSPARENT_TILE
    img.style.background = 'rgba(15, 23, 42, 0.45)'
  }
}

async function cacheTileIfWithinBudget(url: string, meta: OfflineTileLayerMeta, blob: Blob) {
  try {
    const count = await getPlotTileCount(meta.plotId)
    if (count >= MAX_TILES_PER_PLOT) return
    const coords = parseCoordsFromLeafletUrl(url) // best-effort, only used for bookkeeping
    await putCachedTile(
      { url, plotId: meta.plotId, provider: meta.provider, z: coords?.z ?? -1, x: coords?.x ?? -1, y: coords?.y ?? -1 },
      blob
    )
  } catch {
    // Non-fatal — the tile still rendered from network, it just won't
    // persist for next time.
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

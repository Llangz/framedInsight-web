/**
 * Offline satellite tile cache — framedInsight
 * ─────────────────────────────────────────────────────────────────────────────
 * Persists map tiles (ArcGIS satellite / labels, OSM street) to IndexedDB so a
 * plot's imagery survives a full offline session in the field, once a farmer
 * has opened that plot's map with signal at least once.
 *
 * DELIBERATELY A SEPARATE DATABASE from lib/offline-db.ts's `framedInsightSync`
 * (DB_VERSION 4, mirrored in public/sw.js). That database's history includes a
 * real production bug caused by two independent contexts (main thread + SW
 * thread) each declaring their own onupgradeneeded and drifting out of sync —
 * see the comment block at the top of public/sw.js. Tiles are a fundamentally
 * different kind of data (large blobs, freely re-fetchable, safe to evict) from
 * the CRDT-style offline event log (small JSON records that must survive until
 * synced or a farmer loses real work). Giving tiles their own DB means:
 *   - no shared DB_VERSION to keep in lockstep across two files
 *   - the service worker never needs to know this store exists
 *   - a tile-cache bug can never corrupt or block the sync queue's own opens
 * The cost is one extra IndexedDB connection, which is cheap and normal.
 *
 * STORAGE POLICY (see HANDOFF-offline-tile-caching.md §5 for the full
 * discussion): Esri's World_Imagery ArcGIS Online service and OSM's tile
 * servers are both free public tiers whose terms of use are written around
 * live display, not persistent bulk caching. We stay on the modest/defensible
 * side of that line deliberately: cache only tiles a farmer has actually
 * viewed, scoped per-plot, under a hard per-plot cap AND a global device-
 * storage cap (LRU-evicted by plot, oldest first) — closer to "a browser
 * cache" than "bulk redistribution." This applies identically to every
 * provider cached through this module; there is no separate, looser policy
 * for one provider vs another.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DB_NAME = 'framedInsightTileCache'
const DB_VERSION = 1
const STORE_TILES = 'tiles'

// Per-plot cap: comfortably covers a few zoom levels over a several-hectare
// plot plus buffer (a 4 ha plot's bounding box + 20% buffer at z16-19 is
// usually a few hundred tiles across satellite+labels). Global cap is a
// blunt but simple ceiling so a farmer with 40 plots mapped once each can't
// silently fill their phone's storage — see acceptance criteria §7.
export const MAX_TILES_PER_PLOT = 500
export const MAX_TOTAL_CACHE_BYTES = 150 * 1024 * 1024 // ~150MB across all plots

export interface CachedTileMeta {
  url: string
  plotId: string
  provider: string // e.g. 'esri-satellite' | 'esri-labels' | 'osm'
  z: number
  x: number
  y: number
}

interface TileRecord extends CachedTileMeta {
  bytes: number
  savedAt: number
  blob: Blob
}

export interface PlotTileStats {
  plotId: string
  tileCount: number
  bytes: number
  oldestSavedAt: number | null
  newestSavedAt: number | null
}

let dbPromise: Promise<IDBDatabase> | null = null

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

function openTileCacheDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_TILES)) {
        const store = db.createObjectStore(STORE_TILES, { keyPath: 'url' })
        store.createIndex('by_plot', 'plotId')
        store.createIndex('by_saved_at', 'savedAt')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

/* ─────────────────────────────────────────────────────────────
   READ / WRITE SINGLE TILE
───────────────────────────────────────────────────────────── */

export async function getCachedTile(url: string): Promise<Blob | null> {
  if (!isBrowser()) return null
  try {
    const db = await openTileCacheDB()
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_TILES, 'readonly')
      const req = tx.objectStore(STORE_TILES).get(url)
      req.onsuccess = () => resolve(req.result ? (req.result as TileRecord).blob : null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    // A cache read failure should never block map rendering — callers fall
    // back to network on null.
    return null
  }
}

export async function putCachedTile(meta: CachedTileMeta, blob: Blob): Promise<void> {
  if (!isBrowser()) return
  const db = await openTileCacheDB()
  const record: TileRecord = { ...meta, bytes: blob.size, savedAt: Date.now(), blob }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_TILES, 'readwrite')
    const req = tx.objectStore(STORE_TILES).put(record)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/* ─────────────────────────────────────────────────────────────
   PER-PLOT STATS / MANAGEMENT
───────────────────────────────────────────────────────────── */

export async function getPlotTileCount(plotId: string): Promise<number> {
  if (!isBrowser()) return 0
  try {
    const db = await openTileCacheDB()
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_TILES, 'readonly')
      const req = tx.objectStore(STORE_TILES).index('by_plot').count(IDBKeyRange.only(plotId))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return 0
  }
}

export async function getPlotTileStats(plotId: string): Promise<PlotTileStats> {
  const empty: PlotTileStats = { plotId, tileCount: 0, bytes: 0, oldestSavedAt: null, newestSavedAt: null }
  if (!isBrowser()) return empty
  try {
    const db = await openTileCacheDB()
    return await new Promise<PlotTileStats>((resolve, reject) => {
      const tx = db.transaction(STORE_TILES, 'readonly')
      const req = tx.objectStore(STORE_TILES).index('by_plot').openCursor(IDBKeyRange.only(plotId))
      let tileCount = 0
      let bytes = 0
      let oldest: number | null = null
      let newest: number | null = null
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) { resolve({ plotId, tileCount, bytes, oldestSavedAt: oldest, newestSavedAt: newest }); return }
        const rec = cursor.value as TileRecord
        tileCount += 1
        bytes += rec.bytes
        if (oldest === null || rec.savedAt < oldest) oldest = rec.savedAt
        if (newest === null || rec.savedAt > newest) newest = rec.savedAt
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return empty
  }
}

export async function clearPlotTiles(plotId: string): Promise<number> {
  if (!isBrowser()) return 0
  const db = await openTileCacheDB()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_TILES, 'readwrite')
    const req = tx.objectStore(STORE_TILES).index('by_plot').openCursor(IDBKeyRange.only(plotId))
    let removed = 0
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) { resolve(removed); return }
      cursor.delete()
      removed += 1
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

/* ─────────────────────────────────────────────────────────────
   GLOBAL STORAGE CAP (LRU across plots, oldest tile first)
───────────────────────────────────────────────────────────── */

export async function getTotalCacheBytes(): Promise<number> {
  if (!isBrowser()) return 0
  try {
    const db = await openTileCacheDB()
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_TILES, 'readonly')
      const req = tx.objectStore(STORE_TILES).openCursor()
      let total = 0
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) { resolve(total); return }
        total += (cursor.value as TileRecord).bytes
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return 0
  }
}

/**
 * Evicts the globally-oldest tiles (by savedAt, regardless of which plot
 * they belong to) until total cache size is back under `maxBytes`. Called
 * opportunistically after a prefetch run — not on every single tile write,
 * to avoid a cursor scan per tile.
 */
export async function enforceGlobalCap(maxBytes: number = MAX_TOTAL_CACHE_BYTES): Promise<void> {
  if (!isBrowser()) return
  try {
    const db = await openTileCacheDB()
    let total = await getTotalCacheBytes()
    if (total <= maxBytes) return

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TILES, 'readwrite')
      const req = tx.objectStore(STORE_TILES).index('by_saved_at').openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor || total <= maxBytes) { resolve(); return }
        const rec = cursor.value as TileRecord
        total -= rec.bytes
        cursor.delete()
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Best-effort; a failed eviction pass just means we try again next time.
  }
}

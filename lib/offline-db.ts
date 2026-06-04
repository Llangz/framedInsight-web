/**
 * Offline Sync System (Production-ready)
 * - Generic request queue (legacy support)
 * - Poultry domain event store (CRDT-style offline log)
 * - Safe sync + idempotency support
 */

const DB_NAME = 'framedInsightSync'
const DB_VERSION = 2

const STORE_REQUESTS = 'pendingRequests'
const STORE_POULTRY  = 'poultryOfflineEvents'

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */

export interface PendingRequest {
  id?: number
  url: string
  method: string
  body: any
  headers?: any
  timestamp: number
}

/**
 * Poultry domain event (CRDT-friendly offline log)
 */
export type PoultryEntityType =
  | 'poultry_egg_record'
  | 'poultry_feed_record'
  | 'poultry_mortality'
  | 'poultry_health_record'
  | 'poultry_sale'
  | 'poultry_batch_update'

export interface PoultryOfflineEvent {
  id?: number
  eventId: string
  entityType: PoultryEntityType
  farmId: string
  batchId: string
  payload: Record<string, any>
  timestamp: number
  isoTimestamp: string
  synced: boolean
  retryCount?: number
}

/* ─────────────────────────────────────────────────────────────
   DB INIT (SAFE MIGRATIONS)
───────────────────────────────────────────────────────────── */

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion

      // v1: generic queue
      if (!db.objectStoreNames.contains(STORE_REQUESTS)) {
        db.createObjectStore(STORE_REQUESTS, {
          keyPath: 'id',
          autoIncrement: true
        })
      }

      // v2: poultry event log
      if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_POULTRY)) {
        const store = db.createObjectStore(STORE_POULTRY, {
          keyPath: 'id',
          autoIncrement: true
        })

        store.createIndex('by_entity_type', 'entityType')
        store.createIndex('by_batch', 'batchId')
        store.createIndex('by_farm', 'farmId')
        store.createIndex('by_synced', 'synced')
        store.createIndex('by_event_id', 'eventId', { unique: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/* ─────────────────────────────────────────────────────────────
   GENERIC REQUEST QUEUE (BACKWARD COMPATIBLE)
───────────────────────────────────────────────────────────── */

export async function queueRequest(req: Omit<PendingRequest, 'timestamp'>) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REQUESTS, 'readwrite')
    const store = tx.objectStore(STORE_REQUESTS)

    const request = store.add({
      ...req,
      timestamp: Date.now()
    })

    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
  })
}

export async function getPendingRequests(): Promise<PendingRequest[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REQUESTS, 'readonly')
    const store = tx.objectStore(STORE_REQUESTS)

    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function removeRequest(id: number) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REQUESTS, 'readwrite')
    const store = tx.objectStore(STORE_REQUESTS)

    const request = store.delete(id)

    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
  })
}

/* ─────────────────────────────────────────────────────────────
   POULTRY OFFLINE EVENT SYSTEM (CORE UPGRADE)
───────────────────────────────────────────────────────────── */

export async function queuePoultryEvent(
  event: Omit<PoultryOfflineEvent, 'id' | 'timestamp' | 'isoTimestamp' | 'synced'>
) {
  const db = await initDB()
  const now = new Date()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POULTRY, 'readwrite')
    const store = tx.objectStore(STORE_POULTRY)

    const request = store.add({
      ...event,
      timestamp: now.getTime(),
      isoTimestamp: now.toISOString(),
      synced: false,
      retryCount: 0
    })

    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all unsynced poultry events
 */
export async function getPendingPoultryEvents(): Promise<PoultryOfflineEvent[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POULTRY, 'readonly')
    const index = tx.objectStore(STORE_POULTRY).index('by_synced')

    const request = index.getAll(IDBKeyRange.only(false))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get events for a specific batch (useful for partial sync)
 */
export async function getPoultryEventsByBatch(batchId: string) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POULTRY, 'readonly')
    const index = tx.objectStore(STORE_POULTRY).index('by_batch')

    const request = index.getAll(batchId)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Mark event as synced (idempotent-safe)
 */
export async function markPoultryEventSynced(id: number) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POULTRY, 'readwrite')
    const store = tx.objectStore(STORE_POULTRY)

    const request = store.get(id)

    request.onsuccess = () => {
      const event = request.result
      if (!event) return resolve(true)

      const update = store.put({
        ...event,
        synced: true
      })

      update.onsuccess = () => resolve(true)
      update.onerror = () => reject(update.error)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Increment retry count (useful for failed sync backoff)
 */
export async function incrementRetry(id: number) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POULTRY, 'readwrite')
    const store = tx.objectStore(STORE_POULTRY)

    const request = store.get(id)

    request.onsuccess = () => {
      const event = request.result
      if (!event) return resolve(true)

      const update = store.put({
        ...event,
        retryCount: (event.retryCount || 0) + 1
      })

      update.onsuccess = () => resolve(true)
      update.onerror = () => reject(update.error)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Clean up synced events (run after successful server reconciliation)
 */
export async function clearSyncedPoultryEvents() {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POULTRY, 'readwrite')
    const index = tx.objectStore(STORE_POULTRY).index('by_synced')

    const request = index.openCursor(IDBKeyRange.only(true))

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return resolve(true)

      cursor.delete()
      cursor.continue()
    }

    request.onerror = () => reject(request.error)
  })
}

/* ─────────────────────────────────────────────────────────────
   OFFLINE FETCH (SAFE + STABLE)
───────────────────────────────────────────────────────────── */

export async function fetchWithSync(url: string, options: RequestInit = {}) {
  if (typeof window === 'undefined') {
    return fetch(url, options)
  }

  const method = options.method || 'GET'

  // Try online first
  if (navigator.onLine) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response
    } catch (err) {
      console.warn('Online fetch failed, switching to offline queue', err)
    }
  }

  // Only queue mutations
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    await queueRequest({
      url,
      method,
      body: safeParseBody(options.body),
      headers: options.headers
    })

    return new Response(
      JSON.stringify({
        offline: true,
        message: 'Saved locally. Will sync when online.'
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return fetch(url, options)
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

function safeParseBody(body: any) {
  if (!body) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  return body
}
/**
 * Offline Sync System (Production-ready)
 * - Generic request queue (legacy support)
 * - Poultry domain event store (CRDT-style offline log)
 * - Dairy domain event store
 * - Coffee domain event store
 * - Safe sync + idempotency support
 */

const DB_NAME = 'framedInsightSync'
const DB_VERSION = 4

const STORE_REQUESTS       = 'pendingRequests'
const STORE_POULTRY        = 'poultryOfflineEvents'
const STORE_DAIRY          = 'dairyOfflineEvents'
const STORE_COFFEE         = 'coffeeOfflineEvents'
const STORE_SMALL_RUMINANT = 'smallRuminantOfflineEvents'

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

export type PoultryEntityType =
  | 'poultry_egg_record'
  | 'poultry_feed_record'
  | 'poultry_mortality'
  | 'poultry_health_record'
  | 'poultry_sale'
  | 'poultry_batch_update'

export type DairyEntityType =
  | 'milk_record'
  | 'cow_registration'
  | 'breeding_event'
  | 'health_check'

export type CoffeeEntityType =
  | 'coffee_activity'
  | 'coffee_harvest'
  | 'coffee_spray_event'
  | 'coffee_pruning'

export type SmallRuminantEntityType =
  | 'small_ruminant_health'
  | 'small_ruminant_weight'
  | 'small_ruminant_sale'
  | 'small_ruminant_breeding'

export type OfflineEntityType =
  | PoultryEntityType
  | DairyEntityType
  | CoffeeEntityType
  | SmallRuminantEntityType

export interface OfflineEvent {
  id?: number
  eventId: string
  entityType: OfflineEntityType
  farmId: string
  referenceId?: string
  batchId?: string
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

      // v3: dairy and coffee event logs
      if (oldVersion < 3) {
        // Dairy store
        if (!db.objectStoreNames.contains(STORE_DAIRY)) {
          const store = db.createObjectStore(STORE_DAIRY, {
            keyPath: 'id',
            autoIncrement: true
          })

          store.createIndex('by_entity_type', 'entityType')
          store.createIndex('by_cow', 'referenceId')
          store.createIndex('by_farm', 'farmId')
          store.createIndex('by_synced', 'synced')
          store.createIndex('by_event_id', 'eventId', { unique: true })
        }

        // Coffee store
        if (!db.objectStoreNames.contains(STORE_COFFEE)) {
          const store = db.createObjectStore(STORE_COFFEE, {
            keyPath: 'id',
            autoIncrement: true
          })

          store.createIndex('by_entity_type', 'entityType')
          store.createIndex('by_plot', 'referenceId')
          store.createIndex('by_farm', 'farmId')
          store.createIndex('by_synced', 'synced')
          store.createIndex('by_event_id', 'eventId', { unique: true })
        }
      }

      // v4: small ruminants event log — the one enterprise that previously
      // had no offline queue at all. Health, weight, sale and breeding forms
      // under app/dashboard/smallRuminants/** called server actions directly
      // with no offline fallback, so losing connectivity mid-form meant a
      // failed submit and (depending on the form) a lost record, not a
      // graceful "saved offline" like poultry/dairy/coffee already get.
      if (oldVersion < 4 && !db.objectStoreNames.contains(STORE_SMALL_RUMINANT)) {
        const store = db.createObjectStore(STORE_SMALL_RUMINANT, {
          keyPath: 'id',
          autoIncrement: true
        })

        store.createIndex('by_entity_type', 'entityType')
        store.createIndex('by_animal', 'referenceId')
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
  event: Omit<OfflineEvent, 'id' | 'timestamp' | 'isoTimestamp' | 'synced'> & {
    entityType: PoultryEntityType
  }
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

export async function getPendingPoultryEvents(): Promise<OfflineEvent[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POULTRY, 'readonly')
    const index = tx.objectStore(STORE_POULTRY).index('by_synced')

    const request = index.getAll(IDBKeyRange.only(false))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

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
   DAIRY OFFLINE EVENT SYSTEM
───────────────────────────────────────────────────────────── */

export async function queueDairyEvent(
  event: Omit<OfflineEvent, 'id' | 'timestamp' | 'isoTimestamp' | 'synced'> & {
    entityType: DairyEntityType
  }
) {
  const db = await initDB()
  const now = new Date()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DAIRY, 'readwrite')
    const store = tx.objectStore(STORE_DAIRY)

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

export async function getPendingDairyEvents(): Promise<OfflineEvent[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DAIRY, 'readonly')
    const index = tx.objectStore(STORE_DAIRY).index('by_synced')

    const request = index.getAll(IDBKeyRange.only(false))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function markDairyEventSynced(id: number) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DAIRY, 'readwrite')
    const store = tx.objectStore(STORE_DAIRY)

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

export async function clearSyncedDairyEvents() {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DAIRY, 'readwrite')
    const index = tx.objectStore(STORE_DAIRY).index('by_synced')

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
   COFFEE OFFLINE EVENT SYSTEM
───────────────────────────────────────────────────────────── */

export async function queueCoffeeEvent(
  event: Omit<OfflineEvent, 'id' | 'timestamp' | 'isoTimestamp' | 'synced'> & {
    entityType: CoffeeEntityType
  }
) {
  const db = await initDB()
  const now = new Date()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COFFEE, 'readwrite')
    const store = tx.objectStore(STORE_COFFEE)

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

export async function getPendingCoffeeEvents(): Promise<OfflineEvent[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COFFEE, 'readonly')
    const index = tx.objectStore(STORE_COFFEE).index('by_synced')

    const request = index.getAll(IDBKeyRange.only(false))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function markCoffeeEventSynced(id: number) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COFFEE, 'readwrite')
    const store = tx.objectStore(STORE_COFFEE)

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

export async function clearSyncedCoffeeEvents() {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COFFEE, 'readwrite')
    const index = tx.objectStore(STORE_COFFEE).index('by_synced')

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
   SMALL RUMINANT OFFLINE EVENT SYSTEM
───────────────────────────────────────────────────────────── */

export async function queueSmallRuminantEvent(
  event: Omit<OfflineEvent, 'id' | 'timestamp' | 'isoTimestamp' | 'synced'> & {
    entityType: SmallRuminantEntityType
  }
) {
  const db = await initDB()
  const now = new Date()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SMALL_RUMINANT, 'readwrite')
    const store = tx.objectStore(STORE_SMALL_RUMINANT)

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

export async function getPendingSmallRuminantEvents(): Promise<OfflineEvent[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SMALL_RUMINANT, 'readonly')
    const index = tx.objectStore(STORE_SMALL_RUMINANT).index('by_synced')

    const request = index.getAll(IDBKeyRange.only(false))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function markSmallRuminantEventSynced(id: number) {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SMALL_RUMINANT, 'readwrite')
    const store = tx.objectStore(STORE_SMALL_RUMINANT)

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

export async function clearSyncedSmallRuminantEvents() {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SMALL_RUMINANT, 'readwrite')
    const index = tx.objectStore(STORE_SMALL_RUMINANT).index('by_synced')

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
// v4: fixes a real production bug, not just routine housekeeping — see the
// fetch handler below for the full explanation. v3's cached '/' had gone
// stale relative to every deploy since 2026-07-10 (the last time this file
// itself changed), because a service worker only re-installs when its own
// script bytes differ, never just because the app changed. Any browser
// that had installed v3 kept serving that one frozen HTML snapshot forever
// — cache-first, no revalidation — whose CSS/JS <link>/<script> tags
// pointed at that old build's content-hashed filenames. Vercel's
// production alias only serves the current deployment's files, so those
// old hashed paths return nothing usable: the page loads, structurally
// intact, with zero styling. This version bump is what actually unsticks
// already-affected browsers, by being a byte-different file the browser
// will notice; the activate handler below already tears down any cache
// that doesn't match the current CACHE_NAME, so v3's stale snapshot gets
// deleted automatically on next visit. (This does not touch IndexedDB —
// a farmer's pending offline-queued records live in a completely separate
// storage API and are untouched by this.)
const CACHE_NAME = 'framedinsight-cache-v4';
const OFFLINE_URL = '/offline';

const DB_NAME = 'framedInsightSync';
const STORE_REQUESTS = 'pendingRequests';
const STORE_POULTRY = 'poultryOfflineEvents';
const STORE_DAIRY = 'dairyOfflineEvents';
const STORE_COFFEE = 'coffeeOfflineEvents';
const STORE_SMALL_RUMINANT = 'smallRuminantOfflineEvents';
// Must match lib/offline-db.ts's DB_VERSION exactly. This file opens the
// *same* IndexedDB database from a separate execution context (the SW
// thread, vs. the page's main thread), and IndexedDB throws a hard
// VersionError if you ask to open at a version lower than the one the
// database is already at. lib/offline-db.ts is at version 4 (added
// dairy/coffee/small-ruminant stores); this was left at 2. In practice
// that meant: on any device that had already loaded the app once (so the
// main thread had already upgraded the DB to v4), openDB() below started
// throwing VersionError on every call, which saveRequestToDB() below
// swallows silently (try/catch → console.error only) and then STILL
// returns the "Saved locally. Will sync when online." response to the
// page. The farmer saw a success message; the record was never written
// to IndexedDB at all. Bumping this to 4 and mirroring the same store
// creation as lib/offline-db.ts fixes the VersionError. See also the
// fetch handler below, which no longer routes Supabase calls through this
// generic queue at all — see the comment there for why.
const DB_VERSION = 4;

const URLS_TO_CACHE = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to open DB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_REQUESTS)) {
        db.createObjectStore(STORE_REQUESTS, {
          keyPath: 'id',
          autoIncrement: true
        });
      }

      if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_POULTRY)) {
        const store = db.createObjectStore(STORE_POULTRY, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('by_entity_type', 'entityType');
        store.createIndex('by_batch', 'batchId');
        store.createIndex('by_farm', 'farmId');
        store.createIndex('by_synced', 'synced');
        store.createIndex('by_event_id', 'eventId', { unique: true });
      }

      // v3 (dairy, coffee) and v4 (small ruminant) — mirrors
      // lib/offline-db.ts exactly. The SW never writes to these stores
      // itself today, but it MUST declare the same schema at the same
      // version, or any upgrade transaction that runs from this thread
      // first (e.g. a fresh install where the SW activates before the
      // page's own initDB() call) will leave the database missing stores
      // the main thread expects, and one of the two contexts will throw
      // VersionError on every subsequent open.
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(STORE_DAIRY)) {
          const store = db.createObjectStore(STORE_DAIRY, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_entity_type', 'entityType');
          store.createIndex('by_cow', 'referenceId');
          store.createIndex('by_farm', 'farmId');
          store.createIndex('by_synced', 'synced');
          store.createIndex('by_event_id', 'eventId', { unique: true });
        }
        if (!db.objectStoreNames.contains(STORE_COFFEE)) {
          const store = db.createObjectStore(STORE_COFFEE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_entity_type', 'entityType');
          store.createIndex('by_plot', 'referenceId');
          store.createIndex('by_farm', 'farmId');
          store.createIndex('by_synced', 'synced');
          store.createIndex('by_event_id', 'eventId', { unique: true });
        }
      }
      if (oldVersion < 4 && !db.objectStoreNames.contains(STORE_SMALL_RUMINANT)) {
        const store = db.createObjectStore(STORE_SMALL_RUMINANT, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_entity_type', 'entityType');
        store.createIndex('by_animal', 'referenceId');
        store.createIndex('by_farm', 'farmId');
        store.createIndex('by_synced', 'synced');
        store.createIndex('by_event_id', 'eventId', { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveRequestToDB(req) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_REQUESTS, 'readwrite');
    const store = tx.objectStore(STORE_REQUESTS);
    
    const clonedReq = req.clone();
    
    const headers = {};
    for (const [key, value] of clonedReq.headers.entries()) {
      headers[key] = value;
    }

    let body = null;
    try {
      const text = await clonedReq.text();
      try {
        body = JSON.parse(text);
      } catch (e) {
        body = text;
      }
    } catch (e) {
      // ignore
    }

    const payload = {
      url: req.url,
      method: req.method,
      headers,
      body,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const addReq = store.add(payload);
      addReq.onsuccess = () => resolve(true);
      addReq.onerror = () => reject(addReq.error);
    });
  } catch (err) {
    console.error('[SW] Failed to save request to IndexedDB:', err);
    // Previously this function returned `undefined` here and the caller
    // treated that identically to a successful save, telling the page
    // "Saved locally. Will sync when online." even though nothing was
    // actually written. Returning false lets the fetch handler tell the
    // truth instead.
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Intercept offline mutations — same-origin /api/ routes ONLY.
  //
  // This used to also match any request whose URL contained
  // "supabase.co", which is every call the Supabase JS client makes:
  // auth token refreshes, storage uploads, and — critically — every
  // direct table insert/update the farmer-facing forms make (poultry,
  // dairy, coffee, small ruminant health/mortality/feed/sales all call
  // supabase.from(...).insert(...) directly, not through fetchWithSync).
  //
  // Those domain writes already have a purpose-built, entity-aware
  // offline path: lib/offline-db.ts's queuePoultryEvent/queueDairyEvent/
  // queueCoffeeEvent/queueSmallRuminantEvent, replayed later by
  // components/ui/SyncManager.tsx through the sync-offline-events edge
  // function (idempotent via eventId, reconciled server-side per entity).
  // Because the SW's fetch handler runs *underneath* the page — it
  // intercepts the network call before the promise ever resolves back to
  // supabase-js — this generic handler was winning the race: on a failed
  // request it synthesized its own 202 "Saved locally" Response and
  // handed that back to supabase-js as if it were the real API response.
  // supabase-js has no reason to expect a 202 with `{ offline, message }`
  // as a body; it just sees "the request didn't error," so the calling
  // code's own catch block — the one that would have called
  // queuePoultryEvent() etc. — never runs. The record went nowhere: not
  // to the server (no connectivity), not to the domain-specific offline
  // store (that code path was skipped), and only *maybe* to the generic
  // STORE_REQUESTS queue below (see the DB_VERSION note above for why
  // even that wasn't reliable). The farmer still saw a success/"saved
  // offline" message either way.
  //
  // Scoping this to same-origin /api/ makes it a safety net for this
  // app's own Next.js route handlers that don't yet have a
  // fetchWithSync()/domain-queue integration of their own (e.g. cases
  // like the cooperative intake forms — see NewIntakeClient.tsx), while
  // Supabase calls now fail through to the page exactly as supabase-js
  // expects, letting the app's real offline logic handle them.
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const sameOriginApi = req.url.startsWith(self.location.origin) && new URL(req.url).pathname.startsWith('/api/');
    if (sameOriginApi) {
      event.respondWith(
        fetch(req.clone()).catch(async (error) => {
          console.warn('[SW] Mutation failed, queuing in IndexedDB for background sync:', req.url);
          const saved = await saveRequestToDB(req);

          return new Response(
            JSON.stringify(
              saved
                ? { offline: true, message: 'Saved locally. Will sync when online.' }
                : { offline: true, error: true, message: 'You appear to be offline and this could not be saved on this device either. Please try again.' }
            ),
            {
              status: saved ? 202 : 507,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
      );
      return;
    }
    // Supabase (and any other) mutation requests: let them fail/succeed
    // on their own. Do not intercept.
    return;
  }

  // 2. Normal GET handling
  if (req.method !== 'GET') return;
  
  // API and Supabase GET requests bypass cache and hit network
  if (req.url.includes('/api/') || req.url.includes('supabase.co')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Page navigations: network-first. This is the fix for the staleness bug
  // described above — always prefer whatever the live network returns
  // (which necessarily matches the currently-deployed build, including its
  // correct CSS/JS references) and only fall back to a cached copy if the
  // network genuinely fails. Cache a fresh copy of every successful
  // response as we go, so the offline fallback keeps itself current
  // automatically instead of being frozen at whatever `install` last ran —
  // no future deploy should ever require touching this file again just to
  // stay correct.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Next.js static assets (/_next/static/...) are safe to cache-first:
  // their filenames are content-hashed, so a given URL's bytes never
  // change — there's no staleness risk, only an availability upside. But
  // rather than relying on a fixed precache list (which is exactly what
  // went stale above, and would go stale again on the next deploy since
  // every deploy changes these hashes), cache each one the first time it's
  // actually requested. A cold cache just means the first load after a
  // fresh install fetches from network like normal and populates itself
  // from there.
  if (new URL(req.url).pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (icons, manifest, other public/ files): cache-first
  // with network fallback, same as before — these are small, rarely
  // change, and low-stakes if briefly stale.
  event.respondWith(
    caches.match(req)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(req).catch(() => {
          // If network fails and it's a navigation request, show offline page
          if (req.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});

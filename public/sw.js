const CACHE_NAME = 'framedinsight-cache-v2';
const OFFLINE_URL = '/offline';

const DB_NAME = 'framedInsightSync';
const STORE_REQUESTS = 'pendingRequests';
const STORE_POULTRY = 'poultryOfflineEvents';
const DB_VERSION = 2;

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
      addReq.onsuccess = () => resolve();
      addReq.onerror = () => reject(addReq.error);
    });
  } catch (err) {
    console.error('[SW] Failed to save request to IndexedDB:', err);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Intercept offline mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.url.includes('/api/') || req.url.includes('supabase.co')) {
      event.respondWith(
        fetch(req.clone()).catch(async (error) => {
          console.warn('[SW] Mutation failed, queuing in IndexedDB for background sync:', req.url);
          await saveRequestToDB(req);
          
          return new Response(
            JSON.stringify({
              offline: true,
              message: 'Saved locally. Will sync when online.'
            }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
      );
      return;
    }
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

  // Static assets and page loads: Cache first
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

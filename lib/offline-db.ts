/**
 * Offline Sync Utility using IndexedDB
 * Stores pending API requests when the user is offline.
 */

const DB_NAME = 'framedInsightSync';
const STORE_NAME = 'pendingRequests';

export interface PendingRequest {
  id?: number;
  url: string;
  method: string;
  body: any;
  headers?: any;
  timestamp: number;
}

/**
 * Initialize the IndexedDB
 */
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue a request for later sync
 */
export async function queueRequest(req: Omit<PendingRequest, 'timestamp'>) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add({ ...req, timestamp: Date.now() });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending requests
 */
export async function getPendingRequests(): Promise<PendingRequest[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a request after successful sync
 */
export async function removeRequest(id: number) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enhanced fetch that supports offline queueing
 */
export async function fetchWithSync(url: string, options: RequestInit) {
  if (typeof window === 'undefined') return fetch(url, options);

  // If online, try normally
  if (navigator.onLine) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      // If server error, we might still want to queue it or handle it normally
    } catch (err) {
      console.warn('Fetch failed despite being online, queueing...', err);
    }
  }

  // If offline or fetch failed, queue the request if it's a mutation
  if (options.method === 'POST' || options.method === 'PATCH' || options.method === 'PUT') {
    await queueRequest({
      url,
      method: options.method,
      body: options.body ? JSON.parse(options.body as string) : null,
      headers: options.headers,
    });
    
    // Return a fake "202 Accepted" response
    return new Response(JSON.stringify({ offline: true, message: 'Saved locally. Will sync when online.' }), {
      status: 202,
      statusText: 'Accepted',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return fetch(url, options);
}

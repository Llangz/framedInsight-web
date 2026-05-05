'use client';

import { useEffect, useState } from 'react';
import { getPendingRequests, removeRequest } from '@/lib/offline-db';

export function SyncManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Register Service Worker for PWA and offline caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => console.log('Service Worker registered with scope:', registration.scope))
        .catch((error) => console.error('Service Worker registration failed:', error));
    }

    // Initial count
    checkPending();

    // Listen for online event
    window.addEventListener('online', syncData);
    
    // Interval check every 5 minutes just in case
    const interval = setInterval(syncData, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', syncData);
      clearInterval(interval);
    };
  }, []);

  async function checkPending() {
    const pending = await getPendingRequests();
    setPendingCount(pending.length);
  }

  async function syncData() {
    if (!navigator.onLine || isSyncing) return;

    const pending = await getPendingRequests();
    if (pending.length === 0) return;

    setIsSyncing(true);
    console.log(`Starting sync for ${pending.length} requests...`);

    for (const req of pending) {
      try {
        const response = await fetch(req.url, {
          method: req.method,
          headers: {
            ...req.headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(req.body),
        });

        if (response.ok) {
          await removeRequest(req.id!);
          console.log(`Successfully synced request to ${req.url}`);
        }
      } catch (err) {
        console.error(`Failed to sync request to ${req.url}`, err);
        // Stop syncing if we hit a network error again
        break;
      }
    }

    await checkPending();
    setIsSyncing(false);
  }

  if (pendingCount === 0 && !isSyncing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border text-sm font-medium transition-all ${
        isSyncing ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse' : 'bg-amber-100 text-amber-700 border-amber-200'
      }`}>
        <span className="text-lg">{isSyncing ? '🔄' : '⏳'}</span>
        <span>
          {isSyncing ? 'Syncing records...' : `${pendingCount} record(s) pending sync`}
        </span>
      </div>
    </div>
  );
}

'use client'

import { WifiOff, Check, AlertTriangle } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8 animate-pulse">
        <WifiOff size={36} className="text-emerald-400" strokeWidth={1.5} />
      </div>
      <h1 className="text-4xl font-bold text-white mb-4">You're <span className="text-emerald-400">Offline</span></h1>
      <p className="text-slate-400 max-w-md mx-auto mb-8 text-lg">
        It looks like your connection has been interrupted. Don't worry, your data is safe.
      </p>
      
      <div className="glass-card p-6 rounded-3xl border border-white/10 max-w-sm w-full mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 text-left">Limited Access</h2>
        <ul className="space-y-3 text-left">
          <li className="flex items-center gap-3 text-white text-sm">
            <Check size={14} className="text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
            View cached dashboard
          </li>
          <li className="flex items-center gap-3 text-white text-sm">
            <Check size={14} className="text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
            Access offline records
          </li>
          <li className="flex items-center gap-3 text-slate-500 text-sm italic">
            <AlertTriangle size={14} className="flex-shrink-0" strokeWidth={1.5} />
            Sync when back online
          </li>
        </ul>
      </div>

      <button 
        onClick={() => window.location.reload()}
        className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
      >
        Retry Connection
      </button>
    </div>
  )
}

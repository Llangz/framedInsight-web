'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ActivityItem {
  id: string; type: string; enterprise: string; icon: string; title: string; description: string; timestamp: string; link?: string;
}

export default function RecentActivity({ farmId }: { farmId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data for premium UI demonstration
    setTimeout(() => {
      setActivities([
        { id: '1', type: 'milk', enterprise: 'dairy', icon: '🥛', title: 'Milk Recorded', description: '18L from Wanjiru - Morning session', timestamp: new Date().toISOString(), link: '/dashboard/dairy/milk' },
        { id: '2', type: 'health', enterprise: 'dairy', icon: '💉', title: 'Health Check', description: 'Deworming for Mwende', timestamp: new Date(Date.now() - 3600000).toISOString(), link: '/dashboard/dairy/health' },
        { id: '3', type: 'harvest', enterprise: 'coffee', icon: '🍒', title: 'Season Harvest', description: '250kg delivered to Factory', timestamp: new Date(Date.now() - 86400000).toISOString(), link: '/dashboard/coffee/harvest' },
      ]);
      setLoading(false);
    }, 1000);
  }, [farmId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <Link
          key={activity.id}
          href={activity.link || '#'}
          className="block group"
        >
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all duration-300">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">
              {activity.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{activity.title}</p>
              <p className="text-xs text-slate-500 truncate">{activity.description}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Completed</p>
              <p className="text-[10px] text-slate-600 font-bold uppercase">1h ago</p>
            </div>
          </div>
        </Link>
      ))}
      <Link href="/dashboard/activity" className="block w-full py-3 text-center text-xs font-bold text-slate-500 hover:text-emerald-400 uppercase tracking-widest transition-colors mt-4">
        View Audit Trail →
      </Link>
    </div>
  )
}

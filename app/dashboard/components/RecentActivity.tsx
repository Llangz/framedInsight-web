'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Milk, Stethoscope, Wheat, ArrowRight } from 'lucide-react'

const activityIcons: Record<string, typeof Milk> = {
  milk:    Milk,
  health:  Stethoscope,
  harvest: Wheat,
}

interface ActivityItem {
  id: string
  type: string
  enterprise: string
  title: string
  description: string
  timestamp: string
  link?: string
}

export default function RecentActivity({ farmId }: { farmId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setActivities([
        {
          id: '1', type: 'milk', enterprise: 'dairy',
          title: 'Milk recorded',
          description: '18 L from Wanjiru — morning',
          timestamp: new Date().toISOString(),
          link: '/dashboard/dairy/milk',
        },
        {
          id: '2', type: 'health', enterprise: 'dairy',
          title: 'Health check',
          description: 'Deworming — Mwende',
          timestamp: new Date(Date.now() - 3_600_000).toISOString(),
          link: '/dashboard/dairy/health',
        },
        {
          id: '3', type: 'harvest', enterprise: 'coffee',
          title: 'Season harvest',
          description: '250 kg delivered to factory',
          timestamp: new Date(Date.now() - 86_400_000).toISOString(),
          link: '/dashboard/coffee/harvest',
        },
      ])
      setLoading(false)
    }, 800)
  }, [farmId])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-zinc-800 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.type] ?? Milk
        return (
          <Link
            key={activity.id}
            href={activity.link ?? '#'}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:bg-zinc-800 hover:border-zinc-700 transition-colors group"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800">
              <Icon size={13} className="text-zinc-500 group-hover:text-emerald-500 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{activity.title}</p>
              <p className="text-[10px] text-zinc-600 truncate">{activity.description}</p>
            </div>
            <ArrowRight size={11} className="text-zinc-700 flex-shrink-0" />
          </Link>
        )
      })}

      <Link
        href="/dashboard/activity"
        className="flex items-center justify-center gap-1.5 pt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        View full audit trail
        <ArrowRight size={10} />
      </Link>
    </div>
  )
}

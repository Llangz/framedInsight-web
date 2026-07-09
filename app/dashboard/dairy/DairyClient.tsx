// 📁 FILE PATH: app/dashboard/dairy/DairyClient.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PlusCircle, Droplets, TrendingUp, Beef, Milk,
  Heart, Stethoscope, AlertTriangle, CalendarDays,
  ArrowRight, Bell,
} from 'lucide-react'

interface Props {
  stats: {
    total_cows: number
    producing_cows: number
    dry_cows: number
    today_milk: number
    avg_daily_milk: number
    calves: number
  }
  alerts: { id: string; message: string; subMessage: string; type: string }[]
  upcoming: { id: string; message: string; subMessage: string; type: string }[]
}

const navItems = [
  { label: 'Herd',      href: '/dashboard/dairy'           },
  { label: 'Milk',      href: '/dashboard/dairy/milk'      },
  { label: 'Health',    href: '/dashboard/dairy/health'    },
  { label: 'Breeding',  href: '/dashboard/dairy/breeding'  },
  { label: 'Warnings',  href: '/dashboard/dairy/warnings'  },
]

export default function DairyClient({ stats, alerts, upcoming }: Props) {
  const pathname = usePathname()

  const statCards = [
    {
      label: 'Total cows',
      value: stats.total_cows,
      sub: `${stats.dry_cows} dry`,
      Icon: Beef,
      href: '/dashboard/dairy/herd',
    },
    {
      label: 'Producing',
      value: stats.producing_cows,
      sub: 'active milkers',
      Icon: TrendingUp,
      href: '/dashboard/dairy/herd',
    },
    {
      label: "Today's milk",
      value: `${stats.today_milk}L`,
      sub: `avg ${stats.avg_daily_milk}L/day`,
      Icon: Droplets,
      href: '/dashboard/dairy/milk',
    },
    {
      label: 'Calves / heifers',
      value: stats.calves,
      sub: 'in development',
      Icon: Milk,
      href: '/dashboard/dairy/herd',
    },
  ]

  const urgentAlerts = alerts.filter(a => a.type === 'health' || alerts.indexOf(a) < 3)

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Sub-nav (Herd/Milk/Health/... + Record milk) now lives in the
          persistent EnterpriseNavHeader rendered by DashboardShell for
          every dairy route, not just this page — see
          app/dashboard/components/EnterpriseNavHeader.tsx. */}

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Dairy</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {stats.total_cows} cow{stats.total_cows !== 1 ? 's' : ''} registered
            </p>
          </div>
          {urgentAlerts.length > 0 && (
            <Link
              href="/dashboard/dairy/warnings"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-400 border border-amber-900/40 bg-amber-950/30 rounded-md"
            >
              <Bell size={12} /> {urgentAlerts.length} alert{urgentAlerts.length > 1 ? 's' : ''}
            </Link>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(({ label, value, sub, Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4 hover:border-[#3A3D45] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <Icon size={15} className="text-[#4B5563] group-hover:text-emerald-500 transition-colors" />
                <ArrowRight size={12} className="text-[#2A2D35] group-hover:text-[#6B7280] transition-colors" />
              </div>
              <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">{label}</p>
              <p className="text-[11px] text-[#4B5563]">{sub}</p>
            </Link>
          ))}
        </div>

        {/* Quick actions + alerts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Quick actions */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35]">
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Actions</h2>
            </div>
            <div className="p-2">
              {[
                { label: 'Record milk',  Icon: Droplets,    href: '/dashboard/dairy/milk/record'  },
                { label: 'Add cow',      Icon: PlusCircle,  href: '/dashboard/dairy/add-cow'      },
                { label: 'Health check', Icon: Stethoscope, href: '/dashboard/dairy/health'       },
                { label: 'Breeding',     Icon: Heart,       href: '/dashboard/dairy/breeding'     },
              ].map(({ label, Icon, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors group"
                >
                  <Icon size={14} className="text-[#4B5563] group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  <ArrowRight size={12} className="text-[#2A2D35] group-hover:text-[#6B7280]" />
                </Link>
              ))}
            </div>
          </section>

          {/* Health alerts */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
              <AlertTriangle size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Health alerts</h2>
            </div>
            <div className="divide-y divide-[#1F2128]">
              {alerts.length === 0 ? (
                <p className="text-xs text-[#4B5563] px-4 py-4">No active alerts</p>
              ) : alerts.map(a => (
                <div key={a.id} className="flex items-start gap-2.5 px-4 py-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-white">{a.message}</p>
                    <p className="text-[11px] text-[#6B7280]">{a.subMessage}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Upcoming */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
              <CalendarDays size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Upcoming</h2>
            </div>
            <div className="divide-y divide-[#1F2128]">
              {upcoming.length === 0 ? (
                <p className="text-xs text-[#4B5563] px-4 py-4">No upcoming events</p>
              ) : upcoming.map(e => (
                <div key={e.id} className="flex items-start gap-2.5 px-4 py-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-white">{e.message}</p>
                    <p className="text-[11px] text-[#6B7280]">{e.subMessage}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Empty state */}
        {stats.total_cows === 0 && (
          <div className="rounded-lg border border-dashed border-[#2A2D35] p-12 text-center">
            <p className="text-sm text-[#6B7280] mb-4">No cows registered yet</p>
            <Link
              href="/dashboard/dairy/add-cow"
              className="inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400"
            >
              <PlusCircle size={14} /> Register first cow
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
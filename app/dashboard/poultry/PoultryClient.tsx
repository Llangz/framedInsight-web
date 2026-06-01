// 📁 FILE PATH: app/dashboard/poultry/PoultryClient.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PlusCircle, Egg, Syringe, ShoppingCart, Wheat,
  TrendingUp, AlertTriangle, ArrowRight, CalendarDays, Skull,
  Bird, Activity, DollarSign, BarChart3
} from 'lucide-react'

interface FlockBatch {
  id: string
  batch_name: string
  bird_type: 'layer' | 'broiler' | 'kienyeji' | 'dual_purpose'
  breed: string | null
  current_count: number
  date_of_placement: string
  age_weeks: number
  status: 'active' | 'sold' | 'culled'
  house_number: string | null
}

interface PoultryStats {
  total_birds: number
  layers: number
  broilers: number
  kienyeji: number
  today_eggs: number
  avg_daily_eggs: number
  hen_day_production: number
  active_batches: number
  mortality_this_week: number
  feed_stock_days: number
}

interface Alert {
  id: string
  message: string
  subMessage: string
  type: string
}

interface Props {
  stats: PoultryStats
  batches: FlockBatch[]
  alerts: Alert[]
  upcoming: Alert[]
}

const navItems = [
  { label: 'Overview',    href: '/dashboard/poultry'               },
  { label: 'Flock',       href: '/dashboard/poultry/flock'         },
  { label: 'Eggs',        href: '/dashboard/poultry/eggs'          },
  { label: 'Feed',        href: '/dashboard/poultry/feed'          },
  { label: 'Health',      href: '/dashboard/poultry/health'        },
  { label: 'Mortality',   href: '/dashboard/poultry/mortality'     },
  { label: 'Sales',       href: '/dashboard/poultry/sales'         },
]

const BIRD_TYPE_LABEL: Record<string, string> = {
  layer:        'Layers',
  broiler:      'Broilers',
  kienyeji:     'Kienyeji',
  dual_purpose: 'Dual Purpose',
}

const BIRD_TYPE_COLOR: Record<string, string> = {
  layer:        'text-amber-400 border-amber-900/40 bg-amber-950/30',
  broiler:      'text-sky-400 border-sky-900/40 bg-sky-950/30',
  kienyeji:     'text-emerald-400 border-emerald-900/40 bg-emerald-950/30',
  dual_purpose: 'text-purple-400 border-purple-900/40 bg-purple-950/30',
}

function ageFmt(weeks: number): string {
  if (weeks < 4) return `${weeks}w`
  const months = Math.floor(weeks / 4.33)
  const remWeeks = Math.round(weeks % 4.33)
  return remWeeks > 0 ? `${months}mo ${remWeeks}w` : `${months}mo`
}

export default function PoultryClient({ stats, batches, alerts, upcoming }: Props) {
  const pathname = usePathname()

  const statCards = [
    {
      label: 'Total birds',
      value: stats.total_birds.toLocaleString(),
      sub: `${stats.active_batches} active batch${stats.active_batches !== 1 ? 'es' : ''}`,
      Icon: Bird,
      href: '/dashboard/poultry/flock',
    },
    {
      label: "Today's eggs",
      value: stats.today_eggs.toLocaleString(),
      sub: `avg ${stats.avg_daily_eggs}/day`,
      Icon: Egg,
      href: '/dashboard/poultry/eggs',
    },
    {
      label: 'Hen-day %',
      value: `${stats.hen_day_production}%`,
      sub: stats.hen_day_production >= 75 ? 'Good production' : stats.hen_day_production >= 60 ? 'Average' : 'Below target',
      Icon: TrendingUp,
      href: '/dashboard/poultry/eggs',
    },
    {
      label: 'Feed stock',
      value: `${stats.feed_stock_days}d`,
      sub: stats.feed_stock_days <= 7 ? '⚠ Low – reorder soon' : 'Remaining supply',
      Icon: Wheat,
      href: '/dashboard/poultry/feed',
    },
  ]

  const quickActions = [
    { label: 'Record eggs',      Icon: Egg,          href: '/dashboard/poultry/eggs'          },
    { label: 'Add batch',        Icon: PlusCircle,   href: '/dashboard/poultry/add-batch'     },
    { label: 'Record mortality', Icon: Skull,        href: '/dashboard/poultry/mortality'     },
    { label: 'Feed intake',      Icon: Wheat,        href: '/dashboard/poultry/feed'          },
    { label: 'Health / Vax',     Icon: Syringe,      href: '/dashboard/poultry/health'        },
    { label: 'Record sale',      Icon: ShoppingCart, href: '/dashboard/poultry/sales'         },
  ]

  return (
    <div className="min-h-screen bg-obsidian">

      {/* Sub-nav */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            <nav className="flex items-center gap-1 overflow-x-auto">
              {navItems.map(({ label, href }) => {
                const active = href === '/dashboard/poultry'
                  ? pathname === href
                  : pathname.startsWith(href)
                return (
                  <Link key={href} href={href}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      active ? 'text-white bg-white/10' : 'text-[#6B7280] hover:text-white'
                    }`}>
                    {label}
                  </Link>
                )
              })}
            </nav>
            <Link href="/dashboard/poultry/add-batch"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors flex-shrink-0">
              <PlusCircle size={12} /> Add Batch
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#4B5563] mb-1">Enterprise</p>
            <h1 className="text-xl font-semibold text-white tracking-tight">Poultry</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {stats.total_birds.toLocaleString()} birds · {stats.active_batches} batch{stats.active_batches !== 1 ? 'es' : ''}
            </p>
          </div>
          {stats.mortality_this_week > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-400 border border-red-900/40 bg-red-950/30 rounded-md">
              <AlertTriangle size={12} />
              {stats.mortality_this_week} deaths this week
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(({ label, value, sub, Icon, href }) => (
            <Link key={label} href={href}
              className="group rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4 hover:border-[#3A3D45] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <Icon size={15} className="text-[#4B5563] group-hover:text-emerald-600 transition-colors" />
                <ArrowRight size={12} className="text-[#2A2D35] group-hover:text-[#6B7280] transition-colors" />
              </div>
              <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">{label}</p>
              <p className="text-[11px] text-[#4B5563]">{sub}</p>
            </Link>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Quick actions */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35]">
              <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Actions</h2>
            </div>
            <div className="p-2">
              {quickActions.map(({ label, Icon, href }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors group">
                  <Icon size={14} className="text-[#4B5563] group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  <ArrowRight size={12} className="text-[#2A2D35] group-hover:text-[#6B7280]" />
                </Link>
              ))}
            </div>
          </section>

          {/* Alerts */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
              <AlertTriangle size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Alerts</h2>
            </div>
            <div className="p-3 space-y-1">
              {alerts.length === 0 ? (
                <p className="text-xs text-[#4B5563] px-1 py-2">No active alerts</p>
              ) : alerts.map(a => (
                <div key={a.id} className="flex items-start gap-2.5 px-2 py-2 rounded-md">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    a.type === 'mortality' ? 'bg-red-500' :
                    a.type === 'feed'      ? 'bg-amber-500' : 'bg-orange-500'
                  }`} />
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
              <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Upcoming</h2>
            </div>
            <div className="p-3 space-y-1">
              {upcoming.length === 0 ? (
                <p className="text-xs text-[#4B5563] px-1 py-2">No upcoming events</p>
              ) : upcoming.map(e => (
                <div key={e.id} className="flex items-start gap-2.5 px-2 py-2 rounded-md">
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

        {/* Active batches */}
        {batches.length > 0 ? (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bird size={13} className="text-[#6B7280]" />
                <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Active Batches</h2>
              </div>
              <Link href="/dashboard/poultry/flock"
                className="text-xs text-[#6B7280] hover:text-white transition-colors">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-[#1F2128]">
              {batches.slice(0, 6).map(b => (
                <Link key={b.id} href={`/dashboard/poultry/flock/${b.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-white truncate">{b.batch_name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${BIRD_TYPE_COLOR[b.bird_type]}`}>
                        {BIRD_TYPE_LABEL[b.bird_type]}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {b.breed || 'Mixed'} · {b.house_number ? `House ${b.house_number}` : 'Open range'} · {ageFmt(b.age_weeks)} old
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-white">{b.current_count.toLocaleString()}</p>
                    <p className="text-[11px] text-[#6B7280]">birds</p>
                  </div>
                  <ArrowRight size={12} className="text-[#4B5563] group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-[#2A2D35] p-12 text-center">
            <Bird size={32} className="text-[#2A2D35] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280] mb-4">No poultry batches registered yet</p>
            <Link href="/dashboard/poultry/add-batch"
              className="inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400">
              <PlusCircle size={14} /> Register first batch
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
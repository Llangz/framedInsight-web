'use client'

import Link from 'next/link'
import {
  MapPin, Trees, Sprout, Package, Banknote,
  ShieldCheck, ArrowRight, PlusCircle, Microscope,
  BarChart3, Satellite, ChevronRight, CalendarDays,
} from 'lucide-react'

interface CoffeeClientProps {
  stats: {
    total_plots: number
    total_trees: number
    mature_trees: number
    season_harvest_kg: number
    season_revenue: number
    eudr_compliant: number
    pending_payments: number
    pending_payments_count?: number
  }
}

const statCards = [
  {
    label: 'Coffee plots',
    valueKey: 'total_plots' as const,
    sub: 'registered',
    Icon: MapPin,
    href: '/dashboard/coffee/plots',
  },
  {
    label: 'Total trees',
    valueKey: 'total_trees' as const,
    sub: (s: CoffeeClientProps['stats']) => `${s.mature_trees} mature`,
    Icon: Trees,
    href: '/dashboard/coffee/plots',
  },
  {
    label: 'Season harvest',
    valueKey: (s: CoffeeClientProps['stats']) => `${s.season_harvest_kg.toLocaleString()} kg`,
    sub: 'cherry weight',
    Icon: Package,
    href: '/dashboard/coffee/harvest',
  },
  {
    label: 'Season revenue',
    valueKey: (s: CoffeeClientProps['stats']) => `KES ${s.season_revenue.toLocaleString()}`,
    sub: 'cooperative payments',
    Icon: Banknote,
    href: '/dashboard/coffee/finance',
  },
  {
    label: 'EUDR compliant',
    valueKey: (s: CoffeeClientProps['stats']) => s.eudr_compliant,
    sub: (s: CoffeeClientProps['stats']) => `of ${s.total_trees} trees`,
    Icon: ShieldCheck,
    href: '/dashboard/coffee/eudr-check',
  },
  {
    label: 'Seedlings / young',
    valueKey: (s: CoffeeClientProps['stats']) => Math.max(0, s.total_trees - s.mature_trees),
    sub: 'developing trees',
    Icon: Sprout,
    href: '/dashboard/coffee/plots',
  },
]

const quickActions = [
  { label: 'Record harvest',   Icon: Package,     href: '/dashboard/coffee/harvest/record'  },
  { label: 'Add plot',         Icon: PlusCircle,  href: '/dashboard/coffee/plots/add'        },
  { label: 'Disease check',    Icon: Microscope,  href: '/dashboard/coffee/disease'          },
  { label: 'EUDR compliance',  Icon: ShieldCheck, href: '/dashboard/coffee/eudr-check'       },
  { label: 'Activities',       Icon: BarChart3,   href: '/dashboard/coffee/activities'       },
  { label: 'Satellite view',   Icon: Satellite,   href: '/dashboard/coffee/satellite'        },
]

const seasons = [
  {
    label:  'Main season',
    period: 'Oct – Dec',
    sub:    'Peak harvest period',
    color:  'bg-emerald-950/40 border-emerald-900/40 text-emerald-400',
    dot:    'bg-emerald-500',
  },
  {
    label:  'Fly season',
    period: 'May – Jul',
    sub:    'Early harvest period',
    color:  'bg-sky-950/40 border-sky-900/40 text-sky-400',
    dot:    'bg-sky-500',
  },
]

export default function CoffeeClient({ stats }: CoffeeClientProps) {
  const resolve = (v: any, s: CoffeeClientProps['stats']) =>
    typeof v === 'function' ? v(s) : v

  return (
    <div className="min-h-screen bg-[#070809]">

      {/* Sub-nav */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors"
            >
              <ChevronRight size={12} className="rotate-180" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/coffee/harvest/record"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors"
            >
              <PlusCircle size={12} /> Record harvest
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-medium text-[#4B5563] mb-1">Enterprise</p>
          <h1 className="text-xl font-semibold text-white tracking-tight">Coffee</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Plot management, harvest tracking and EUDR compliance</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {statCards.map(({ label, valueKey, sub, Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-lg border border-[#2A2D35] bg-[#0D0F14] p-4 hover:border-[#3A3D45] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <Icon size={15} className="text-[#4B5563] group-hover:text-emerald-500 transition-colors" />
                <ArrowRight size={12} className="text-[#2A2D35] group-hover:text-[#6B7280] transition-colors" />
              </div>
              <p className="text-2xl font-semibold text-white tracking-tight">
                {resolve(valueKey, stats)}
              </p>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">{label}</p>
              <p className="text-[11px] text-[#4B5563]">{resolve(sub, stats)}</p>
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

          {/* Harvest seasons */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
              <CalendarDays size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Harvest seasons</h2>
            </div>
            <div className="p-3 space-y-2">
              {seasons.map(({ label, period, sub, color, dot }) => (
                <div
                  key={label}
                  className={`flex items-start gap-3 px-3 py-3 rounded-md border ${color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} mt-1.5 flex-shrink-0`} />
                  <div>
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-xs font-medium text-white/70">{period}</p>
                    <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cooperative payments */}
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14]">
            <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
              <Banknote size={13} className="text-[#6B7280]" />
              <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Cooperative payments</h2>
            </div>
            <div className="p-3">
              {stats.pending_payments > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-start gap-2.5 px-2 py-2 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white">Payment pending</p>
                      <p className="text-[11px] text-[#6B7280]">
                        {stats.pending_payments_count ?? 1} deliver{(stats.pending_payments_count ?? 1) > 1 ? 'ies' : 'y'} to cooperative
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 px-2 py-2 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-white">All settled</p>
                    <p className="text-[11px] text-[#6B7280]">No pending payments</p>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
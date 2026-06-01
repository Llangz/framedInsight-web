'use client'

import Link from 'next/link'
import { Milk, Coffee, Rabbit, Layers, TrendingUp } from 'lucide-react'

interface FarmOverviewProps {
  farmData: any
  farmStats: any
  selectedEnterprise: 'all' | 'dairy' | 'coffee' | 'sheep_goats' | 'poultry'
}

export default function FarmOverview({ farmData, farmStats, selectedEnterprise }: FarmOverviewProps) {
  const stats = [
    {
      label: 'Total Cows',
      value: farmData?.total_cows ?? farmStats?.total_cows ?? 0,
      icon: Milk,
      enterprise: 'dairy',
      show: farmData?.has_dairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy'),
    },
    {
      label: "Today's Milk",
      value: `${farmStats?.today_milk_liters ?? 0} L`,
      icon: TrendingUp,
      enterprise: 'dairy',
      show: farmData?.has_dairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy'),
    },
    {
      label: 'Coffee Acres',
      value: farmStats?.total_coffee_acres ?? 0,
      icon: Coffee,
      enterprise: 'coffee',
      show: farmData?.has_coffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee'),
    },
    {
      label: 'Season Harvest',
      value: `${farmStats?.season_harvest_kg ?? 0} kg`,
      icon: Layers,
      enterprise: 'coffee',
      show: farmData?.has_coffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee'),
    },
    {
      label: 'Total Animals',
      value: farmStats?.total_small_ruminants ?? 0,
      icon: Rabbit,
      enterprise: 'sheep_goats',
      show: farmData?.has_small_ruminants && (selectedEnterprise === 'all' || selectedEnterprise === 'sheep_goats'),
    },
  ].filter((s) => s.show)

  if (stats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
        <Layers size={24} className="mx-auto text-zinc-700 mb-3" />
        <h3 className="text-sm font-semibold text-white mb-1">No enterprises set up yet</h3>
        <p className="text-xs text-zinc-500 mb-5">
          Add your first animals or crops to start operational tracking.
        </p>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
        >
          Set up enterprise
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <div
            key={i}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                {stat.label}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-800">
                <Icon size={13} className="text-emerald-500" />
              </div>
            </div>

            <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>

            {/* Progress bar */}
            <div className="mt-4 h-0.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full w-2/3 rounded-full bg-emerald-500/60" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

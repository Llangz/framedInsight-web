'use client'

import Link from 'next/link'

interface FarmOverviewProps {
  farmData: any
  farmStats: any
  selectedEnterprise: 'all' | 'dairy' | 'coffee' | 'sheep_goats'
}

export default function FarmOverview({ farmData, farmStats, selectedEnterprise }: FarmOverviewProps) {
  const stats = [
    {
      label: 'Total Cows',
      value: farmStats?.total_cows || 0,
      icon: '🐄',
      enterprise: 'dairy',
      accent: 'emerald',
      show: farmData?.has_dairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy')
    },
    {
      label: "Today's Milk",
      value: `${farmStats?.today_milk_liters || 0}L`,
      icon: '🥛',
      enterprise: 'dairy',
      accent: 'sky',
      show: farmData?.has_dairy && (selectedEnterprise === 'all' || selectedEnterprise === 'dairy')
    },
    {
      label: 'Coffee Acres',
      value: farmStats?.total_coffee_acres || 0,
      icon: '☕',
      enterprise: 'coffee',
      accent: 'amber',
      show: farmData?.has_coffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee')
    },
    {
      label: 'Season Harvest',
      value: `${farmStats?.season_harvest_kg || 0}kg`,
      icon: '🍒',
      enterprise: 'coffee',
      accent: 'red',
      show: farmData?.has_coffee && (selectedEnterprise === 'all' || selectedEnterprise === 'coffee')
    },
    {
      label: 'Total Ruminants',
      value: farmStats?.total_small_ruminants || 0,
      icon: '🐏',
      enterprise: 'sheep_goats',
      accent: 'violet',
      show: farmData?.has_small_ruminants && (selectedEnterprise === 'all' || selectedEnterprise === 'sheep_goats')
    },
  ].filter(s => s.show);

  if (stats.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-12 text-center border-dashed border-slate-700">
        <div className="text-6xl mb-6">🌾</div>
        <h3 className="text-xl font-bold text-white mb-2">No enterprises set up yet</h3>
        <p className="text-slate-400 mb-8">Add your first animals or crops to get started with operational tracking.</p>
        <Link href="/dashboard/settings" className="inline-flex px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
          Initialize Enterprise
        </Link>
      </div>
    )
  }

  return (
    <div className="bento-grid">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="glass-card rounded-3xl p-8 hover-lift premium-transition group relative overflow-hidden"
        >
          {/* Decorative background glow */}
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
              <span className="text-2xl grayscale group-hover:grayscale-0 transition-all duration-500">{stat.icon}</span>
            </div>
            
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-white tracking-tight">
                {stat.value}
              </p>
              <div className="flex items-center text-xs font-bold text-emerald-400">
                <span className="mr-1">↑</span> 2.5%
              </div>
            </div>
            
            <div className="mt-6 flex items-center gap-2">
              <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-2/3 rounded-full" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">67% TARGET</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

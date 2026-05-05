'use client'

import { useState } from 'react'
import FarmOverview from './components/FarmOverview'
import EnterpriseSwitcher from './components/EnterpriseSwitcher'
import QuickActions from './components/QuickActions'
import RecentActivity from './components/RecentActivity'
import TrialCountdown from './components/TrialCountdown'

interface DashboardClientProps {
  farmData: any
  farmStats: any
}

export default function DashboardClient({ farmData, farmStats }: DashboardClientProps) {
  const [selectedEnterprise, setSelectedEnterprise] = useState<'all' | 'dairy' | 'coffee' | 'sheep_goats'>('all')

  const farmDisplayName = farmData?.farm_name || 'your farm'

  return (
    <div className="p-4 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Operations
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Habari, <span className="text-emerald-400">{farmDisplayName}</span> 👋
          </h1>
          <p className="text-slate-400 text-lg">
            Operational overview and real-time enterprise metrics.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {farmStats?.pending_alerts > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-crimson-alert/10 border border-crimson-alert/20 rounded-xl text-crimson-alert transition-all hover:bg-crimson-alert/20">
              <span className="text-sm font-bold">
                🔔 {farmStats.pending_alerts} Alert{farmStats.pending_alerts > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="glass-card px-4 py-2 rounded-xl">
            <TrialCountdown signupDate={farmData?.created_at} />
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Enterprise & Stats */}
        <div className="lg:col-span-8 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Enterprise Selector</h2>
            </div>
            <EnterpriseSwitcher
              hasDairy={farmData?.has_dairy || farmData?.farm_types?.includes('dairy')}
              hasCoffee={farmData?.has_coffee || farmData?.farm_types?.includes('coffee')}
              hasSheepGoats={farmData?.has_small_ruminants || farmData?.farm_types?.includes('small_ruminants')}
              selected={selectedEnterprise}
              onSelect={setSelectedEnterprise}
            />
          </section>

          <section className="space-y-4">
            <FarmOverview
              farmData={farmData}
              farmStats={farmStats}
              selectedEnterprise={selectedEnterprise}
            />
          </section>
        </div>

        {/* Right Column: Actions & Activity */}
        <div className="lg:col-span-4 space-y-8">
          <section className="glass-card rounded-3xl p-6 hover-lift premium-transition">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">⚡</span>
              Quick Actions
            </h2>
            <QuickActions
              hasDairy={farmData?.has_dairy || farmData?.farm_types?.includes('dairy')}
              hasCoffee={farmData?.has_coffee || farmData?.farm_types?.includes('coffee')}
              hasSheepGoats={farmData?.has_small_ruminants || farmData?.farm_types?.includes('small_ruminants')}
              selectedEnterprise={selectedEnterprise}
            />
          </section>

          <section className="glass-card rounded-3xl p-6 premium-transition">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">📜</span>
              Recent Activity
            </h2>
            <RecentActivity farmId={farmData?.id} />
          </section>
        </div>

      </div>
    </div>
  )
}

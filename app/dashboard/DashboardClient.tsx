'use client'

import { useState } from 'react'
import { Bell, Zap, ClipboardList } from 'lucide-react'
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
  const [selectedEnterprise, setSelectedEnterprise] = useState<'all' | 'dairy' | 'coffee' | 'sheep_goats' | 'poultry'>('all')

  // Derive enterprise flags from farm_types array (farms table doesn't have has_* boolean columns)
  const hasDairy = farmData?.farm_types?.includes('dairy')
  const hasCoffee = farmData?.farm_types?.includes('coffee')
  const hasSmallRuminants = farmData?.farm_types?.includes('small_ruminants')
  const hasPoultry = farmData?.farm_types?.includes('poultry')

  const farmDisplayName = farmData?.farm_name || 'your farm'

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Page header ── */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Live operations
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Habari, <span className="text-emerald-500">{farmDisplayName}</span>
          </h1>
          <p className="text-sm text-zinc-500">
            Operational overview and real-time enterprise metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {farmStats?.pending_alerts > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-900 bg-red-950/50 text-red-400 text-xs font-medium">
              <Bell size={13} />
              {farmStats.pending_alerts} alert{farmStats.pending_alerts > 1 ? 's' : ''}
            </div>
          )}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
            <TrialCountdown signupDate={farmData?.created_at} />
          </div>
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Enterprise + stats */}
        <div className="lg:col-span-8 space-y-6">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
              Enterprise selector
            </p>
            <EnterpriseSwitcher
              hasDairy={hasDairy}
              hasCoffee={hasCoffee}
              hasSheepGoats={hasSmallRuminants}
              hasPoultry={hasPoultry}
              selected={selectedEnterprise}
              onSelect={setSelectedEnterprise}
            />
          </section>

          <section>
            <FarmOverview
              farmData={farmData}
              farmStats={farmStats}
              selectedEnterprise={selectedEnterprise}
            />
          </section>
        </div>

        {/* Right: Actions + activity */}
        <div className="lg:col-span-4 space-y-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <Zap size={12} className="text-emerald-500" />
              Quick actions
            </h2>
            <QuickActions
              hasDairy={hasDairy}
              hasCoffee={hasCoffee}
              hasSheepGoats={hasSmallRuminants}
              hasPoultry={hasPoultry}
              selectedEnterprise={selectedEnterprise}
            />
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <ClipboardList size={12} className="text-zinc-500" />
              Recent activity
            </h2>
            <RecentActivity farmId={farmData?.id} />
          </section>
        </div>

      </div>
    </div>
  )
}

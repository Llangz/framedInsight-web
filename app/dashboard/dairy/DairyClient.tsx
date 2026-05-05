'use client'

import Link from 'next/link'

interface DairyClientProps {
  stats: any
  alerts: any[]
  upcoming: any[]
}

export default function DairyClient({ stats, alerts, upcoming }: DairyClientProps) {
  const statCards = [
    { label: 'Total Cows', value: stats?.total_cows || 0, icon: '🐄', link: '/dashboard/dairy/herd' },
    { label: 'Producing', value: stats?.producing_cows || 0, icon: '🥛', link: '/dashboard/dairy/record-milk' },
    { label: "Today's Milk", value: `${stats?.today_milk || 0}L`, icon: '📊', link: '/dashboard/dairy/record-milk' },
    { label: 'Avg Daily', value: `${stats?.avg_daily_milk || 0}L`, icon: '📈' },
  ]

  const quickActions = [
    { label: 'Record Milk', icon: '🥛', href: '/dashboard/dairy/milk/record', accent: 'emerald' },
    { label: 'Add Cow', icon: '🐄', href: '/dashboard/dairy/add-cow', accent: 'sky' },
    { label: 'Health Check', icon: '💉', href: '/dashboard/dairy/health', accent: 'crimson' },
    { label: 'Breeding', icon: '🐂', href: '/dashboard/dairy/breeding', accent: 'amber' },
  ]

  return (
    <div className="p-4 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            Dairy Enterprise
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Herd <span className="text-emerald-400">Operations</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Manage your high-performance dairy herd and production metrics.
          </p>
        </div>
        <Link href="/dashboard" className="px-6 py-2 glass-card rounded-xl text-white text-sm font-bold hover:bg-white/5 transition-all">
          ← Dashboard
        </Link>
      </header>

      {/* Stats Grid */}
      <div className="bento-grid">
        {statCards.map((stat, index) => (
          <div key={index} className="glass-card rounded-3xl p-8 hover-lift premium-transition group relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{stat.icon}</span>
              </div>
              <p className="text-4xl font-bold text-white tracking-tight">{stat.value}</p>
              <div className="mt-6 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-2/3 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl grayscale group-hover:grayscale-0 transition-all">
                  {action.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{action.label}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Herd Mutation</p>
                </div>
                <span className="text-slate-700 group-hover:text-emerald-500 transition-colors">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Alerts & Upcoming */}
        <div className="lg:col-span-8 space-y-8">
          <div className="glass-card rounded-3xl p-8">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="p-2 rounded-lg bg-crimson-alert/10 text-crimson-alert">⚠️</span>
              Health Alerts
            </h3>
            {alerts.length > 0 ? (
              <div className="space-y-4">
                {alerts.map(alert => (
                  <div key={alert.id} className="p-4 bg-crimson-alert/5 border border-crimson-alert/10 rounded-2xl flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-crimson-alert animate-pulse" />
                    <div>
                      <p className="text-sm font-bold text-white">{alert.message}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">{alert.subMessage}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic">All animals are healthy and up to date.</p>
            )}
          </div>

          <div className="glass-card rounded-3xl p-8">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="p-2 rounded-lg bg-sky-500/10 text-sky-500">📅</span>
              Upcoming Events
            </h3>
            {upcoming.length > 0 ? (
              <div className="space-y-4">
                {upcoming.map(event => (
                  <div key={event.id} className="p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">📅</div>
                    <div>
                      <p className="text-sm font-bold text-white">{event.message}</p>
                      <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">{event.subMessage}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic">No scheduled events for the upcoming week.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

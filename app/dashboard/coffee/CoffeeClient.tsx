'use client'

import Link from 'next/link'

interface CoffeeClientProps {
  stats: any
}

export default function CoffeeClient({ stats }: CoffeeClientProps) {
  const statCards = [
    { label: 'Coffee Plots', value: stats?.total_plots || 0, icon: '📍', color: 'bg-coffee-50 border-coffee-200 text-coffee-700', link: '/dashboard/coffee/plots' },
    { label: 'Total Trees', value: stats?.total_trees || 0, icon: '🌳', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Mature Trees', value: stats?.mature_trees || 0, icon: '☕', color: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Season Harvest', value: `${stats?.season_harvest_kg || 0}kg`, icon: '🍒', color: 'bg-red-50 border-red-200 text-red-700', link: '/dashboard/coffee/harvest' },
    { label: 'Season Revenue', value: `KES ${(stats?.season_revenue || 0).toLocaleString()}`, icon: '💰', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'EUDR Compliant', value: `${stats?.eudr_compliant || 0}/${stats?.total_trees || 0}`, icon: '✓', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  ]

  const quickActions = [
    { label: 'Record Harvest', icon: '🍒', href: '/dashboard/coffee/harvest/record', color: 'bg-red-600 hover:bg-red-700' },
    { label: 'Add Plot', icon: '📍', href: '/dashboard/coffee/plots/add', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Disease Check', icon: '🔬', href: '/dashboard/coffee/disease', color: 'bg-amber-600 hover:bg-amber-700' },
    { label: 'EUDR Compliance', icon: '🛡️', href: '/dashboard/coffee/eudr-check', color: 'bg-indigo-600 hover:bg-indigo-700' },
  ]

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Coffee Management</h1>
            <p className="text-gray-600 mt-1">Manage your coffee plots and harvest</p>
          </div>
          <Link 
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((stat, index) => (
          <Link
            key={index}
            href={stat.link || '#'}
            className={`
              p-4 rounded-lg border-2 transition-all
              ${stat.link ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}
              ${stat.color}
            `}
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-xs font-medium opacity-80 mt-1">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className={`
                p-4 rounded-lg text-white text-center transition-colors
                ${action.color}
              `}
            >
              <div className="text-3xl mb-2">{action.icon}</div>
              <div className="text-sm font-medium">{action.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Harvest Season Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Harvest Season</h3>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-xl">🍒</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Main Season (Oct-Dec)</p>
                  <p className="text-xs text-green-700 mt-1">Peak harvest period</p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-xl">🌱</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Fly Season (May-Jul)</p>
                  <p className="text-xs text-blue-700 mt-1">Early harvest period</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cooperative Payments</h3>
          {stats?.pending_payments > 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💰</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">Payment Pending</p>
                    <p className="text-xs text-amber-700 mt-1">{stats.pending_payments_count} delivery to cooperative</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No pending payments ✓</p>
          )}
        </div>
      </div>
    </div>
  )
}

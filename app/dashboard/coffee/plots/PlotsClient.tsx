'use client'

import Link from 'next/link'

interface PlotsClientProps {
  initialPlots: any[]
}

export default function PlotsClient({ initialPlots }: PlotsClientProps) {
  function getMatureTreeCount(plot: any): number {
    if (plot.productive_trees !== undefined && plot.productive_trees !== null) return plot.productive_trees;
    return plot.age_years >= 3 ? plot.total_trees : 0
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Coffee Plots</h1>
            <p className="text-gray-600 text-sm mt-1">{initialPlots.length} plots</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/coffee"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <Link
              href="/dashboard/coffee/plots/add"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Plot</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Plots Grid */}
      {initialPlots.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-4">☕</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No coffee plots yet</h3>
          <p className="text-gray-600 mb-4">Add your first coffee plot to get started</p>
          <Link
            href="/dashboard/coffee/plots/add"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Add Your First Plot
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialPlots.map((plot) => (
            <div
              key={plot.id || plot.plot_id}
              className="bg-white rounded-lg border-2 border-gray-200 hover:border-primary-400 hover:shadow-md transition-all p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{plot.plot_name || plot.plot_id}</h3>
                  <p className="text-sm text-gray-600">
                    {plot.variety || 'Unknown variety'} 
                    {plot.land_size_acres ? ` • ${plot.land_size_acres} acres` : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  {plot.eudr_compliant && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full border border-green-200">
                      ✓ EUDR
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs rounded-full border ${
                    plot.plant_status === 'productive' 
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                  }`}>
                    {plot.plant_status || 'active'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-xs text-gray-500">Total Trees</span>
                  <p className="text-xl font-bold text-gray-900">{plot.total_trees || 0}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Mature Trees</span>
                  <p className="text-xl font-bold text-green-600">{getMatureTreeCount(plot)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Age</span>
                  <p className="text-sm font-medium text-gray-900">
                    {plot.establishment_year ? `${new Date().getFullYear() - plot.establishment_year} years` : `${plot.age_years || 0} years`}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Planted</span>
                  <p className="text-sm font-medium text-gray-900">
                    {plot.establishment_year ? plot.establishment_year : (plot.planting_date ? new Date(plot.planting_date).getFullYear() : '—')}
                  </p>
                </div>
              </div>

              {plot.gps_latitude && plot.gps_longitude && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    📍 {plot.gps_latitude.toFixed(4)}, {plot.gps_longitude.toFixed(4)}
                  </p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                <Link
                  href={`/dashboard/coffee/plots/${plot.id || plot.plot_id}`}
                  className="flex-1 px-3 py-2 bg-primary-600 text-white text-center text-sm rounded-lg hover:bg-primary-700"
                >
                  View Details
                </Link>
                <Link
                  href={`/dashboard/coffee/harvest/record?plot=${plot.plot_id}`}
                  className="flex-1 px-3 py-2 bg-green-600 text-white text-center text-sm rounded-lg hover:bg-green-700"
                >
                  🍒 Record Harvest
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

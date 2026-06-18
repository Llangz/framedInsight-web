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
            <h1 className="text-2xl font-bold text-white">Coffee Plots</h1>
            <p className="text-[#6B7280] text-sm mt-1">{initialPlots.length} plots</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/coffee"
              className="text-sm text-[#6B7280] hover:text-white"
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
        <div className="bg-[#0D0F14] rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-4">☕</div>
          <h3 className="text-lg font-medium text-white mb-2">No coffee plots yet</h3>
          <p className="text-[#6B7280] mb-4">Add your first coffee plot to get started</p>
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
              className="bg-[#0D0F14] rounded-lg border-2 border-[#2A2D35] hover:border-primary-400 hover:shadow-md transition-all p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{plot.plot_name || plot.plot_id}</h3>
                  <p className="text-sm text-[#6B7280]">
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
                  <span className="text-xs text-[#6B7280]">Total Trees</span>
                  <p className="text-xl font-bold text-white">{plot.total_trees || 0}</p>
                </div>
                <div>
                  <span className="text-xs text-[#6B7280]">Mature Trees</span>
                  <p className="text-xl font-bold text-green-600">{getMatureTreeCount(plot)}</p>
                </div>
                <div>
                  <span className="text-xs text-[#6B7280]">Age</span>
                  <p className="text-sm font-medium text-white">
                    {plot.establishment_year ? `${new Date().getFullYear() - plot.establishment_year} years` : `${plot.age_years || 0} years`}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-[#6B7280]">Planted</span>
                  <p className="text-sm font-medium text-white">
                    {plot.establishment_year ? plot.establishment_year : (plot.planting_date ? new Date(plot.planting_date).getFullYear() : '—')}
                  </p>
                </div>
              </div>

              {plot.gps_latitude && plot.gps_longitude && (
                <div className="pt-4 border-t border-[#2A2D35]">
                  <p className="text-xs text-[#6B7280] flex items-center gap-1">
                    📍 {plot.gps_latitude.toFixed(4)}, {plot.gps_longitude.toFixed(4)}
                    {plot.gps_polygon && <span className="text-green-500 ml-1">· polygon</span>}
                  </p>
                </div>
              )}

              {!plot.gps_latitude && !plot.gps_polygon && (
                <div className="pt-4 border-t border-[#2A2D35] flex items-center justify-between">
                  <p className="text-xs text-amber-500 flex items-center gap-1.5">
                    ⚠️ No GPS boundary — required for EUDR
                  </p>
                  <Link
                    href={`/dashboard/coffee/plots/${plot.id || plot.plot_id}/edit`}
                    className="text-xs text-amber-400 hover:text-amber-300 underline"
                  >
                    Map now →
                  </Link>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-[#2A2D35] flex gap-2">
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
'use client'

import { useState } from 'react'
import { FileCheck, Download, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react'

interface PlotData {
  id: string
  farm_id: string
  plot_name: string
  variety: string
  total_trees: number
  gps_latitude: number | null
  gps_longitude: number | null
  gps_polygon: any
  area_hectares: number
  eudr_risk_level: string
  afa_geo_mapping_id: string | null
  land_size_acres: number
  owner_name: string
  farm_name: string
}

interface Props {
  plots: PlotData[]
  coopName: string
}

export default function EudrClient({ plots, coopName }: Props) {
  const [filter, setFilter] = useState<'all' | 'compliant' | 'missing'>('all')

  const totalPlots = plots.length
  const mappedPlots = plots.filter(p => p.gps_latitude && p.gps_longitude)
  const missingMapCount = totalPlots - mappedPlots.length

  const polygonRequiredCount = plots.filter(p => p.area_hectares >= 4).length
  const polygonMappedCount = plots.filter(p => p.area_hectares >= 4 && p.gps_polygon).length

  const compliantPlots = plots.filter(p => {
    // Has mapping coordinates
    if (!p.gps_latitude || !p.gps_longitude) return false
    // If >= 4 ha, must have polygon
    if (p.area_hectares >= 4 && !p.gps_polygon) return false
    // Must be low risk
    return p.eudr_risk_level === 'low'
  })

  const filteredPlots = plots.filter(p => {
    if (filter === 'compliant') {
      return compliantPlots.some(cp => cp.id === p.id)
    }
    if (filter === 'missing') {
      return !p.gps_latitude || !p.gps_longitude || (p.area_hectares >= 4 && !p.gps_polygon)
    }
    return true
  })

  // Consolidated GeoJSON Generation
  const handleExportGeoJSON = () => {
    const validPlots = plots.filter(p => p.gps_latitude && p.gps_longitude)

    if (validPlots.length === 0) {
      alert('No mapped plots to export. Please map at least one farmer plot.')
      return
    }

    const featureCollection = {
      type: 'FeatureCollection',
      name: `${coopName.replace(/\s+/g, '_')}_EUDR_Due_Diligence`,
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
      },
      features: validPlots.map(plot => {
        // Compile geometry
        let geometry = null
        if (plot.gps_polygon && plot.gps_polygon.geometry) {
          geometry = plot.gps_polygon.geometry
        } else {
          geometry = {
            type: 'Point',
            coordinates: [plot.gps_longitude!, plot.gps_latitude!]
          }
        }

        return {
          type: 'Feature',
          geometry,
          properties: {
            plot_id: plot.id,
            farm_name: plot.farm_name,
            owner_name: plot.owner_name,
            plot_name: plot.plot_name,
            variety: plot.variety,
            total_trees: plot.total_trees,
            area_hectares: Number(plot.area_hectares.toFixed(4)),
            land_size_acres: Number(plot.land_size_acres.toFixed(2)),
            afa_geo_mapping_id: plot.afa_geo_mapping_id,
            eudr_risk_level: plot.eudr_risk_level,
            export_category: plot.area_hectares >= 4 ? 'polygon' : 'centroid',
            cooperative_name: coopName,
          }
        }
      })
    }

    // Trigger download
    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${coopName.toLowerCase().replace(/\s+/g, '_')}_eudr_export.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Outfit'] bg-[#0A0C10] min-h-screen text-white">
      
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2D35] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">EUDR Compliance Hub</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Monitor deforestation risk assessments, check polygon validation, and download compliance GeoJSON statements.
          </p>
        </div>
        <button
          onClick={handleExportGeoJSON}
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm text-sm cursor-pointer"
        >
          <Download size={16} />
          Export Consolidated GeoJSON
        </button>
      </div>

      {/* ── EUDR Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Compliance Rate */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Deforestation Free Rate</span>
            <ShieldCheck size={20} className="text-emerald-500" />
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-bold text-white">
              {totalPlots > 0 ? Math.round((compliantPlots.length / totalPlots) * 100) : 0}%
            </h2>
            <p className="text-zinc-500 text-xs mt-1 leading-normal">
              {compliantPlots.length} of {totalPlots} member plots are classified as Deforestation-Free and low deforestation risk.
            </p>
          </div>
        </div>

        {/* Mapped Centroids vs Polygons */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Mapping Completeness</span>
            <FileCheck size={20} className="text-blue-500" />
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-bold text-white">
              {mappedPlots.length} <span className="text-sm font-normal text-zinc-500">/ {totalPlots} plots</span>
            </h2>
            <p className="text-zinc-500 text-xs mt-1 leading-normal">
              {missingMapCount > 0 ? `${missingMapCount} plots lack GPS coordinates. Extension officers must map these first.` : 'All plots have GPS locations recorded.'}
            </p>
          </div>
        </div>

        {/* Large Plots Polygon Validation */}
        <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Polygon Compliance (&ge; 4 ha)</span>
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-bold text-white">
              {polygonMappedCount} <span className="text-sm font-normal text-zinc-500">/ {polygonRequiredCount}</span>
            </h2>
            <p className="text-zinc-500 text-xs mt-1 leading-normal">
              Under EU rules, plots of 4 hectares or more MUST be mapped using coordinates showing the full polygon boundary, not just centroids.
            </p>
          </div>
        </div>

      </div>

      {/* ── Filter Controls ── */}
      <div className="flex items-center gap-2 border-b border-[#2A2D35] pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
        >
          All Plots ({totalPlots})
        </button>
        <button
          onClick={() => setFilter('compliant')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === 'compliant' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-white'}`}
        >
          Compliant Only ({compliantPlots.length})
        </button>
        <button
          onClick={() => setFilter('missing')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === 'missing' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-white'}`}
        >
          Action Required ({totalPlots - compliantPlots.length})
        </button>
      </div>

      {/* ── Table Representation ── */}
      <div className="bg-[#0D0F14] border border-[#2A2D35] rounded-2xl overflow-hidden">
        {filteredPlots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2D35] bg-[#0A0C10]/40 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Farmer / Farm</th>
                  <th className="px-6 py-4">Plot Name</th>
                  <th className="px-6 py-4">Size (ha / ac)</th>
                  <th className="px-6 py-4">Compliance Type</th>
                  <th className="px-6 py-4 text-center">EUDR Risk</th>
                  <th className="px-6 py-4">AFA Mapping ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35] text-sm">
                {filteredPlots.map(p => {
                  const isLargePlot = p.area_hectares >= 4
                  const hasCoordinates = p.gps_latitude && p.gps_longitude
                  const hasPolygon = !!p.gps_polygon
                  
                  let complianceLabel = 'Unmapped'
                  let complianceColor = 'text-red-400 bg-red-950/20 border-red-900/40'
                  
                  if (hasCoordinates) {
                    if (isLargePlot) {
                      if (hasPolygon) {
                        complianceLabel = 'Polygon Compliant'
                        complianceColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40'
                      } else {
                        complianceLabel = 'Polygon Missing (Required)'
                        complianceColor = 'text-amber-400 bg-amber-950/20 border-amber-900/40'
                      }
                    } else {
                      complianceLabel = hasPolygon ? 'Polygon (Centroid ok)' : 'Centroid Compliant'
                      complianceColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40'
                    }
                  }

                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{p.owner_name}</div>
                        <div className="text-zinc-500 text-xs mt-0.5">{p.farm_name}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-300">
                        {p.plot_name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-zinc-300">{p.area_hectares.toFixed(3)} ha</div>
                        <div className="text-zinc-500 text-xs">{p.land_size_acres.toFixed(2)} acres</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border ${complianceColor}`}>
                          {complianceLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
                          p.eudr_risk_level === 'low' ? 'bg-emerald-950 text-emerald-400' :
                          p.eudr_risk_level === 'medium' ? 'bg-amber-950 text-amber-400' :
                          'bg-red-950 text-red-400'
                        }`}>
                          {p.eudr_risk_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-300">
                        {p.afa_geo_mapping_id ? (
                          <span className="font-mono text-xs">{p.afa_geo_mapping_id}</span>
                        ) : (
                          <span className="text-zinc-600 font-sans italic text-xs">Not uploaded yet</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-zinc-500 text-sm">
            No member plots match the selected filter.
          </div>
        )}
      </div>

    </div>
  )
}

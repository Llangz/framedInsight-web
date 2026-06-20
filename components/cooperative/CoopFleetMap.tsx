'use client'

import { useEffect, useRef, useState } from 'react'

interface PlotData {
  id: string
  plot_name: string
  gps_latitude: number | null
  gps_longitude: number | null
  gps_polygon: any
  total_trees: number
  land_size_acres: number | null
  eudr_risk_level: string | null
  owner_name: string
  farm_name: string
}

interface Props {
  plots: PlotData[]
  className?: string
}

export default function CoopFleetMap({ plots, className = '' }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return

    const initMap = async () => {
      try {
        if (!mapContainerRef.current) return
        const L = (await import('leaflet')).default
        await import('leaflet/dist/leaflet.css')

        // Fix broken default icons
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // Find centroid of all plots or fallback to Kenya center
        const validCoords = plots.filter(p => p.gps_latitude && p.gps_longitude)
        const center: [number, number] = validCoords.length > 0
          ? [validCoords[0].gps_latitude!, validCoords[0].gps_longitude!]
          : [-1.2921, 36.8219] // Nairobi

        const map = L.map(mapContainerRef.current, {
          center,
          zoom: validCoords.length > 0 ? 15 : 7,
          zoomControl: true,
          attributionControl: false,
        })

        // Satellite view
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19 }
        ).addTo(map)

        // Labels
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, maxNativeZoom: 19, opacity: 0.8 }
        ).addTo(map)

        // Plot polygons and markers
        const bounds: any[] = []

        plots.forEach(plot => {
          if (!plot.gps_latitude || !plot.gps_longitude) return

          const statusColor = plot.eudr_risk_level === 'low' ? '#10B981' : // Green
                             plot.eudr_risk_level === 'medium' ? '#F59E0B' : // Amber
                             plot.eudr_risk_level === 'high' ? '#EF4444' : // Red
                             '#6B7280' // Gray

          // 1. Draw polygon if available
          if (plot.gps_polygon && plot.gps_polygon.geometry && plot.gps_polygon.geometry.coordinates) {
            try {
              // GeoJSON format: coordinates is [[ [lng, lat], [lng, lat], ... ]]
              const coords = plot.gps_polygon.geometry.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]])
              const polygon = L.polygon(coords, {
                color: statusColor,
                weight: 2,
                fillColor: statusColor,
                fillOpacity: 0.3,
              }).addTo(map)

              polygon.bindPopup(`
                <div class="text-zinc-900 font-sans p-1">
                  <h4 class="font-bold text-sm text-zinc-950">${plot.farm_name}</h4>
                  <p class="text-xs text-zinc-600 mt-0.5">Owner: ${plot.owner_name}</p>
                  <p class="text-xs text-zinc-600">Plot: ${plot.plot_name}</p>
                  <p class="text-xs text-zinc-600">Trees: ${plot.total_trees} · Size: ${plot.land_size_acres || 'N/A'} ac</p>
                  <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 text-white" style="background-color: ${statusColor}">
                    EUDR Status: ${plot.eudr_risk_level || 'Unknown'}
                  </span>
                </div>
              `)
              bounds.push(coords)
            } catch (err) {
              console.error('Error drawing plot polygon:', err)
            }
          } else {
            // 2. Draw standard marker if no polygon
            const marker = L.marker([plot.gps_latitude, plot.gps_longitude]).addTo(map)
            marker.bindPopup(`
              <div class="text-zinc-900 font-sans p-1">
                <h4 class="font-bold text-sm text-zinc-950">${plot.farm_name}</h4>
                <p class="text-xs text-zinc-600 mt-0.5">Owner: ${plot.owner_name}</p>
                <p class="text-xs text-zinc-600">Centroid Only (No polygon mapped)</p>
                <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 text-white" style="background-color: ${statusColor}">
                  EUDR Status: ${plot.eudr_risk_level || 'Unknown'}
                </span>
              </div>
            `)
            bounds.push([[plot.gps_latitude, plot.gps_longitude]])
          }
        })

        // Auto-fit to bounds if we have valid elements
        if (bounds.length > 0 && map) {
          const flatBounds = bounds.flat()
          const lBounds = L.latLngBounds(flatBounds as any)
          map.fitBounds(lBounds, { padding: [30, 30] })
        }

        mapRef.current = map
        setMapLoaded(true)
      } catch (err) {
        console.error('Leaflet initialization failed:', err)
      }
    }

    initMap()

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {}
        mapRef.current = null
      }
    }
  }, [plots])

  return (
    <div className={`relative rounded-xl overflow-hidden bg-zinc-900 border border-[#2A2D35] ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-[1000]">
          <p className="text-sm text-zinc-400">Loading satellite fleet map…</p>
        </div>
      )}
    </div>
  )
}
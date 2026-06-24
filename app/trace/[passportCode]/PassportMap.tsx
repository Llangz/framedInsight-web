'use client'

/**
 * app/trace/[passportCode]/PassportMap.tsx
 * Lightweight Leaflet map showing the cooperative origin.
 * Dynamic import only — never SSR'd.
 */

import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  label: string
}

export default function PassportMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return

      // Fix default icon path (Leaflet quirk with bundlers)
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current!, {
        center: [lat, lng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: false,
      })

      // Satellite tile — Esri World Imagery
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Esri' }
      ).addTo(map)

      // Warm parchment pin
      const icon = L.divIcon({
        html: `<div style="
          width:28px; height:28px; border-radius:50% 50% 50% 0;
          background:#C9A96E; border:2px solid #fff;
          transform:rotate(-45deg);
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
        "></div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      })

      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindTooltip(label, { permanent: true, direction: 'top', className: 'passport-tip' })

      mapRef.current = map

      // Add Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Custom tooltip style
      const style = document.createElement('style')
      style.textContent = `
        .passport-tip {
          background: #0D0F14 !important;
          border: 1px solid #C9A96E44 !important;
          color: #C9A96E !important;
          font-size: 10px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .passport-tip::before { display: none; }
        .leaflet-control-attribution { display: none; }
      `
      document.head.appendChild(style)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [lat, lng, label])

  return <div ref={containerRef} className="w-full h-full bg-[#0A0C10]" />
}
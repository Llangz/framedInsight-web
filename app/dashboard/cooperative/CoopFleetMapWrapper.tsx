'use client'

import dynamic from 'next/dynamic'

const CoopFleetMap = dynamic(
  () => import('@/components/cooperative/CoopFleetMap'),
  { ssr: false }
)

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

export default function CoopFleetMapWrapper({ plots, className }: { plots: PlotData[]; className?: string }) {
  return <CoopFleetMap plots={plots} className={className} />
}

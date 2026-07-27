/**
 * Builds the Leaflet-ready URL template for the `sentinel-tile` Supabase Edge
 * Function (see supabase/functions/sentinel-tile/index.ts) — Sentinel-2
 * true-color imagery served as standard {z}/{x}/{y} tiles, used as the
 * satellite fallback for locations where Esri's World Imagery has no real
 * coverage (see the long comment above the 'tileplaceholder' handling in
 * PlotBoundaryMapper.tsx for why that's a real, common case in rural areas).
 *
 * Returns null if NEXT_PUBLIC_SUPABASE_URL isn't configured, so callers can
 * skip straight to the OSM fallback rather than requesting a broken URL.
 */
export function sentinelTileUrlTemplate(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/functions/v1/sentinel-tile?z={z}&x={x}&y={y}`
}

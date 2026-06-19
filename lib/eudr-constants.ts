/**
 * eudr-constants.ts — framedInsight
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for EUDR regulatory constants used across:
 *   • PlotBoundaryMapper (geolocation format branching, coordinate precision)
 *   • check-eudr-risk edge function (risk thresholds, write target)
 *   • /api/coffee/eudr route (deadlines, document handling)
 *   • EUDRFleetClient (deadline banners, Kenya risk-tier messaging)
 *
 * REGULATORY NOTES (as of June 2026):
 *
 * Deadline — Regulation (EU) 2025/2650 (in force May 2026):
 *   Large/medium operators:              30 December 2026
 *   Micro/small operators (incl. coffee): 30 June 2027   ← most Kenyan farmers
 *   A further simplification review is scheduled for 2026 so this may shift
 *   again — this is why deadlines live here, not scattered through the code.
 *
 * Kenya risk tier — EU May 2025 country benchmarking:
 *   Kenya = STANDARD risk (same as most African coffee origins).
 *   There is no simplified due-diligence relief for standard-risk countries.
 *   Full plot-level geolocation + deforestation-free evidence is required
 *   regardless of farm size — only the enforcement deadline differs by operator
 *   size, not the rigour of the due diligence.
 *
 * Geolocation format (Art. 9(1)(d)):
 *   Plots < 4 ha  → single latitude/longitude point, ≥ 6 decimal places
 *   Plots ≥ 4 ha  → polygon perimeter in GeoJSON, ≥ 6 decimal places
 *   Both coordinates always use WGS84 (EPSG:4326) decimal degrees.
 *   The overwhelming majority of Kenyan smallholder coffee plots are < 1 ha,
 *   so point format is the expected default here.
 *
 * GFW / Hansen dataset caveat:
 *   The 30m Hansen/UMD tree-cover-loss layer (queried via GFW Data API) is
 *   the only dataset feasible for per-plot screening at this resolution.
 *   The "dominant driver" layer (WRI/Google DeepMind) operates at 1 km grid
 *   cells — far too coarse to attribute loss cause for a 0.2–1 ha plot —
 *   so it cannot be used for per-plot EUDR screening.
 *   Hansen over-flags coffee agroforestry as "forest loss"; we compensate by
 *   widening the "low" threshold and adding a minimum meaningful loss guard
 *   (< 0.03 ha absolute is treated as noise, not deforestation).
 *   The AFA geo-mapping programme remains the authoritative compliance source.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Deadlines ─────────────────────────────────────────────────────────────────

/** ISO date: enforcement deadline for large/medium operators */
export const EUDR_DEADLINE_LARGE = '2026-12-30'

/** ISO date: enforcement deadline for micro/small operators (most Kenyan coffee farmers) */
export const EUDR_DEADLINE_SMALL = '2027-06-30'

/** Human-readable labels for UI banners */
export const EUDR_DEADLINE_LARGE_LABEL = 'December 30, 2026'
export const EUDR_DEADLINE_SMALL_LABEL  = 'June 30, 2027'

/** Returns days remaining to the micro/small operator deadline from today */
export function daysUntilEudrDeadline(): number {
  return Math.ceil((new Date(EUDR_DEADLINE_SMALL).getTime() - Date.now()) / 86_400_000)
}

// ── Kenya risk tier ───────────────────────────────────────────────────────────

export const KENYA_EUDR_RISK_TIER = 'standard' as const

/**
 * Plain-language explainer for the Kenya risk tier.
 * Suitable for display in the dashboard compliance banner.
 */
export const KENYA_RISK_TIER_EXPLAINER =
  'Kenya is classified as a standard-risk country under the EU May 2025 ' +
  'country benchmarking. This means no simplified due-diligence relief applies — ' +
  'full plot-level GPS evidence and deforestation-free proof are required for ' +
  'every plot, regardless of farm size. Only the enforcement deadline differs ' +
  'by operator size.'

// ── Geolocation format ────────────────────────────────────────────────────────

/** Plots at or above this area (hectares) must submit a polygon; below = point */
export const EUDR_POLYGON_THRESHOLD_HA = 4

/**
 * Round a coordinate to the 6 decimal places required by EUDR Art. 9(1)(d).
 * Applied to every lat/lng before storage so the GeoJSON is compliant
 * by construction.
 */
export function roundToEudrPrecision(coord: number): number {
  return Math.round(coord * 1_000_000) / 1_000_000
}

/**
 * Determine which EUDR geolocation format applies for a given plot area.
 * Consumers preparing AFA/cooperative export documentation should use this
 * to decide whether to send the centroid point or the full polygon.
 */
export function getEudrGeolocationFormat(areaHa: number): 'point' | 'polygon' {
  return areaHa >= EUDR_POLYGON_THRESHOLD_HA ? 'polygon' : 'point'
}

// ── GFW / risk thresholds ─────────────────────────────────────────────────────

/**
 * Minimum "meaningful" absolute tree-cover loss (ha) before we flag any risk.
 * Loss below this is treated as noise / normal coffee-husbandry canopy
 * management, not deforestation. This guards against Hansen over-flagging
 * tiny agroforestry maintenance on small plots.
 */
export const EUDR_MIN_MEANINGFUL_LOSS_HA = 0.03

/**
 * Risk ratio thresholds (loss ha / plot area ha).
 * Widened from a naive 1%/10% split to account for GFW false-positive rate
 * on coffee agroforestry canopy.
 *   < MIN_MEANINGFUL_LOSS_HA absolute  → 'low' (noise guard)
 *   ratio < LOW_RATIO                  → 'low'
 *   ratio < HIGH_RATIO                 → 'medium'
 *   ratio ≥ HIGH_RATIO                 → 'high'
 */
export const EUDR_RISK_RATIO_LOW  = 0.02   // < 2%  → low
export const EUDR_RISK_RATIO_HIGH = 0.12   // ≥ 12% → high (medium in between)

// ── Reference date ────────────────────────────────────────────────────────────

/**
 * EUDR forest-cover reference date: tree cover loss AFTER this date is the
 * legally relevant window. Loss before this date does not trigger non-compliance.
 */
export const EUDR_REFERENCE_DATE = '2020-12-31'
export const EUDR_REFERENCE_YEAR = 2020
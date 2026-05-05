/**
 * Kenya Electoral Divisions - 47 Counties, 302 Constituencies, 1450 Wards
 * 
 * ⚠️  DATA IS AUTO-GENERATED - DO NOT EDIT MANUALLY
 * 
 * Pipeline:  scripts/ingest_kenya_locations.py
 * Source:    lib/Kenya_Wards/kenya_wards.shp (verified IEBC Shapefile)
 * Generated: lib/kenyaLocations.ts
 * 
 * To update:
 * 1. Run: python scripts/ingest_kenya_locations.py
 * 2. Files auto-regenerate: kenyaLocations.ts, counties.json, constituencies.json, wards.json
 */

import { kenyaLocations as RAW_DATA } from './kenyaLocations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Ward {
  id: string;
  name: string;
  constituency_id: string;
}

export interface Constituency {
  id: string;
  name: string;
  wards: Ward[];
}

export interface County {
  id: string;
  name: string;
  constituencies: Constituency[];
}

// ============================================================================
// EXPORTED DATA
// ============================================================================

/**
 * All Kenya locations - auto-generated from verified IEBC Shapefile
 * 47 Counties | 302 Constituencies | 1450 Wards
 */
export const KENYA_LOCATIONS: County[] = RAW_DATA;

/**
 * Flatten all wards for efficient search
 */
export const ALL_WARDS: (Ward & { county: string; constituency: string })[] = KENYA_LOCATIONS.flatMap(c =>
  c.constituencies.flatMap(con =>
    con.wards.map(w => ({
      ...w,
      county: c.name,
      constituency: con.name,
    }))
  )
);

// ============================================================================
// GETTER FUNCTIONS
// ============================================================================

/**
 * Search wards by name (typeahead)
 */
export function searchWards(query: string): (Ward & { county: string; constituency: string; display: string })[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return ALL_WARDS.filter(w =>
    w.name.toLowerCase().includes(q) ||
    w.county.toLowerCase().includes(q) ||
    w.constituency.toLowerCase().includes(q)
  )
    .map(w => ({
      ...w,
      display: `${w.name}, ${w.constituency}, ${w.county}`,
    }))
    .slice(0, 20);
}

/**
 * Get all counties
 */
export function getCounties(): { id: string; name: string }[] {
  return KENYA_LOCATIONS.map(c => ({ id: c.id, name: c.name }));
}

/**
 * Get constituencies for a county
 */
export function getConstituencies(countyId: string): { id: string; name: string }[] {
  const c = KENYA_LOCATIONS.find(c => c.id === countyId);
  return c?.constituencies.map(con => ({ id: con.id, name: con.name })) || [];
}

/**
 * Get wards for a constituency
 */
export function getWards(constituencyId: string): Ward[] {
  for (const c of KENYA_LOCATIONS) {
    const con = c.constituencies.find(con => con.id === constituencyId);
    if (con) return con.wards;
  }
  return [];
}

/**
 * Get ward details by ID
 */
export function getWardDetails(wardId: string): (Ward & { county: string; constituency: string }) | null {
  return ALL_WARDS.find(w => w.id === wardId) || null;
}

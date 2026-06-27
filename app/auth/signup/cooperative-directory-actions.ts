'use server'

/**
 * app/auth/signup/cooperative-directory-actions.ts
 *
 * Public, unauthenticated lookups for the "cooperative you supply to"
 * selector on the individual farmer signup form. Runs before the farmer
 * has an account, so this intentionally does NOT call validateCoopAccess —
 * it only ever returns non-sensitive directory fields (name, county,
 * factory name/code), never registration_number, commissioner_ref, or
 * registered_office, even though RLS now permits reading those too.
 *
 * IMPORTANT: this only searches cooperatives that are already
 * framedInsight tenants. A farmer whose real-world FCS hasn't signed up
 * yet won't find it here — the "my cooperative isn't listed" free-text
 * fallback on the signup form exists specifically for that case.
 */

import { createClient } from '@/lib/supabase/server'

export interface CooperativeDirectoryEntry {
  id: string
  cooperative_name: string
  county: string | null
}

export interface FactoryDirectoryEntry {
  id: string
  factory_name: string
  factory_code: string | null
}

export interface FcsDirectoryEntry {
  id: string
  fcs_name: string
  county: string
  source_url: string
}

export interface FcsFactoryDirectoryEntry {
  id: string
  factory_name: string
}

export async function getCooperativeDirectory(county?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('cooperatives')
    .select('id, cooperative_name, county')
    .order('cooperative_name')

  if (county) {
    query = query.eq('county', county)
  }

  const { data, error } = await query

  if (error) {
    console.error('getCooperativeDirectory error:', error)
    return { cooperatives: [] as CooperativeDirectoryEntry[] }
  }

  return { cooperatives: (data ?? []) as CooperativeDirectoryEntry[] }
}

export async function getFactoriesForCooperative(cooperativeId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coop_factories')
    .select('id, factory_name, factory_code')
    .eq('cooperative_id', cooperativeId)
    .order('factory_name')

  if (error) {
    console.error('getFactoriesForCooperative error:', error)
    return { factories: [] as FactoryDirectoryEntry[] }
  }

  return { factories: (data ?? []) as FactoryDirectoryEntry[] }
}

/**
 * Phase 2 fallback: the national coffee_fcs_directory reference table
 * (real, sourced cooperatives — see 20260628_national_fcs_directory.sql —
 * NOT framedInsight tenants). Used when the on-platform directory above
 * has no match for the farmer's county, so they can still find their
 * real cooperative even though it hasn't signed up yet. Excludes any
 * row already matched_cooperative_id'd to a live tenant, since that one
 * would already be showing up via getCooperativeDirectory above.
 */
export async function getFcsDirectory(county?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('coffee_fcs_directory')
    .select('id, fcs_name, county, source_url')
    .is('matched_cooperative_id', null)
    .order('fcs_name')

  if (county) {
    query = query.eq('county', county)
  }

  const { data, error } = await query

  if (error) {
    console.error('getFcsDirectory error:', error)
    return { fcsEntries: [] as FcsDirectoryEntry[] }
  }

  return { fcsEntries: (data ?? []) as FcsDirectoryEntry[] }
}

export async function getFactoriesForFcsDirectory(fcsDirectoryId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coffee_fcs_factories_directory')
    .select('id, factory_name')
    .eq('fcs_directory_id', fcsDirectoryId)
    .order('factory_name')

  if (error) {
    console.error('getFactoriesForFcsDirectory error:', error)
    return { factories: [] as FcsFactoryDirectoryEntry[] }
  }

  return { factories: (data ?? []) as FcsFactoryDirectoryEntry[] }
}
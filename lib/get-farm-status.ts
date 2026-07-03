// lib/get-farm-status.ts
//
// Single source of truth for "does this user already have a farm?" —
// used by app/auth/login/page.tsx, app/onboarding/page.tsx, and
// app/dashboard/layout.tsx, which previously each had their own,
// slightly different copy of this check.
//
// THE BUG THIS FIXES: every previous copy did `const { data } = await
// supabase.from('farm_managers')...` and only ever looked at `data`.
// A failed query (network blip, transient auth-context timing, cold
// start) returns `{ data: null, error }` — indistinguishable from a
// genuine "no farm" `data: null` result once you stop reading `error`.
// All call sites treated "I don't know" as "no farm" and silently
// redirected an existing user back to onboarding. This resolver forces
// callers to handle the 'unknown' case explicitly instead of guessing.

import type { SupabaseClient } from '@supabase/supabase-js'

export type FarmStatus =
  | { state: 'has_farm'; farmId: string; role?: string | null }
  | { state: 'no_farm' }
  | { state: 'unknown'; reason: string }

export async function getFarmStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<FarmStatus> {
  const { data, error } = await supabase
    .from('farm_managers')
    .select('farm_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // Do NOT collapse this into 'no_farm'. Callers must decide how to
    // handle "we couldn't verify" — retry, show an error, or (as a last
    // resort, logged) fail toward dashboard rather than onboarding, since
    // re-onboarding an existing farm is the more destructive failure mode.
    return { state: 'unknown', reason: error.message }
  }

  if (data?.farm_id) {
    return { state: 'has_farm', farmId: data.farm_id, role: data.role }
  }

  return { state: 'no_farm' }
}
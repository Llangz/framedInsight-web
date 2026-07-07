// lib/get-farm-status.ts
//
// Single source of truth for "does this user already have a farm?" —
// used by app/auth/login/page.tsx, app/onboarding/page.tsx, and
// app/dashboard/layout.tsx, which previously each had their own,
// slightly different copy of this check.
//
// THE BUG THIS FIXES (v1): every previous copy did `const { data } = await
// supabase.from('farm_managers')...` and only ever looked at `data`.
// A failed query (network blip, transient auth-context timing, cold
// start) returns `{ data: null, error }` — indistinguishable from a
// genuine "no farm" `data: null` result once you stop reading `error`.
// All call sites treated "I don't know" as "no farm" and silently
// redirected an existing user back to onboarding. This resolver forces
// callers to handle the 'unknown' case explicitly instead of guessing.
//
// THE BUG THIS FIXES (v2): `farm_managers` has no unique constraint on
// `user_id` alone (its PK is composite: farm_id + user_id) and no FK from
// `farm_id` to `farms.id` — so it is possible, and has happened in
// practice (leftover rows from the earlier duplicate-farm-creation bug),
// for a user to have more than one `farm_managers` row, or a row that
// points at a farm which no longer exists. `.single()` / `.maybeSingle()`
// on a plain `eq('user_id', ...)` throws on 2+ rows, which every prior
// version of this function surfaced as a hard, unrecoverable "unknown"
// error — even though two of the three sub-cases below are perfectly
// resolvable without any manual intervention.
//
// This version fetches ALL rows for the user, joins each to its farm to
// find out which ones are still real, and only gives up (`unknown` /
// `ambiguous`) when there's genuinely no safe automatic answer.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface FarmIdentity {
  phone?: string | null
  email?: string | null
  fullName?: string | null
}

function normalizePhone(value?: string | null): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('254')) return digits
  return null
}

// NOTE: kept for reference / potential reuse elsewhere, but the actual
// unlinked-farm lookup below (findUnlinkedMatchingFarm) intentionally
// reimplements a NARROWER version of this check (phone/email only, no
// owner_name fallback) rather than calling this directly — see that
// function's comment for why the name-match branch is excluded there.
function matchesIdentity(
  farm: { phone?: string | null; email?: string | null; owner_name?: string | null },
  identity?: FarmIdentity
): boolean {
  if (!identity) return false

  const normalizedFarmPhone = normalizePhone(farm.phone)
  const normalizedUserPhone = normalizePhone(identity.phone)
  if (normalizedFarmPhone && normalizedUserPhone && normalizedFarmPhone === normalizedUserPhone) {
    return true
  }

  const farmEmail = farm.email?.trim().toLowerCase()
  const userEmail = identity.email?.trim().toLowerCase()
  if (farmEmail && userEmail && farmEmail === userEmail) {
    return true
  }

  const farmOwner = farm.owner_name?.trim().toLowerCase()
  const userName = identity.fullName?.trim().toLowerCase()
  if (farmOwner && userName && farmOwner === userName) {
    return true
  }

  return false
}

// Looks for an existing farms row that (a) has no farm_managers row at all
// yet, and (b) matches the given identity by phone or email. Deliberately
// does NOT use matchesIdentity()'s owner_name-only fallback here — a name
// match alone is too weak a signal to auto-suggest linking someone to a
// farm record (common names collide; this must stay to phone/email, the
// two identifiers that are actually unique in practice).
async function findUnlinkedMatchingFarm(
  supabase: SupabaseClient,
  identity?: FarmIdentity
): Promise<{ id: string; farm_name: string | null } | null> {
  if (!identity) return null

  const normalizedPhone = normalizePhone(identity.phone)
  const email = identity.email?.trim().toLowerCase() || null
  if (!normalizedPhone && !email) return null

  const orParts: string[] = []
  if (normalizedPhone) orParts.push(`phone.eq.${normalizedPhone}`, `phone.eq.+${normalizedPhone}`)
  if (email) orParts.push(`email.eq.${email}`)
  if (orParts.length === 0) return null

  const { data: candidates } = await supabase
    .from('farms')
    .select('id, farm_name, phone, email, owner_name')
    .or(orParts.join(','))
    .limit(5)

  if (!candidates || candidates.length === 0) return null

  const candidateIds = candidates.map((c: any) => c.id)
  const { data: managerRows } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .in('farm_id', candidateIds)

  const alreadyManagedIds = new Set((managerRows ?? []).map((r: any) => r.farm_id))
  const unmanaged = candidates.filter((c: any) => !alreadyManagedIds.has(c.id))

  // Prefer a phone match over an email-only match if both exist among the
  // unmanaged candidates.
  const phoneMatch = unmanaged.find(
    (c: any) => normalizedPhone && normalizePhone(c.phone) === normalizedPhone
  )
  const best = phoneMatch ?? unmanaged[0]

  return best ? { id: best.id, farm_name: best.farm_name } : null
}

export type FarmStatus =
  | { state: 'has_farm'; farmId: string; role?: string | null }
  | { state: 'no_farm' }
  // Every farm_managers row for this user points at a farm that no longer
  // exists (deleted farm, or a row left behind by an earlier bug). Not
  // fixable by retrying, and NOT safe to silently send to onboarding
  // (createFarmOnSignup would insert yet another farm_managers row on
  // top of the stale one(s) rather than replacing them) — needs the
  // stale row(s) cleaned up first, then a fresh onboarding pass.
  | { state: 'orphaned'; reason: string; staleFarmIds: string[] }
  // 2+ rows, pointing at 2+ DIFFERENT farms that all still exist. This is
  // either intentional (a user genuinely managing multiple farms — the
  // schema allows it) or a leftover duplicate — the resolver can't tell
  // which, so it doesn't guess. Needs a human (support, or eventually a
  // farm-switcher UI) to decide.
  | { state: 'ambiguous'; reason: string; farmIds: string[] }
  // A genuine query failure: network blip, transient auth-context timing,
  // cold start. Callers must decide how to handle "we couldn't verify" —
  // retry, show an error, or (as a last resort, logged) fail toward
  // dashboard rather than onboarding, since re-onboarding an existing farm
  // is the more destructive failure mode.
  | { state: 'unknown'; reason: string }
  // No farm_managers row for this user, BUT an existing, unmanaged farms
  // row matches their phone/email/name (matchesIdentity() below — this
  // function existed since the original write of this file but was never
  // actually called anywhere, which is itself a strong signal this case
  // was recognized but never wired up). Most likely cause: the farm was
  // created (directly, via an import, or via an earlier signup attempt
  // that got interrupted after the `farms` insert but before the
  // `farm_managers` insert) without ever linking this account. Sending
  // this person through onboarding again risks creating a SECOND farm
  // for the same person rather than fixing the missing link — surfacing
  // it explicitly lets the caller offer "is this your farm?" instead.
  | { state: 'unlinked_match'; farmId: string; farmName?: string | null }

export async function getFarmStatus(
  supabase: SupabaseClient,
  userId: string,
  identity?: FarmIdentity
): Promise<FarmStatus> {
  const { data, error } = await supabase
    .from('farm_managers')
    .select('farm_id, role')
    .eq('user_id', userId)

  if (error) {
    return { state: 'unknown', reason: error.message }
  }

  const rows = data ?? []

  if (rows.length === 0) {
    const match = await findUnlinkedMatchingFarm(supabase, identity)
    if (match) {
      return { state: 'unlinked_match', farmId: match.id, farmName: match.farm_name }
    }
    return { state: 'no_farm' }
  }

  // NOTE: this can't be done as a single PostgREST embed (`farms(id)`) —
  // farm_managers has no FK to farms at the DB level (generated types show
  // `Relationships: []` for it), and PostgREST resource embedding requires
  // a discoverable relationship or it errors at request time. Two plain
  // queries instead: fetch the distinct farm_ids this user is linked to,
  // then check which of those farm_ids actually still exist.
  const farmIds = Array.from(new Set(rows.map((r: any) => r.farm_id)))

  const { data: existingFarms, error: farmsError } = await supabase
    .from('farms')
    .select('id, phone, email, owner_name')
    .in('id', farmIds)

  if (farmsError) {
    return { state: 'unknown', reason: farmsError.message }
  }

  const existingIds = new Set((existingFarms ?? []).map((f: any) => f.id))
  const live = rows.filter((r: any) => existingIds.has(r.farm_id))
  const stale = rows.filter((r: any) => !existingIds.has(r.farm_id))
  const liveFarmIds = Array.from(new Set(live.map((r: any) => r.farm_id)))

  if (liveFarmIds.length === 1) {
    const farmId = liveFarmIds[0]
    const row = live.find((r: any) => r.farm_id === farmId) as any
    return { state: 'has_farm', farmId, role: row?.role }
  }

  if (liveFarmIds.length === 0) {
    // Every row is stale — genuinely orphaned, not just "no farm".
    return {
      state: 'orphaned',
      reason: `${stale.length} farm_managers row(s) reference farm(s) that no longer exist`,
      staleFarmIds: Array.from(new Set(stale.map((r: any) => r.farm_id))),
    }
  }

  // live.length > 1 — multiple distinct farms this user manages, all real.
  return {
    state: 'ambiguous',
    reason: `User is linked to ${live.length} distinct farms`,
    farmIds: Array.from(new Set(live.map((r: any) => r.farm_id))),
  }
}
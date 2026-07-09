// 📁 FILE PATH: lib/safe-query.ts

/**
 * lib/safe-query.ts
 *
 * The dominant pattern across app/dashboard/**\/page.tsx is:
 *
 *   const { data: batches } = await supabase.from('poultry_batches')...
 *   ...
 *   return <Client initialBatches={(batches as any) || []} />
 *
 * `error` is destructured out and never looked at. If the query fails
 * (RLS denies it, the connection drops mid-request, Supabase returns a
 * 5xx) `data` comes back null, `|| []` quietly turns that into "this
 * farmer has zero batches," and the page renders an empty state that is
 * visually and semantically identical to genuine emptiness. Nobody sees
 * an error — the farmer just sees a dashboard that looks like they have
 * no records, which for a records/traceability product is a trust
 * problem, not just a UX one: a silently-empty coffee passport list
 * reads as "there is nothing here" rather than "we couldn't load this."
 *
 * app/dashboard/layout.tsx already fixed exactly this bug for the two
 * queries that gate access to the dashboard at all (cooperative_officer
 * check, farm status via getFarmStatus()) — see the comments there. This
 * helper generalizes that fix so it's easy to apply to the ~69 leaf-level
 * page.tsx files that each run their own module-specific queries
 * (batches, health records, milk records, coffee activities, etc.) and
 * currently don't have it.
 *
 * unwrap() throws on a real query error. Thrown errors from a Server
 * Component during render are caught by the nearest error.tsx — which is
 * now app/dashboard/error.tsx for every dashboard route — so this turns
 * a previously-silent failure into the "This page didn't load / Try
 * again" screen the farmer can actually act on. It deliberately does NOT
 * throw on a null/empty *result*; `.maybeSingle()` returning no row, or
 * a `.select()` returning `[]`, are legitimate outcomes and must keep
 * rendering the normal empty state, not an error screen.
 *
 * Usage (replaces the pattern above):
 *
 *   import { unwrap } from '@/lib/safe-query'
 *
 *   const [batchesRes, healthRes] = await Promise.all([
 *     supabase.from('poultry_batches').select('...'),
 *     supabase.from('poultry_health_records').select('...'),
 *   ])
 *   const batches = unwrap(batchesRes, 'poultry_batches')
 *   const health  = unwrap(healthRes, 'poultry_health_records')
 *
 * Migration note: this is intentionally opt-in per file (not a codemod
 * run across all 69 pages in this change) so each call site can be
 * verified against its actual query shape rather than pattern-matched
 * blind. Apply it module-by-module the same way the RLS/security passes
 * were done — this file plus app/dashboard/poultry/health/page.tsx are
 * the reference implementation to replicate.
 */

interface QueryResult<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

export function unwrap<T>(result: QueryResult<T>, context: string): T | null {
  if (result.error) {
    // Thrown during a Server Component's render → caught by the nearest
    // error.tsx boundary (app/dashboard/error.tsx for dashboard routes).
    throw new Error(`[${context}] ${result.error.message}`)
  }
  return result.data
}

/** Same as unwrap(), but returns a given fallback instead of null when the
 *  (legitimate, non-error) result is empty — convenience for call sites
 *  that immediately do `unwrap(res) || []`. */
export function unwrapOr<T>(result: QueryResult<T>, fallback: T, context: string): T {
  return unwrap(result, context) ?? fallback
}
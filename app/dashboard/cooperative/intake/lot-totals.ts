/**
 * app/dashboard/cooperative/intake/lot-totals.ts
 *
 * Pure computation for factory intake lot running totals — no Supabase/
 * Next.js imports. Split out of actions.ts specifically so it can be
 * unit-tested (see lot-totals.test.ts) without dragging in 'server-only'
 * via lib/supabase/server, which actions.ts imports at module scope and
 * which is unimportable from a plain Vitest/node environment.
 *
 * actions.ts imports computeLotTotals from here — behavior unchanged.
 * Flagging one thing this test file documents rather than silently
 * changes: total_farmers is incremented once per accepted *delivery*,
 * not per distinct farmer, so a farmer who delivers twice to the same
 * open lot is counted twice in total_farmers. That may or may not be
 * the intended definition (vs. farmCount in the passport payload, which
 * does dedupe by farm_id) — worth a product decision, not something
 * this diff changes unilaterally.
 */

export interface LotTotalsInput {
  lot: {
    total_cherry_kg?: number | null
    total_mbuni_kg?: number | null
    total_farmers?: number | null
  }
  cherryKg: number
  mbuniKg?: number
  accepted?: boolean
}

export function computeLotTotals({ lot, cherryKg, mbuniKg, accepted }: LotTotalsInput): {
  total_cherry_kg: number
  total_mbuni_kg: number
  total_farmers: number
} {
  const wasAccepted = accepted !== false
  return {
    total_cherry_kg: (lot.total_cherry_kg ?? 0) + (wasAccepted ? cherryKg : 0),
    total_mbuni_kg: (lot.total_mbuni_kg ?? 0) + (wasAccepted ? (mbuniKg ?? 0) : 0),
    total_farmers: (lot.total_farmers ?? 0) + 1,
  }
}

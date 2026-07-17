import { describe, it, expect, vi } from 'vitest'

// passport.service.ts imports the server-only Supabase client at module
// scope (for its DB-backed exports); that pulls in the `server-only`
// package, which intentionally has no importable implementation outside
// a Next.js RSC build. Stub it so this file can test the pure hash
// helpers in isolation without needing the Next.js runtime.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({}),
}))

import { stableStringify, computeHash } from '@/lib/passport/passport.service'

describe('normalizeForHash / stableStringify', () => {
  it('produces identical output regardless of key order (the jsonb drift bug this exists to prevent)', () => {
    const a = { b: 2, a: 1, c: { z: 26, y: 25 } }
    const b = { a: 1, c: { y: 25, z: 26 }, b: 2 }

    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('normalizes undefined object values away rather than serializing them inconsistently', () => {
    const withUndefined = { a: 1, b: undefined }
    const without = { a: 1 }

    expect(stableStringify(withUndefined)).toBe(stableStringify(without))
  })

  it('preserves array order (arrays are not sorted, only object keys are)', () => {
    const a = { list: [3, 1, 2] }
    const b = { list: [1, 2, 3] }

    expect(stableStringify(a)).not.toBe(stableStringify(b))
  })

  it('preserves null explicitly (null and undefined are not the same for a legal ledger)', () => {
    expect(stableStringify({ a: null })).toBe(JSON.stringify({ a: null }))
    expect(stableStringify({ a: null })).not.toBe(stableStringify({}))
  })

  it('sorts nested object keys recursively, not just at the top level', () => {
    const a = { outer: { z: 1, a: { y: 2, x: 3 } } }
    const b = { outer: { a: { x: 3, y: 2 }, z: 1 } }

    expect(stableStringify(a)).toBe(stableStringify(b))
  })
})

describe('computeHash', () => {
  const baseArgs = ['entity-1', 'delivery_accepted', { cherry_kg: 120 }, null, '2026-07-16T00:00:00.000Z'] as const

  it('is deterministic for identical inputs', () => {
    const h1 = computeHash(...baseArgs)
    const h2 = computeHash(...baseArgs)
    expect(h1).toBe(h2)
  })

  it('is a 64-char hex sha256 digest', () => {
    const h = computeHash(...baseArgs)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes when eventData changes (tamper-evidence)', () => {
    const h1 = computeHash('entity-1', 'delivery_accepted', { cherry_kg: 120 }, null, '2026-07-16T00:00:00.000Z')
    const h2 = computeHash('entity-1', 'delivery_accepted', { cherry_kg: 121 }, null, '2026-07-16T00:00:00.000Z')
    expect(h1).not.toBe(h2)
  })

  it('changes when previousHash changes (breaks the chain if an earlier link is altered)', () => {
    const h1 = computeHash('entity-1', 'delivery_accepted', { cherry_kg: 120 }, null, '2026-07-16T00:00:00.000Z')
    const h2 = computeHash('entity-1', 'delivery_accepted', { cherry_kg: 120 }, 'some-other-hash', '2026-07-16T00:00:00.000Z')
    expect(h1).not.toBe(h2)
  })

  it('treats null previousHash as GENESIS consistently (does not silently collide with a real event that happens to hash to the literal string "GENESIS")', () => {
    const h1 = computeHash('entity-1', 'evt', {}, null, '2026-07-16T00:00:00.000Z')
    const h2 = computeHash('entity-1', 'evt', {}, 'GENESIS', '2026-07-16T00:00:00.000Z')
    // Both funnel through the same "GENESIS" literal, so these SHOULD be
    // equal today — this test documents that behavior rather than
    // asserting an opinion, so a future change to the sentinel is a
    // visible, deliberate decision instead of an accidental one.
    expect(h1).toBe(h2)
  })

  it('is order-insensitive on eventData key order, same as stableStringify', () => {
    const h1 = computeHash('entity-1', 'evt', { a: 1, b: 2 }, null, '2026-07-16T00:00:00.000Z')
    const h2 = computeHash('entity-1', 'evt', { b: 2, a: 1 }, null, '2026-07-16T00:00:00.000Z')
    expect(h1).toBe(h2)
  })
})

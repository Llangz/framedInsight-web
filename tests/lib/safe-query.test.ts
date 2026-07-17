import { describe, it, expect } from 'vitest'
import { unwrap, unwrapOr } from '@/lib/safe-query'

describe('unwrap', () => {
  it('returns data through unchanged on a successful query', () => {
    expect(unwrap({ data: [1, 2, 3], error: null }, 'ctx')).toEqual([1, 2, 3])
  })

  it('returns null (not an error) for a legitimate empty result', () => {
    expect(unwrap({ data: null, error: null }, 'ctx')).toBeNull()
  })

  it('throws — does not silently return null/empty — when the query itself errored', () => {
    expect(() => unwrap({ data: null, error: { message: 'RLS denied' } }, 'poultry_batches')).toThrow(
      '[poultry_batches] RLS denied'
    )
  })
})

describe('unwrapOr', () => {
  it('returns the fallback only for a genuinely empty (non-error) result', () => {
    expect(unwrapOr({ data: null, error: null }, [], 'ctx')).toEqual([])
  })

  it('still throws on error rather than masking it behind the fallback', () => {
    expect(() => unwrapOr({ data: null, error: { message: 'timeout' } }, [], 'v_season_pnl')).toThrow(
      '[v_season_pnl] timeout'
    )
  })
})

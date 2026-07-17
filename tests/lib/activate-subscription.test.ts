import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from '../helpers/fake-supabase'

// activateSubscription() builds its own client via createClient() from
// '@supabase/supabase-js' (not the app's server-only wrapper), so that's
// the module we intercept.
const mockSupabase = { current: null as any }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase.current,
}))

import { inferTierFromMonthlyRate, activateSubscription } from '@/lib/activate-subscription'

describe('inferTierFromMonthlyRate', () => {
  it('maps KES 2000+/mo to enterprise', () => {
    expect(inferTierFromMonthlyRate(2000)).toBe('enterprise')
    expect(inferTierFromMonthlyRate(5000)).toBe('enterprise')
  })

  it('maps KES 400-1999/mo to commercial', () => {
    expect(inferTierFromMonthlyRate(400)).toBe('commercial')
    expect(inferTierFromMonthlyRate(1999)).toBe('commercial')
  })

  it('maps anything below KES 400/mo to smallholder', () => {
    expect(inferTierFromMonthlyRate(399)).toBe('smallholder')
    expect(inferTierFromMonthlyRate(0)).toBe('smallholder')
  })
})

describe('activateSubscription', () => {
  beforeEach(() => {
    mockSupabase.current = null
  })

  it('fails cleanly when the transaction has no farm_id', async () => {
    mockSupabase.current = fakeSupabase({
      transactions: { maybeSingle: { data: { activation_attempts: 0 }, error: null } },
    })

    const result = await activateSubscription({
      id: 'txn-1',
      farm_id: null,
      months_added: 1,
      amount: 400,
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no farm_id/i)
  })

  it('fails cleanly when the farm cannot be found', async () => {
    mockSupabase.current = fakeSupabase({
      farms: { single: { data: null, error: { message: 'not found' } } },
      transactions: { maybeSingle: { data: null, error: null } },
    })

    const result = await activateSubscription({
      id: 'txn-2',
      farm_id: 'farm-missing',
      months_added: 1,
      amount: 400,
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Farm not found/)
  })

  it('extends from today when there is no existing active subscription', async () => {
    mockSupabase.current = fakeSupabase({
      farms: {
        single: {
          data: { id: 'farm-1', subscription_tier: null, subscription_end_date: null },
          error: null,
        },
        update: { data: {}, error: null },
      },
      transactions: { maybeSingle: { data: { activation_attempts: 2 }, error: null }, update: { data: {}, error: null } },
    })

    const before = Date.now()
    const result = await activateSubscription({
      id: 'txn-3',
      farm_id: 'farm-1',
      months_added: 1,
      amount: 400, // 400/1 => commercial
    })

    expect(result.success).toBe(true)
    expect(result.tier).toBe('commercial')
    // New end date should be ~1 month from now, not from some stale date.
    const endDate = new Date(result.endDate!)
    const expectedMonth = (new Date(before).getMonth() + 1) % 12
    expect(endDate.getMonth()).toBe(expectedMonth)
  })

  it('stacks from the existing end date when the current subscription is still active (does not lose paid-for time)', async () => {
    const future = new Date()
    future.setMonth(future.getMonth() + 2) // still 2 months of active subscription left

    mockSupabase.current = fakeSupabase({
      farms: {
        single: {
          data: { id: 'farm-1', subscription_tier: 'commercial', subscription_end_date: future.toISOString() },
          error: null,
        },
        update: { data: {}, error: null },
      },
      transactions: { maybeSingle: { data: { activation_attempts: 0 }, error: null }, update: { data: {}, error: null } },
    })

    const result = await activateSubscription({
      id: 'txn-4',
      farm_id: 'farm-1',
      months_added: 1,
      amount: 400,
    })

    expect(result.success).toBe(true)
    const endDate = new Date(result.endDate!)
    // Should extend from `future` (2 months out) + 1 month = 3 months out,
    // NOT from now + 1 month. This is the exact bug class the stacking
    // logic exists to prevent — a farmer who renews early must not lose
    // the remainder of what they already paid for.
    const expected = new Date(future)
    expected.setMonth(expected.getMonth() + 1)
    expect(endDate.getUTCMonth()).toBe(expected.getUTCMonth())
    expect(endDate.getUTCFullYear()).toBe(expected.getUTCFullYear())
  })

  it('does not stack from a lapsed (already-expired) subscription — restarts from today', async () => {
    const past = new Date()
    past.setMonth(past.getMonth() - 3) // lapsed 3 months ago

    mockSupabase.current = fakeSupabase({
      farms: {
        single: {
          data: { id: 'farm-1', subscription_tier: 'smallholder', subscription_end_date: past.toISOString() },
          error: null,
        },
        update: { data: {}, error: null },
      },
      transactions: { maybeSingle: { data: { activation_attempts: 0 }, error: null }, update: { data: {}, error: null } },
    })

    const result = await activateSubscription({
      id: 'txn-5',
      farm_id: 'farm-1',
      months_added: 1,
      amount: 200,
    })

    expect(result.success).toBe(true)
    const endDate = new Date(result.endDate!)
    const now = new Date()
    const expectedMonth = (now.getMonth() + 1) % 12
    expect(endDate.getMonth()).toBe(expectedMonth)
  })
})

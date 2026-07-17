import { describe, it, expect } from 'vitest'
import { inferTierFromMonthlyRate, computeSubscriptionUpdate } from './activate-subscription'

describe('inferTierFromMonthlyRate', () => {
  it('returns smallholder below the commercial threshold', () => {
    expect(inferTierFromMonthlyRate(0)).toBe('smallholder')
    expect(inferTierFromMonthlyRate(399)).toBe('smallholder')
  })

  it('returns commercial at and above 400, below the enterprise threshold', () => {
    expect(inferTierFromMonthlyRate(400)).toBe('commercial')
    expect(inferTierFromMonthlyRate(1999)).toBe('commercial')
  })

  it('returns enterprise at and above 2000', () => {
    expect(inferTierFromMonthlyRate(2000)).toBe('enterprise')
    expect(inferTierFromMonthlyRate(50000)).toBe('enterprise')
  })
})

describe('computeSubscriptionUpdate', () => {
  const now = new Date('2026-07-17T00:00:00.000Z')

  it('infers tier from amount / months_added, not amount alone', () => {
    // KES 4800 for 12 months = 400/mo = commercial, even though 4800
    // alone would read as enterprise-scale if someone forgot to divide.
    const { tier } = computeSubscriptionUpdate({
      farm: { subscription_end_date: null },
      txn: { amount: 4800, months_added: 12 },
      now,
    })
    expect(tier).toBe('commercial')
  })

  it('starts a fresh subscription from now when there is no prior end date', () => {
    const { endDate } = computeSubscriptionUpdate({
      farm: { subscription_end_date: null },
      txn: { amount: 400, months_added: 1 },
      now,
    })
    expect(endDate.toISOString()).toBe('2026-08-17T00:00:00.000Z')
  })

  it('starts a fresh subscription from now when the prior subscription already lapsed', () => {
    const { endDate } = computeSubscriptionUpdate({
      farm: { subscription_end_date: '2026-01-01T00:00:00.000Z' }, // in the past relative to `now`
      txn: { amount: 400, months_added: 1 },
      now,
    })
    expect(endDate.toISOString()).toBe('2026-08-17T00:00:00.000Z')
  })

  it('stacks onto the existing end date when the subscription is still active — a farmer who pays early keeps what they already paid for', () => {
    const { endDate } = computeSubscriptionUpdate({
      farm: { subscription_end_date: '2026-09-01T00:00:00.000Z' }, // ~6 weeks ahead of `now`
      txn: { amount: 400, months_added: 1 },
      now,
    })
    // Extends from 2026-09-01, not from `now` — losing this would cost
    // the farmer the ~6 weeks they already paid for.
    expect(endDate.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('handles a December → January month rollover correctly', () => {
    const { endDate } = computeSubscriptionUpdate({
      farm: { subscription_end_date: null },
      txn: { amount: 400, months_added: 2 },
      now: new Date('2026-11-30T00:00:00.000Z'),
    })
    expect(endDate.getUTCFullYear()).toBe(2027)
    expect(endDate.getUTCMonth()).toBe(0) // January
  })

  it('rounds the inferred monthly rate rather than truncating, matching how a farmer would expect a multi-month payment to be read', () => {
    // 1199 / 3 = 399.67 → rounds to 400 → commercial, not smallholder.
    const { tier } = computeSubscriptionUpdate({
      farm: { subscription_end_date: null },
      txn: { amount: 1199, months_added: 3 },
      now,
    })
    expect(tier).toBe('commercial')
  })
})

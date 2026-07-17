import { describe, it, expect } from 'vitest'
import { computeLotTotals } from './lot-totals'

describe('computeLotTotals', () => {
  it('adds an accepted delivery\'s cherry and mbuni kg onto the running totals', () => {
    const result = computeLotTotals({
      lot: { total_cherry_kg: 100, total_mbuni_kg: 10, total_farmers: 2 },
      cherryKg: 50,
      mbuniKg: 5,
      accepted: true,
    })
    expect(result).toEqual({ total_cherry_kg: 150, total_mbuni_kg: 15, total_farmers: 3 })
  })

  it('does not add kg from a rejected delivery to the totals, but still records the delivery attempt in total_farmers', () => {
    const result = computeLotTotals({
      lot: { total_cherry_kg: 100, total_mbuni_kg: 10, total_farmers: 2 },
      cherryKg: 50,
      mbuniKg: 5,
      accepted: false,
    })
    expect(result.total_cherry_kg).toBe(100)
    expect(result.total_mbuni_kg).toBe(10)
    expect(result.total_farmers).toBe(3)
  })

  it('treats a missing `accepted` field as accepted (matches the `!== false` check in addDeliveryToLot)', () => {
    const result = computeLotTotals({
      lot: { total_cherry_kg: 0, total_mbuni_kg: 0, total_farmers: 0 },
      cherryKg: 20,
    })
    expect(result.total_cherry_kg).toBe(20)
  })

  it('defaults mbuniKg to 0 when omitted', () => {
    const result = computeLotTotals({
      lot: { total_cherry_kg: 0, total_mbuni_kg: 0, total_farmers: 0 },
      cherryKg: 20,
      accepted: true,
    })
    expect(result.total_mbuni_kg).toBe(0)
  })

  it('treats null lot totals (a brand-new lot) as zero', () => {
    const result = computeLotTotals({
      lot: { total_cherry_kg: null, total_mbuni_kg: null, total_farmers: null },
      cherryKg: 30,
      mbuniKg: 2,
      accepted: true,
    })
    expect(result).toEqual({ total_cherry_kg: 30, total_mbuni_kg: 2, total_farmers: 1 })
  })

  it('documents current behavior: total_farmers counts deliveries, not distinct farmers — a farmer delivering twice to the same lot is counted twice', () => {
    let lot = { total_cherry_kg: 0, total_mbuni_kg: 0, total_farmers: 0 }
    lot = computeLotTotals({ lot, cherryKg: 40, accepted: true })
    lot = computeLotTotals({ lot, cherryKg: 35, accepted: true }) // same farmer, second delivery same day
    expect(lot.total_farmers).toBe(2)
    // If/when this should instead track distinct farmers, this test is
    // the one to update — see the comment above computeLotTotals in
    // actions.ts.
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from '../helpers/fake-supabase'

const mockSupabase = { current: null as any }
const mockAccess = { current: { success: true, coopId: 'coop-1', userId: 'user-1', role: 'chairman' } as any }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabase.current,
}))

vi.mock('@/lib/validate-coop-access', () => ({
  validateCoopAccess: async () => mockAccess.current,
}))

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}))

import { addDeliveryToLot } from '@/app/dashboard/cooperative/intake/actions'

const openLot = {
  id: 'lot-1',
  status: 'open',
  cooperative_id: 'coop-1',
  total_cherry_kg: 500,
  total_mbuni_kg: 0,
  total_farmers: 3,
}

describe('addDeliveryToLot', () => {
  beforeEach(() => {
    mockSupabase.current = null
    mockAccess.current = { success: true, coopId: 'coop-1', userId: 'user-1', role: 'chairman' }
  })

  it('rejects when the caller has no cooperative access', async () => {
    mockAccess.current = { success: false, error: 'Unauthorized' }

    const result = await addDeliveryToLot({
      lotId: 'lot-1', farmId: 'farm-1', cherryKg: 50, deliveryDate: '2026-07-16',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unauthorized')
  })

  it('rejects a delivery to a lot that is not open (closed/processing/milled/exported)', async () => {
    mockSupabase.current = fakeSupabase({
      factory_intake_lots: { single: { data: { ...openLot, status: 'closed' }, error: null } },
    })

    const result = await addDeliveryToLot({
      lotId: 'lot-1', farmId: 'farm-1', cherryKg: 50, deliveryDate: '2026-07-16',
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/only be added to open lots/)
  })

  it('rejects when the farm does not belong to this cooperative', async () => {
    mockSupabase.current = fakeSupabase({
      factory_intake_lots: { single: { data: openLot, error: null } },
      farms: { single: { data: null, error: { message: 'no rows' } } },
    })

    const result = await addDeliveryToLot({
      lotId: 'lot-1', farmId: 'farm-outside-coop', cherryKg: 50, deliveryDate: '2026-07-16',
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not a member of this cooperative/)
  })

  it('rejects a plotId that does not belong to the supplied farm (prevents plot spoofing into the EUDR/passport pipeline)', async () => {
    mockSupabase.current = fakeSupabase({
      factory_intake_lots: { single: { data: openLot, error: null } },
      farms: { single: { data: { id: 'farm-1' }, error: null } },
      coffee_plots: { single: { data: null, error: { message: 'no rows' } } },
    })

    const result = await addDeliveryToLot({
      lotId: 'lot-1', farmId: 'farm-1', cherryKg: 50, deliveryDate: '2026-07-16', plotId: 'plot-belongs-to-someone-else',
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/does not belong to this farmer/)
  })

  it('accepts a valid delivery and returns the inserted row', async () => {
    mockSupabase.current = fakeSupabase({
      factory_intake_lots: { single: { data: openLot, error: null }, update: { data: {}, error: null } },
      farms: { single: { data: { id: 'farm-1' }, error: null } },
      coffee_plots: { single: { data: { id: 'plot-1' }, error: null } },
      lot_farmer_deliveries: { single: { data: { id: 'delivery-1', farm_id: 'farm-1', farmer_cherry_kg: 50 }, error: null } },
    })

    const result = await addDeliveryToLot({
      lotId: 'lot-1', farmId: 'farm-1', cherryKg: 50, deliveryDate: '2026-07-16', plotId: 'plot-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.delivery.id).toBe('delivery-1')
    }
  })

  it('surfaces the database error message instead of swallowing it on insert failure', async () => {
    mockSupabase.current = fakeSupabase({
      factory_intake_lots: { single: { data: openLot, error: null } },
      farms: { single: { data: { id: 'farm-1' }, error: null } },
      lot_farmer_deliveries: { single: { data: null, error: { message: 'duplicate receipt_number' } } },
    })

    const result = await addDeliveryToLot({
      lotId: 'lot-1', farmId: 'farm-1', cherryKg: 50, deliveryDate: '2026-07-16',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('duplicate receipt_number')
  })
})

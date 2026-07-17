import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from '../helpers/fake-supabase'

const mockSupabase = { current: null as any }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabase.current,
}))

import { assemblePassportPayload } from '@/lib/passport/passport.service'

function baseTables(overrides: Record<string, any> = {}) {
  return {
    processing_batches: {
      single: {
        data: {
          id: 'batch-1',
          intake_lot_id: 'lot-1',
          season: 'main',
          harvest_year: 2026,
          washing_date: '2026-05-01',
          moisture_content_pct: 11.5,
          coop_factories: { factory_name: 'Kiawamururu FCS', factory_code: 'KWM' },
          cooperatives: { cooperative_name: 'Othaya Farmers Co-op', county: 'Nyeri', sub_county: 'Othaya', ward: 'Iria-ini' },
        },
        error: null,
      },
    },
    export_lots: { maybeSingle: { data: null, error: null } },
    lot_farmer_deliveries: {
      select: {
        data: [
          {
            farm_id: 'farm-1',
            farmer_cherry_kg: 200,
            plot_id: 'plot-1',
            farms: { id: 'farm-1', owner_name: 'Langat', land_size_acres: 2, gps_latitude: -0.5, gps_longitude: 36.9 },
            coffee_plots: { variety: 'SL28', gps_latitude: -0.5, gps_longitude: 36.9, gps_polygon: null, land_size_acres: 2, eudr_risk_level: 'low', area_hectares: 0.8 },
          },
          {
            farm_id: 'farm-2',
            farmer_cherry_kg: 150,
            plot_id: 'plot-2',
            farms: { id: 'farm-2', owner_name: 'Wanjiru', land_size_acres: 1.5, gps_latitude: -0.51, gps_longitude: 36.91 },
            coffee_plots: { variety: 'SL28', gps_latitude: -0.51, gps_longitude: 36.91, gps_polygon: null, land_size_acres: 1.5, eudr_risk_level: 'low', area_hectares: 0.6 },
          },
        ],
        error: null,
      },
    },
    coffee_eudr_compliance: {
      select: {
        data: [
          { risk_level: 'low', deforestation_risk: false, forest_cover_pct: 85, compliance_status: 'verified' },
          { risk_level: 'low', deforestation_risk: false, forest_cover_pct: 90, compliance_status: 'verified' },
        ],
        error: null,
      },
    },
    coffee_quality_records: { select: { data: [], error: null } },
    ...overrides,
  }
}

describe('assemblePassportPayload', () => {
  beforeEach(() => {
    mockSupabase.current = null
  })

  it('throws rather than silently proceeding when the processing batch does not exist', async () => {
    mockSupabase.current = fakeSupabase(
      baseTables({ processing_batches: { single: { data: null, error: null } } })
    )

    await expect(assemblePassportPayload('missing-batch', 'coop-1')).rejects.toThrow(/Processing batch not found/)
  })

  it('marks EUDR-compliant when every plot in the chain is low risk and deforestation-free', async () => {
    mockSupabase.current = fakeSupabase(baseTables())

    const { sustainabilityMetrics } = await assemblePassportPayload('batch-1', 'coop-1')

    expect(sustainabilityMetrics.deforestation_free_plots_pct).toBe(100)
    expect(sustainabilityMetrics.eudr_compliant).toBe(true)
  })

  it('is NOT compliant when even one plot in the chain carries deforestation risk (this must never silently round up)', async () => {
    mockSupabase.current = fakeSupabase(
      baseTables({
        coffee_eudr_compliance: {
          select: {
            data: [
              { risk_level: 'low', deforestation_risk: false, forest_cover_pct: 85, compliance_status: 'verified' },
              { risk_level: 'high', deforestation_risk: true, forest_cover_pct: 40, compliance_status: 'flagged' },
            ],
            error: null,
          },
        },
      })
    )

    const { sustainabilityMetrics } = await assemblePassportPayload('batch-1', 'coop-1')

    expect(sustainabilityMetrics.deforestation_free_plots_pct).toBe(50)
    expect(sustainabilityMetrics.eudr_compliant).toBe(false)
  })

  it('counts distinct farms, not deliveries, for farm_count', async () => {
    // Same farm delivering twice must count once.
    mockSupabase.current = fakeSupabase(
      baseTables({
        lot_farmer_deliveries: {
          select: {
            data: [
              { farm_id: 'farm-1', farmer_cherry_kg: 100, plot_id: 'plot-1', farms: { id: 'farm-1' }, coffee_plots: { variety: 'SL28', land_size_acres: 2 } },
              { farm_id: 'farm-1', farmer_cherry_kg: 80, plot_id: 'plot-1', farms: { id: 'farm-1' }, coffee_plots: { variety: 'SL28', land_size_acres: 2 } },
            ],
            error: null,
          },
        },
      })
    )

    const { publicStory } = await assemblePassportPayload('batch-1', 'coop-1')
    expect(publicStory.farm_count).toBe(1)
  })

  it('falls back to export_lot processing_method/grade/moisture when an export lot is supplied, over the batch defaults', async () => {
    mockSupabase.current = fakeSupabase(
      baseTables({
        export_lots: {
          maybeSingle: {
            data: { grade: 'AA', processing_method: 'Honey', moisture_content_pct: 10.8, sca_cupping_score: 87 },
            error: null,
          },
        },
      })
    )

    const { publicStory, qualityMetrics } = await assemblePassportPayload('batch-1', 'coop-1', 'export-lot-1')

    expect(publicStory.processing).toBe('Honey')
    expect(qualityMetrics.grade).toBe('AA')
    expect(qualityMetrics.sca_score).toBe(87)
  })
})

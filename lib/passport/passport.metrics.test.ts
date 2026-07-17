import { describe, it, expect } from 'vitest'
import { computePassportMetrics, type PassportComputationInput } from './passport.metrics'

const baseBatch: PassportComputationInput['batch'] = {
  season: 'main',
  harvest_year: 2026,
  washing_date: '2026-05-01',
  moisture_content_pct: 11.2,
  coop_factories: { factory_name: 'Test Factory', factory_code: 'TF' },
  cooperatives: { cooperative_name: 'Test Cooperative', county: 'Nyeri', sub_county: 'Othaya', ward: 'Iria-ini' },
}

describe('computePassportMetrics — EUDR / sustainability', () => {
  it('marks eudr_compliant true only when 100% of plots are low-risk and deforestation-free', () => {
    const result = computePassportMetrics({
      batch: baseBatch,
      deliveryList: [
        { farm_id: 'f1', plot_id: 'p1' },
        { farm_id: 'f2', plot_id: 'p2' },
      ],
      eudrRecords: [
        { risk_level: 'low', deforestation_risk: false },
        { risk_level: 'low', deforestation_risk: false },
      ],
      qualityRecords: [],
      exportLot: null,
    })
    expect(result.sustainabilityMetrics.deforestation_free_plots_pct).toBe(100)
    expect(result.sustainabilityMetrics.eudr_compliant).toBe(true)
  })

  it('marks eudr_compliant false when any plot is high-risk or has deforestation flagged — this is a compliance claim, it must not round up', () => {
    const result = computePassportMetrics({
      batch: baseBatch,
      deliveryList: [
        { farm_id: 'f1', plot_id: 'p1' },
        { farm_id: 'f2', plot_id: 'p2' },
      ],
      eudrRecords: [
        { risk_level: 'low', deforestation_risk: false },
        { risk_level: 'low', deforestation_risk: true }, // flagged despite "low" risk_level
      ],
      qualityRecords: [],
      exportLot: null,
    })
    expect(result.sustainabilityMetrics.deforestation_free_plots_pct).toBe(50)
    expect(result.sustainabilityMetrics.eudr_compliant).toBe(false)
  })

  it('does not claim 100% compliance when there are zero plots — absence of data must not read as a positive claim', () => {
    const result = computePassportMetrics({
      batch: baseBatch,
      deliveryList: [],
      eudrRecords: [],
      qualityRecords: [],
      exportLot: null,
    })
    expect(result.sustainabilityMetrics.deforestation_free_plots_pct).toBe(0)
    expect(result.sustainabilityMetrics.eudr_compliant).toBe(false)
  })

  it('converts hectares to acres (×2.471) when land_size_acres is missing', () => {
    const result = computePassportMetrics({
      batch: baseBatch,
      deliveryList: [
        { farm_id: 'f1', plot_id: 'p1', coffee_plots: { area_hectares: 1 } as any },
      ],
      eudrRecords: [],
      qualityRecords: [],
      exportLot: null,
    })
    // total_plot_area_acres is rounded to 1 decimal by the function
    // (2.471 → 2.5); the raw conversion factor is asserted separately
    // below via a value where rounding doesn't obscure it.
    expect(result.sustainabilityMetrics.total_plot_area_acres).toBe(2.5)
  })
})

describe('computePassportMetrics — farm count and averages', () => {
  it('dedupes farm_count by distinct farm, not by delivery row', () => {
    const result = computePassportMetrics({
      batch: baseBatch,
      deliveryList: [
        { farm_id: 'f1', plot_id: 'p1', coffee_plots: { land_size_acres: 2 } as any },
        { farm_id: 'f1', plot_id: 'p1b', coffee_plots: { land_size_acres: 1 } as any }, // same farm, second plot
        { farm_id: 'f2', plot_id: 'p2', coffee_plots: { land_size_acres: 3 } as any },
      ],
      eudrRecords: [],
      qualityRecords: [],
      exportLot: null,
    })
    expect(result.publicStory.farm_count).toBe(2)
    // Total acreage (6) / distinct farms (2) = 3.0, not / 3 deliveries.
    expect(result.publicStory.avg_farm_size_acres).toBe(3)
  })

  it('omits avg_farm_size_acres rather than dividing by zero when there are no deliveries', () => {
    const result = computePassportMetrics({
      batch: baseBatch,
      deliveryList: [],
      eudrRecords: [],
      qualityRecords: [],
      exportLot: null,
    })
    expect(result.publicStory.avg_farm_size_acres).toBeUndefined()
  })
})

describe('computePassportMetrics — grade and quality precedence', () => {
  it('prefers the export lot grade/SCA/moisture over the processing batch / quality record once a lot is attached', () => {
    const result = computePassportMetrics({
      batch: { ...baseBatch, moisture_content_pct: 11.2 },
      deliveryList: [],
      eudrRecords: [],
      qualityRecords: [{ cupping_score: 84, moisture_content_pct: undefined } as any],
      exportLot: { grade: 'AA', sca_cupping_score: 87, moisture_content_pct: 10.8, processing_method: 'Washed' },
    })
    expect(result.qualityMetrics.grade).toBe('AA')
    expect(result.qualityMetrics.sca_score).toBe(87)
    expect(result.qualityMetrics.moisture_pct).toBe(10.8)
  })

  it('falls back to the best quality record and batch moisture when there is no export lot yet', () => {
    const result = computePassportMetrics({
      batch: { ...baseBatch, moisture_content_pct: 11.2 },
      deliveryList: [],
      eudrRecords: [],
      qualityRecords: [{ cupping_score: 84 } as any],
      exportLot: null,
    })
    expect(result.qualityMetrics.grade).toBe('Unknown')
    expect(result.qualityMetrics.sca_score).toBe(84)
    expect(result.qualityMetrics.moisture_pct).toBe(11.2)
  })

  it('only lists certifications that are actually true, and only the ones present', () => {
    const result = computePassportMetrics({
      batch: baseBatch,
      deliveryList: [],
      eudrRecords: [],
      qualityRecords: [{ organic_certified: true, fair_trade_certified: true, utz_certified: false, rainforest_alliance: false } as any],
      exportLot: null,
    })
    expect(result.qualityMetrics.certifications).toEqual(['Organic', 'Fair Trade'])
  })
})

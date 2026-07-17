import { describe, it, expect } from 'vitest'
import { buildFarmStatementPdf } from '@/lib/reports/farm-statement-pdf'

const baseInput = {
  enterpriseLabel: 'Dairy',
  farmName: 'Test Farm',
  ownerName: 'Langat',
  county: 'Nyeri',
  periodLabel: '1 Jan 2026 \u2013 16 Jul 2026',
  generatedAt: new Date('2026-07-16T00:00:00.000Z'),
  summary: [{ label: 'Total revenue', value: 'KES 50,000' }],
  transactions: [{ date: '1 Jul 2026', description: 'Milk sale', quantity: '100 L', amount: '5,000' }],
}

describe('buildFarmStatementPdf', () => {
  it('produces a non-empty PDF document', () => {
    const doc = buildFarmStatementPdf(baseInput)
    const bytes = doc.output('arraybuffer')
    expect(bytes.byteLength).toBeGreaterThan(0)
  })

  it('does not throw when there are zero transactions (a farmer with no sales yet should still get a valid statement)', () => {
    const doc = buildFarmStatementPdf({ ...baseInput, transactions: [] })
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0)
  })

  it('paginates rather than overflowing when the summary or transaction list is long', () => {
    const manyTransactions = Array.from({ length: 80 }, (_, i) => ({
      date: `${i + 1} Jul 2026`, description: `Sale ${i}`, amount: '1,000',
    }))
    const doc = buildFarmStatementPdf({ ...baseInput, transactions: manyTransactions })
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  })
})

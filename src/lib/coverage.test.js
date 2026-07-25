import { describe, it, expect } from 'vitest'
import { coveredSharesFor } from './coverage'

describe('coveredSharesFor', () => {
  it('returns blank when there are no covered calls for the symbol', () => {
    const stock = { symbol: 'AAPL', shares: 100 }
    const all = [stock, { symbol: 'TSLA', assetType: 'Option', strategy: 'covered_call', shares: 1 }]
    expect(coveredSharesFor(stock, all)).toBe('')
  })

  it('sums shares (contracts x 100) across matching covered calls', () => {
    const stock = { symbol: 'AAPL', shares: 200 }
    const all = [
      stock,
      { symbol: 'AAPL', assetType: 'Option', strategy: 'covered_call', shares: 1 },
      { symbol: 'AAPL', assetType: 'Option', strategy: 'covered_call', shares: 1 },
    ]
    expect(coveredSharesFor(stock, all)).toBe(200)
  })

  it('ignores non-covered-call options and other symbols', () => {
    const stock = { symbol: 'AAPL', shares: 100 }
    const all = [
      stock,
      { symbol: 'AAPL', assetType: 'Option', strategy: 'call', shares: 1 },
      { symbol: 'MSFT', assetType: 'Option', strategy: 'covered_call', shares: 1 },
    ]
    expect(coveredSharesFor(stock, all)).toBe('')
  })
})
